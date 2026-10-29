-- ============================================================================
-- Command Center: Thinking Board
-- ============================================================================
-- A per-stock research workspace. An analyst organises notes into folders under a
-- covered stock, writes in a rich document, pulls verified data in as frozen
-- snapshots, and publishes the note into the stock's log as a cc_events row.
--
-- ADDITIVE ONLY. This file creates two NEW tables (cc_board_folders, cc_boards) and the
-- triggers, indexes and policies that belong to them. It does not ALTER, DROP, rename or
-- redefine any existing table, column, function, trigger or policy, and it moves no data.
--
--   Existing objects it READS (references, never changes):
--     tables     organizations, profiles, cc_coverage, cc_events   (foreign keys only)
--     functions  cc_derive_org_from_coverage, cc_freeze_tenancy, cc_touch_updated_at
--                (attached as triggers on the NEW tables; the functions are not redefined)
--
--   Effect on existing behaviour: none. The foreign keys from the new tables use
--   ON DELETE CASCADE / SET NULL, so deleting or archiving a stock or a log entry works
--   exactly as before -- it never fails because a note points at it.
--
-- Safe to run more than once: every step is skipped if its object already exists.
-- Runs in one transaction: if any step fails, nothing is created.
--
-- Drafts are PRIVATE to their author. A board becomes visible to the team only by
-- publishing it, at which point it is a cc_events row and inherits that table's
-- team-scoped RLS. Nothing here widens who can see desk work.
--
-- To undo (affects ONLY the two new tables and their own triggers/policies):
--   BEGIN;
--   DROP TABLE IF EXISTS public.cc_boards;
--   DROP TABLE IF EXISTS public.cc_board_folders;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Preflight: stop before creating anything if a dependency is missing
-- ---------------------------------------------------------------------------
DO $pre$
DECLARE missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF to_regclass('public.cc_coverage') IS NULL THEN missing := missing || 'table cc_coverage'; END IF;
    IF to_regclass('public.cc_events')   IS NULL THEN missing := missing || 'table cc_events';   END IF;
    IF to_regprocedure('public.cc_derive_org_from_coverage()') IS NULL THEN missing := missing || 'function cc_derive_org_from_coverage'; END IF;
    IF to_regprocedure('public.cc_freeze_tenancy()')            IS NULL THEN missing := missing || 'function cc_freeze_tenancy'; END IF;
    IF to_regprocedure('public.cc_touch_updated_at()')          IS NULL THEN missing := missing || 'function cc_touch_updated_at'; END IF;
    IF array_length(missing, 1) > 0 THEN
        RAISE EXCEPTION 'Thinking Board migration needs migration_add_command_center.sql first. Missing: %',
            array_to_string(missing, ', ');
    END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cc_board_folders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coverage_id      UUID NOT NULL REFERENCES public.cc_coverage(id) ON DELETE CASCADE,
    parent_id        UUID REFERENCES public.cc_board_folders(id) ON DELETE CASCADE,
    name             TEXT NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 120),
    position         INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_board_folders_owner
    ON public.cc_board_folders (created_by, coverage_id);

CREATE TABLE IF NOT EXISTS public.cc_boards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coverage_id         UUID NOT NULL REFERENCES public.cc_coverage(id) ON DELETE CASCADE,
    folder_id           UUID REFERENCES public.cc_board_folders(id) ON DELETE SET NULL,

    title               TEXT NOT NULL DEFAULT 'Untitled note' CHECK (length(title) <= 300),
    doc                 JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
    -- Markdown render of `doc`, kept in step on every save so a publish (and any
    -- future search) never has to re-serialise TipTap JSON server-side.
    doc_markdown        TEXT NOT NULL DEFAULT '',
    -- Floating connector cards on the canvas: frozen API snapshots + positions.
    cards               JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- The log entry this note was published as. SET NULL: deleting the entry from the
    -- log keeps the note; it just stops pointing at the deleted entry.
    published_event_id  UUID REFERENCES public.cc_events(id) ON DELETE SET NULL,
    last_published_at   TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_boards_owner_recent
    ON public.cc_boards (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_boards_coverage
    ON public.cc_boards (coverage_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_boards_folder
    ON public.cc_boards (folder_id) WHERE folder_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Triggers on the NEW tables: tenancy derived from the parent stock, never sent by
-- the client. Reuses the existing Command Center trigger functions unchanged.
-- ---------------------------------------------------------------------------
DO $trg$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('cc_board_folders', 'cc_board_folders_20_derive', 'BEFORE INSERT OR UPDATE OF coverage_id', 'cc_derive_org_from_coverage'),
            ('cc_board_folders', 'cc_board_folders_30_freeze', 'BEFORE UPDATE',                          'cc_freeze_tenancy'),
            ('cc_board_folders', 'cc_board_folders_40_touch',  'BEFORE UPDATE',                          'cc_touch_updated_at'),
            ('cc_boards',        'cc_boards_20_derive',        'BEFORE INSERT OR UPDATE OF coverage_id', 'cc_derive_org_from_coverage'),
            ('cc_boards',        'cc_boards_30_freeze',        'BEFORE UPDATE',                          'cc_freeze_tenancy'),
            ('cc_boards',        'cc_boards_40_touch',         'BEFORE UPDATE',                          'cc_touch_updated_at')
        ) AS v(tbl, name, timing, fn)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
             WHERE tgname = t.name AND tgrelid = format('public.%I', t.tbl)::regclass
        ) THEN
            EXECUTE format('CREATE TRIGGER %I %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.%I()',
                           t.name, t.timing, t.tbl, t.fn);
        END IF;
    END LOOP;
END
$trg$;

-- ---------------------------------------------------------------------------
-- Access on the NEW tables: author-only, while the parent stock is visible to them
-- ---------------------------------------------------------------------------
-- The EXISTS evaluates under cc_coverage's own SELECT policy, so an analyst moved off a
-- team stops seeing their drafts for that team's stocks, same as its log.
ALTER TABLE public.cc_board_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_boards        ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.cc_board_folders TO authenticated, service_role;
GRANT ALL ON public.cc_boards        TO authenticated, service_role;
-- Supabase grants anon on every new table by default; Command Center is never public.
REVOKE ALL ON public.cc_board_folders FROM anon;
REVOKE ALL ON public.cc_boards        FROM anon;

DO $pol$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'cc_board_folders'
                      AND policyname = 'Authors manage their board folders') THEN
        CREATE POLICY "Authors manage their board folders"
            ON public.cc_board_folders FOR ALL
            USING (
                created_by = auth.uid()
                AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_board_folders.coverage_id)
            )
            WITH CHECK (
                created_by = auth.uid()
                AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_board_folders.coverage_id)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'cc_boards'
                      AND policyname = 'Authors manage their boards') THEN
        CREATE POLICY "Authors manage their boards"
            ON public.cc_boards FOR ALL
            USING (
                created_by = auth.uid()
                AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_boards.coverage_id)
            )
            WITH CHECK (
                created_by = auth.uid()
                AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_boards.coverage_id)
            );
    END IF;
END
$pol$;

COMMIT;

-- Make PostgREST see the new tables without a restart.
NOTIFY pgrst, 'reload schema';
