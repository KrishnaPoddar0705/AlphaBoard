-- Migration: Command Center -- coverage, unified event timeline, contacts, brokers
-- Purpose: An org-wide (and solo-user) research log: which names a desk tracks, every
--          management meeting / concall / annual report / broker report logged against
--          them, who was met, and what the key takeaways were.
-- Date: 2026-09-12
--
-- ORDERING: apply AFTER migration_add_organizations.sql and
-- migration_fix_rls_recursion.sql -- every policy here calls the three SECURITY DEFINER
-- helpers those files install. Apply BEFORE deploying the frontend; the Command Center
-- reads Supabase directly with the user's JWT and will 404 (PGRST205) without the tables.
--
-- AUTHORIZATION MODEL: RLS is the only boundary. There is no server tier in front of
-- this -- the FastAPI service uses the service-role key and has no auth of its own, so
-- NOTHING in this feature may be routed through it. Every rule below must hold against
-- a hostile client that can send any JSON body it likes to PostgREST.
--
-- TWO TENANCY SHAPES, in every table and every policy:
--   organization_id IS NOT NULL -> org-wide read AND org-wide write (any member).
--   organization_id IS NULL     -> a solo user with no membership; visible only to
--                                 created_by. This is NOT "public" -- unlike
--                                 recommendations / price_targets / podcasts there is
--                                 deliberately no `profiles.is_private = false` escape
--                                 hatch. Broker research is licensed and corporate
--                                 access notes are confidential. Nothing here is public.
--
-- ROLLBACK:
--   DROP VIEW IF EXISTS public.cc_activity_feed, public.cc_contact_last_met,
--                       public.cc_coverage_board;
--   DROP FUNCTION IF EXISTS public.cc_search_events(TEXT,UUID,TEXT[],DATE,DATE,INT,INT);
--   DROP TABLE IF EXISTS public.cc_event_contacts, public.cc_event_attachments,
--                        public.cc_events, public.cc_contacts, public.cc_coverage,
--                        public.cc_brokers CASCADE;
--   DROP FUNCTION IF EXISTS public.cc_touch_updated_at(), public.cc_stamp_owner(),
--                           public.cc_derive_org_from_coverage(), public.cc_freeze_tenancy(),
--                           public.cc_normalize_ticker();
--   DELETE FROM storage.objects WHERE bucket_id = 'command-center';
--   DELETE FROM storage.buckets WHERE id = 'command-center';

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================

-- gen_random_uuid() is core since PG13 and is what the newer migrations in this repo
-- use (migration_add_organizations.sql:11). uuid-ossp is NOT required here.
-- btree_gin lets one GIN index cover (organization_id, search_tsv) -- see section 1c.
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1a. cc_brokers
-- ---------------------------------------------------------------------------
-- Three populations share one table, distinguished by (organization_id, created_by):
--   (NULL, NULL)    -> global seed, readable by everyone, writable by nobody
--   (<org>, <user>) -> an org's own broker, admin-only writes
--   (NULL, <user>)  -> a solo user's private broker
-- A plain UNIQUE(organization_id, lower(name)) would NOT dedupe the globals, because
-- NULL <> NULL in a unique index and every seed row would be collision-free. Hence the
-- three partial unique indexes.
CREATE TABLE IF NOT EXISTS public.cc_brokers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Nullable ONLY here, and only so the seed rows below can have no author.
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name            TEXT NOT NULL CHECK (btrim(name) <> ''),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_brokers_global_name
    ON public.cc_brokers (lower(btrim(name)))
    WHERE organization_id IS NULL AND created_by IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_brokers_org_name
    ON public.cc_brokers (organization_id, lower(btrim(name)))
    WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_brokers_solo_name
    ON public.cc_brokers (created_by, lower(btrim(name)))
    WHERE organization_id IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_brokers_organization_id
    ON public.cc_brokers (organization_id);

-- ---------------------------------------------------------------------------
-- 1b. cc_coverage -- a tracked stock, plus its corporate details
-- ---------------------------------------------------------------------------
-- There is no stocks master table in this schema. `ticker` is bare text exactly as
-- GET /market/search returns it (e.g. 'RELIANCE.NS'). cc_normalize_ticker upper-cases
-- and trims it so the partial unique indexes below actually bite -- without that,
-- 'RELIANCE.NS' and 'reliance.ns ' are two different tracked names.
CREATE TABLE IF NOT EXISTS public.cc_coverage (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    ticker              TEXT NOT NULL CHECK (btrim(ticker) <> ''),
    company_name        TEXT,
    market              TEXT,  -- free text: whatever /market/search reports ('NSE','BSE','US')

    understanding_level TEXT CHECK (understanding_level IN ('high','medium','low')),
    model_status        TEXT NOT NULL DEFAULT 'none'
                             CHECK (model_status IN ('none','basic','detailed')),
    corporate_address   TEXT,
    sector              TEXT,
    lead_analyst_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes               TEXT,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial, because NULLs never collide in a unique index: a single
-- UNIQUE(organization_id, ticker) would leave every solo row entirely unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_coverage_org_ticker
    ON public.cc_coverage (organization_id, ticker)
    WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_coverage_solo_ticker
    ON public.cc_coverage (created_by, ticker)
    WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cc_coverage_org_active
    ON public.cc_coverage (organization_id, is_active, company_name);
CREATE INDEX IF NOT EXISTS idx_cc_coverage_solo
    ON public.cc_coverage (created_by) WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cc_coverage_lead_analyst
    ON public.cc_coverage (lead_analyst_id);
CREATE INDEX IF NOT EXISTS idx_cc_coverage_sector
    ON public.cc_coverage (organization_id, sector);

-- ---------------------------------------------------------------------------
-- 1c. cc_events -- ONE unified timeline, discriminated by `kind`
-- ---------------------------------------------------------------------------
-- A management meeting, a concall, an annual-report read and a broker report are the
-- same shape: a dated thing that happened to a stock, with key takeaways and
-- attachments. Keeping them in one table is what makes the timeline, the calendar and
-- the org-wide activity feed a single query each instead of four unions.
CREATE TABLE IF NOT EXISTS public.cc_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_id     UUID NOT NULL REFERENCES public.cc_coverage(id) ON DELETE CASCADE,

    -- DENORMALISED from cc_coverage. Never written by the client -- a BEFORE trigger
    -- derives it and a second trigger freezes it. It exists so the org-wide activity
    -- feed is a single-table index scan instead of a join whose RLS predicate has to
    -- be re-evaluated per candidate row.
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

    kind            TEXT NOT NULL CHECK (kind IN (
                        'management_meeting','concall','annual_report',
                        'broker_report','agm','other')),
    -- subtype only qualifies a management meeting. A concall has no plant-visit
    -- flavour; an annual report certainly does not.
    subtype         TEXT CHECK (subtype IN
                        ('1:1','plant_visit','conference','group_meeting','call','site_visit')),
    CONSTRAINT cc_events_subtype_scope
        CHECK (subtype IS NULL OR kind = 'management_meeting'),

    title           TEXT NOT NULL CHECK (btrim(title) <> ''),
    event_date      DATE NOT NULL,
    -- TRUE  = planned / on the calendar, has not happened yet
    -- FALSE = logged, it happened
    is_scheduled    BOOLEAN NOT NULL DEFAULT FALSE,
    -- concall: did we attend?  annual_report: have we read it?
    attendance      TEXT NOT NULL DEFAULT 'na' CHECK (attendance IN ('yes','no','na')),

    -- 'Q2 FY26', 'FY25', 'CY2025'. Constrained on purpose: this drives a period filter
    -- in the UI and free text turns that filter into noise. If it ever rejects a
    -- legitimate label, DROP CONSTRAINT cc_events_period_label_format -- it is the one
    -- constraint here that is safe to remove.
    period_label    TEXT,
    CONSTRAINT cc_events_period_label_format CHECK (
        period_label IS NULL
        OR period_label ~ '^(Q[1-4] )?(FY|CY)[0-9]{2}([0-9]{2})?$'),

    -- Deliberately NOT restricted to kind = 'broker_report': brokers also host the
    -- conferences and group meetings that show up as management_meeting rows, and
    -- knowing who hosted is half the point of the field.
    broker_id       UUID REFERENCES public.cc_brokers(id) ON DELETE SET NULL,

    kta             TEXT,  -- key takeaways, markdown (GFM tables)
    thesis_impact   TEXT CHECK (thesis_impact IN ('positive','negative','neutral')),
    open_questions  TEXT,

    analyst_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- whose work this is
    created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- to_tsvector(regconfig, text) is IMMUTABLE; to_tsvector(text) is only STABLE
    -- because it reads the default_text_search_config GUC, and Postgres rejects that in
    -- a generated column ("generation expression is not immutable"). The explicit
    -- ::regconfig cast is there so nobody "simplifies" it away.
    -- Weights A > B > C: a term in a title outranks the same term buried in a long KTA.
    search_tsv      tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english'::regconfig, coalesce(title, '')),          'A') ||
        setweight(to_tsvector('english'::regconfig, coalesce(kta, '')),            'B') ||
        setweight(to_tsvector('english'::regconfig, coalesce(open_questions, '')), 'C')
    ) STORED
);

-- The org feed: "everything my desk logged, newest first".
CREATE INDEX IF NOT EXISTS idx_cc_events_org_date
    ON public.cc_events (organization_id, event_date DESC, created_at DESC);
-- The solo feed. Separate partial index: for org-NULL rows the column above is all
-- NULLs and the index above is useless.
CREATE INDEX IF NOT EXISTS idx_cc_events_solo_date
    ON public.cc_events (created_by, event_date DESC)
    WHERE organization_id IS NULL;
-- One company's timeline.
CREATE INDEX IF NOT EXISTS idx_cc_events_coverage_date
    ON public.cc_events (coverage_id, event_date DESC);
-- The upcoming-events widget and the calendar's future half. Partial, because
-- scheduled rows are a tiny minority.
CREATE INDEX IF NOT EXISTS idx_cc_events_upcoming
    ON public.cc_events (organization_id, event_date)
    WHERE is_scheduled = TRUE;
CREATE INDEX IF NOT EXISTS idx_cc_events_kind
    ON public.cc_events (organization_id, kind, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_cc_events_analyst
    ON public.cc_events (analyst_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_cc_events_broker
    ON public.cc_events (broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_events_created_by
    ON public.cc_events (created_by);

-- Composite GIN (needs btree_gin) so an org-scoped search is one index probe rather
-- than "GIN match every org's documents, then discard them at the RLS recheck".
CREATE INDEX IF NOT EXISTS idx_cc_events_search
    ON public.cc_events USING GIN (organization_id, search_tsv);

-- ---------------------------------------------------------------------------
-- 1d. cc_event_attachments
-- ---------------------------------------------------------------------------
-- No organization_id: visibility mirrors the parent event exactly, via an EXISTS that
-- is itself subject to cc_events' RLS -- the same idiom as recommendation_teams in
-- migration_add_portfolio_manager_role.sql:147-154. No recursion risk, because
-- cc_events' policy never looks at this table.
--
-- Either an uploaded object (storage_path) or an external link (external_url), never
-- both and never neither -- the user asked for Drive/Sheets links alongside uploads.
CREATE TABLE IF NOT EXISTS public.cc_event_attachments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES public.cc_events(id) ON DELETE CASCADE,
    -- UNIQUE so two rows can never claim the same storage object; that would make
    -- "delete the row, delete the object" wrong for one of them.
    storage_path TEXT UNIQUE,
    external_url TEXT,
    CONSTRAINT cc_event_attachments_one_source CHECK (
        (storage_path IS NOT NULL AND external_url IS NULL)
        OR (storage_path IS NULL AND external_url IS NOT NULL)),
    file_name    TEXT NOT NULL,
    mime_type    TEXT,
    size_bytes   BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
    uploaded_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_event_attachments_event
    ON public.cc_event_attachments (event_id);

-- ---------------------------------------------------------------------------
-- 1e. cc_contacts -- the POC directory per covered stock
-- ---------------------------------------------------------------------------
-- organization_id IS denormalised here (unlike attachments) because "show me every IR
-- contact this desk has, across all coverage" is a real screen, and doing it through
-- cc_coverage means a join under RLS on every keystroke of the search box.
--
-- There is deliberately NO date_met column. It is derived from the most recent event
-- tagging the contact -- see cc_contact_last_met. A stored copy goes stale the moment
-- someone back-dates or deletes a meeting, and no single write path could keep it
-- honest.
CREATE TABLE IF NOT EXISTS public.cc_contacts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_id       UUID NOT NULL REFERENCES public.cc_coverage(id) ON DELETE CASCADE,
    organization_id   UUID REFERENCES public.organizations(id) ON DELETE CASCADE,  -- derived

    name              TEXT NOT NULL CHECK (btrim(name) <> ''),
    designation       TEXT NOT NULL DEFAULT 'Other' CHECK (designation IN
                          ('IR','CSO','CFO','MD','CEO','COO','Chairman','Other')),
    designation_other TEXT,
    CONSTRAINT cc_contacts_designation_other_scope
        CHECK (designation_other IS NULL OR designation = 'Other'),

    email             TEXT CHECK (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    phone             TEXT,

    created_by        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_contacts_coverage
    ON public.cc_contacts (coverage_id, name);
CREATE INDEX IF NOT EXISTS idx_cc_contacts_org
    ON public.cc_contacts (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_cc_contacts_solo
    ON public.cc_contacts (created_by) WHERE organization_id IS NULL;
-- Dedupe on email only. Two people at one company can share a name; nobody shares a
-- mailbox.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_contacts_coverage_email
    ON public.cc_contacts (coverage_id, lower(btrim(email)))
    WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1f. cc_event_contacts -- who was met at which interaction
-- ---------------------------------------------------------------------------
-- Composite PK makes (event, contact) idempotent -- same idiom as recommendation_teams.
CREATE TABLE IF NOT EXISTS public.cc_event_contacts (
    event_id   UUID NOT NULL REFERENCES public.cc_events(id)   ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.cc_contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, contact_id)
);

-- The PK indexes (event_id, contact_id) left-to-right, which answers "who was at this
-- meeting". "When did I last meet this person" asks the other direction.
CREATE INDEX IF NOT EXISTS idx_cc_event_contacts_contact
    ON public.cc_event_contacts (contact_id);

-- ============================================================================
-- 2. TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- cc_stamp_owner -- for the two tables with no parent (cc_coverage, cc_brokers)
-- ---------------------------------------------------------------------------
-- Derives BOTH tenancy columns server-side so the client never supplies them:
-- created_by and organization_id become outputs of the request, not inputs to it.
--
-- The auth.uid() IS NULL guard matters. service_role calls (a backfill, the broker
-- seed below) carry no JWT, and without the guard every such insert would fail a
-- NOT NULL on created_by instead of doing what the caller asked.
CREATE OR REPLACE FUNCTION public.cc_stamp_owner()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;                       -- service_role / migration: trust the caller
    END IF;
    NEW.created_by      := auth.uid();
    NEW.organization_id := public.get_user_organization_id(auth.uid());
    RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- cc_derive_org_from_coverage -- for cc_events and cc_contacts
-- ---------------------------------------------------------------------------
-- WHY A TRIGGER AND NOT A CLIENT-SUPPLIED COLUMN.
-- If the client set organization_id, the strongest thing RLS could assert is "the org
-- you named is one you belong to". That leaves a real hole: a member of org B posts an
-- event whose coverage_id belongs to org A (UUIDs leak -- they appear in URLs, error
-- messages and exports) while stamping organization_id = B. Every check passes, and the
-- row then renders org A's company name inside org B's feed. The symmetric abuse is a
-- member of org A stamping NULL to quietly take desk work private.
--
-- WHY IT IS SAFE. Postgres evaluates RLS WITH CHECK expressions AFTER BEFORE-row
-- triggers, against the row as it will actually be stored. So the derived value is what
-- RLS validates and the client's value never reaches a policy.
--
-- SECURITY INVOKER on purpose -- the one place this migration diverges from the
-- team_org_id() DEFINER pattern in migration_add_portfolio_manager_role.sql:112. That
-- helper is DEFINER because `teams` has no checked-in DDL and its RLS is unknowable
-- from the repo. We own cc_coverage's RLS, so invoker rights are strictly safer here:
-- an invisible parent raises a readable insufficient_privilege instead of silently
-- yielding NULL and reclassifying an org row as a solo row.
CREATE OR REPLACE FUNCTION public.cc_derive_org_from_coverage()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v_org UUID; v_found BOOLEAN;
BEGIN
    SELECT cov.organization_id, TRUE INTO v_org, v_found
      FROM public.cc_coverage cov
     WHERE cov.id = NEW.coverage_id;

    IF NOT COALESCE(v_found, FALSE) THEN
        RAISE EXCEPTION
            'cc: coverage % does not exist or is not visible to you', NEW.coverage_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    NEW.organization_id := v_org;         -- overwrite whatever the client sent
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- cc_freeze_tenancy -- make the denormalised copy incapable of going stale
-- ---------------------------------------------------------------------------
-- Two rules. A row can never change organisation (so no child copy can drift), and no
-- row can change created_by (so authorship is not transferable by UPDATE).
CREATE OR REPLACE FUNCTION public.cc_freeze_tenancy()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'cc: organization_id is immutable (delete and recreate instead)'
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'cc: created_by is immutable'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$fn$;

-- Without this the partial unique indexes on cc_coverage are decorative:
-- 'RELIANCE.NS', 'reliance.ns' and 'RELIANCE.NS ' would be three tracked names.
CREATE OR REPLACE FUNCTION public.cc_normalize_ticker()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    NEW.ticker := upper(btrim(NEW.ticker));
    RETURN NEW;
END;
$fn$;

-- ============================================================================
-- 3. ATTACH TRIGGERS
-- ============================================================================
-- Names are numbered because Postgres fires same-timing triggers in NAME order:
-- normalize -> stamp/derive -> freeze (UPDATE only) -> touch.

DROP TRIGGER IF EXISTS cc_coverage_10_normalize ON public.cc_coverage;
CREATE TRIGGER cc_coverage_10_normalize
    BEFORE INSERT OR UPDATE ON public.cc_coverage
    FOR EACH ROW EXECUTE FUNCTION public.cc_normalize_ticker();

DROP TRIGGER IF EXISTS cc_coverage_20_stamp ON public.cc_coverage;
CREATE TRIGGER cc_coverage_20_stamp
    BEFORE INSERT ON public.cc_coverage
    FOR EACH ROW EXECUTE FUNCTION public.cc_stamp_owner();

DROP TRIGGER IF EXISTS cc_coverage_30_freeze ON public.cc_coverage;
CREATE TRIGGER cc_coverage_30_freeze
    BEFORE UPDATE ON public.cc_coverage
    FOR EACH ROW EXECUTE FUNCTION public.cc_freeze_tenancy();

DROP TRIGGER IF EXISTS cc_coverage_40_touch ON public.cc_coverage;
CREATE TRIGGER cc_coverage_40_touch
    BEFORE UPDATE ON public.cc_coverage
    FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_events_20_derive ON public.cc_events;
CREATE TRIGGER cc_events_20_derive
    BEFORE INSERT OR UPDATE OF coverage_id ON public.cc_events
    FOR EACH ROW EXECUTE FUNCTION public.cc_derive_org_from_coverage();

DROP TRIGGER IF EXISTS cc_events_30_freeze ON public.cc_events;
CREATE TRIGGER cc_events_30_freeze
    BEFORE UPDATE ON public.cc_events
    FOR EACH ROW EXECUTE FUNCTION public.cc_freeze_tenancy();

DROP TRIGGER IF EXISTS cc_events_40_touch ON public.cc_events;
CREATE TRIGGER cc_events_40_touch
    BEFORE UPDATE ON public.cc_events
    FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_contacts_20_derive ON public.cc_contacts;
CREATE TRIGGER cc_contacts_20_derive
    BEFORE INSERT OR UPDATE OF coverage_id ON public.cc_contacts
    FOR EACH ROW EXECUTE FUNCTION public.cc_derive_org_from_coverage();

DROP TRIGGER IF EXISTS cc_contacts_30_freeze ON public.cc_contacts;
CREATE TRIGGER cc_contacts_30_freeze
    BEFORE UPDATE ON public.cc_contacts
    FOR EACH ROW EXECUTE FUNCTION public.cc_freeze_tenancy();

DROP TRIGGER IF EXISTS cc_contacts_40_touch ON public.cc_contacts;
CREATE TRIGGER cc_contacts_40_touch
    BEFORE UPDATE ON public.cc_contacts
    FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_brokers_20_stamp ON public.cc_brokers;
CREATE TRIGGER cc_brokers_20_stamp
    BEFORE INSERT ON public.cc_brokers
    FOR EACH ROW EXECUTE FUNCTION public.cc_stamp_owner();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.cc_brokers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_coverage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_event_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_event_contacts    ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4b. TABLE GRANTS
-- ============================================================================
-- Deliberately adjacent to ENABLE ROW LEVEL SECURITY rather than at the end of the
-- file. Postgres checks GRANTs BEFORE it checks RLS, so a table that exists with RLS
-- enabled and no grant answers "permission denied for table cc_coverage" -- which is
-- what a migration applied in pieces, stopping short of a trailing grants section,
-- produces. Keeping the two together means any run that creates a table also makes it
-- usable.
--
-- anon is excluded everywhere: nothing in Command Center is public. Supabase's default
-- privileges on the public schema hand anon a grant on every new table, so it must be
-- revoked by name -- REVOKE ... FROM PUBLIC does not cover a role-specific grant.
GRANT ALL ON public.cc_brokers           TO authenticated, service_role;
GRANT ALL ON public.cc_coverage          TO authenticated, service_role;
GRANT ALL ON public.cc_events            TO authenticated, service_role;
GRANT ALL ON public.cc_event_attachments TO authenticated, service_role;
GRANT ALL ON public.cc_contacts          TO authenticated, service_role;
GRANT ALL ON public.cc_event_contacts    TO authenticated, service_role;

REVOKE ALL ON public.cc_brokers           FROM anon;
REVOKE ALL ON public.cc_coverage          FROM anon;
REVOKE ALL ON public.cc_events            FROM anon;
REVOKE ALL ON public.cc_event_attachments FROM anon;
REVOKE ALL ON public.cc_contacts          FROM anon;
REVOKE ALL ON public.cc_event_contacts    FROM anon;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
-- NO NEW SECURITY DEFINER HELPER IS NEEDED. Every predicate below is built from the
-- three that migration_fix_rls_recursion.sql:42-78 already installs:
--   user_belongs_to_org(uid, org)   -- read gate
--   get_user_organization_id(uid)   -- write gate, and the solo test
--   is_org_admin(uid, org)          -- destructive operations only
--
-- WHY THIS CANNOT RECUR the way migration_fix_rls_recursion.sql had to fix. The only
-- tables these policies touch directly are cc_* ones; user_organization_membership is
-- reached EXCLUSIVELY through SECURITY DEFINER functions, which run with RLS off. The
-- reference graph is a DAG with no cycle:
--   cc_event_attachments -> cc_events -> cc_coverage -> (SECURITY DEFINER) -> STOP
--   cc_event_contacts    -> cc_events, cc_contacts -> cc_coverage -> STOP
-- No cc_* policy ever reads back into a table that reads it.
--
-- WHY THE WRITE GATE USES `= get_user_organization_id(auth.uid())` AND NOT
-- `user_belongs_to_org(...)`. Membership is one-org-per-user, hard-enforced by
-- unique_user_membership, so equality against the user's single org is strictly
-- stronger: it forbids not just writing into someone else's org, but also stamping
-- organization_id = NULL (laundering desk data into a private row) when you do have an
-- org. user_belongs_to_org would permit that second move.
--
-- WHY DELETE IS NARROWER THAN WRITE. Org-wide write means anyone on the desk may add
-- an entry. Deleting a coverage row cascades away every event, contact and attachment
-- under it -- that is not an "add an entry" operation, so it is creator-or-admin only.
-- Note is_org_admin() means "may administer this organization"; a portfolio_manager is
-- deliberately NOT one (migration_add_portfolio_manager_role.sql:98), so a PM lands on
-- the analyst side here. That is correct.

-- ---------------------------------------------------------------------------
-- 5a. cc_brokers -- admin-only writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can read global and own-org brokers" ON public.cc_brokers;
CREATE POLICY "Members can read global and own-org brokers"
    ON public.cc_brokers FOR SELECT
    USING (
        -- Global seeds: readable by everyone, including solo users.
        (organization_id IS NULL AND created_by IS NULL)
        -- An org's own brokers.
        OR (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        -- A solo user's private broker.
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Admins and solo users can add brokers" ON public.cc_brokers;
CREATE POLICY "Admins and solo users can add brokers"
    ON public.cc_brokers FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND (
            (
                organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid())
                AND public.is_org_admin(auth.uid(), organization_id)
            )
            -- A user with no org has no admin to ask, so they may keep a private list.
            -- created_by = auth.uid() above keeps it out of the global namespace.
            OR (organization_id IS NULL AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
    );

DROP POLICY IF EXISTS "Admins and solo users can edit brokers" ON public.cc_brokers;
CREATE POLICY "Admins and solo users can edit brokers"
    ON public.cc_brokers FOR UPDATE
    USING (
        (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    )
    WITH CHECK (
        -- The post-image is checked too, so an admin cannot rewrite their own broker
        -- into a global seed (both columns NULL) and poison every other org's list.
        (organization_id IS NOT NULL
            AND organization_id = public.get_user_organization_id(auth.uid())
            AND public.is_org_admin(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Admins and solo users can delete brokers" ON public.cc_brokers;
CREATE POLICY "Admins and solo users can delete brokers"
    ON public.cc_brokers FOR DELETE
    USING (
        -- Globals are unreachable: both branches require a non-NULL discriminator.
        (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- 5b. cc_coverage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members and solo owners can read coverage" ON public.cc_coverage;
CREATE POLICY "Org members and solo owners can read coverage"
    ON public.cc_coverage FOR SELECT
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Org members and solo owners can add coverage" ON public.cc_coverage;
CREATE POLICY "Org members and solo owners can add coverage"
    ON public.cc_coverage FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
    );

-- Org-wide write: anyone on the desk may enrich a covered name. WITH CHECK repeats
-- USING so a row cannot be moved out of the org by UPDATE (belt; the braces are
-- cc_freeze_tenancy).
DROP POLICY IF EXISTS "Org members and solo owners can edit coverage" ON public.cc_coverage;
CREATE POLICY "Org members and solo owners can edit coverage"
    ON public.cc_coverage FOR UPDATE
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    )
    WITH CHECK (
        (organization_id IS NOT NULL
            AND organization_id = public.get_user_organization_id(auth.uid()))
        OR (organization_id IS NULL AND created_by = auth.uid()
            AND public.get_user_organization_id(auth.uid()) IS NULL)
    );

DROP POLICY IF EXISTS "Creators and admins can delete coverage" ON public.cc_coverage;
CREATE POLICY "Creators and admins can delete coverage"
    ON public.cc_coverage FOR DELETE
    USING (
        (organization_id IS NOT NULL
            AND (created_by = auth.uid() OR public.is_org_admin(auth.uid(), organization_id)))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- 5c. cc_events
-- ---------------------------------------------------------------------------
-- SELECT reads ONLY the denormalised column -- no join, no nested RLS. That is the
-- entire justification for denormalising organization_id onto this table.
DROP POLICY IF EXISTS "Org members and solo owners can read events" ON public.cc_events;
CREATE POLICY "Org members and solo owners can read events"
    ON public.cc_events FOR SELECT
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

-- The EXISTS over cc_coverage is load-bearing, not redundant. It evaluates under
-- cc_coverage's own SELECT policy, so it means "the parent is visible to YOU". Without
-- it, a user could POST a guessed coverage_id belonging to another desk: the trigger
-- would faithfully copy that desk's organization_id onto the row and the org branch
-- below would then fail -- but a SOLO user (whose org is NULL) would sail through and
-- end up owning a private event parented to someone else's coverage.
DROP POLICY IF EXISTS "Org members and solo owners can add events" ON public.cc_events;
CREATE POLICY "Org members and solo owners can add events"
    ON public.cc_events FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_events.coverage_id
        )
        AND (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
        -- broker_id, if set, must be one this user can actually see. Evaluated under
        -- cc_brokers' SELECT policy, so it covers global, own-org and private alike and
        -- blocks pointing at another desk's private broker list.
        AND (
            broker_id IS NULL
            OR EXISTS (SELECT 1 FROM public.cc_brokers b WHERE b.id = cc_events.broker_id)
        )
    );

DROP POLICY IF EXISTS "Org members and solo owners can edit events" ON public.cc_events;
CREATE POLICY "Org members and solo owners can edit events"
    ON public.cc_events FOR UPDATE
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    )
    WITH CHECK (
        (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL AND created_by = auth.uid()
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
        AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_events.coverage_id)
        AND (broker_id IS NULL
             OR EXISTS (SELECT 1 FROM public.cc_brokers b WHERE b.id = cc_events.broker_id))
    );

DROP POLICY IF EXISTS "Creators and admins can delete events" ON public.cc_events;
CREATE POLICY "Creators and admins can delete events"
    ON public.cc_events FOR DELETE
    USING (
        (organization_id IS NOT NULL
            AND (created_by = auth.uid() OR public.is_org_admin(auth.uid(), organization_id)))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- 5d. cc_event_attachments -- visibility mirrors the parent event
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Attachments follow the event" ON public.cc_event_attachments;
CREATE POLICY "Attachments follow the event"
    ON public.cc_event_attachments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_attachments.event_id)
    );

-- The LIKE clause is where the storage path convention (section 9) becomes a database
-- invariant rather than a frontend convention: a metadata row can only ever point at
-- an object inside the folder the storage.objects policies would have let this user
-- write to anyway. Keep the two in sync -- they are one rule written twice, because
-- storage.objects and this table cannot see each other.
DROP POLICY IF EXISTS "Event writers can attach files" ON public.cc_event_attachments;
CREATE POLICY "Event writers can attach files"
    ON public.cc_event_attachments FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.cc_events e
             WHERE e.id = cc_event_attachments.event_id
               AND (
                   cc_event_attachments.storage_path IS NULL   -- external link row
                   OR cc_event_attachments.storage_path LIKE (
                        COALESCE(e.organization_id::text, 'user/' || auth.uid()::text)
                        || '/' || e.coverage_id::text
                        || '/' || e.id::text || '/%')
               )
        )
    );

-- Attachments are immutable metadata: replace by delete + insert. No UPDATE policy is
-- created, which with RLS enabled means UPDATE is denied for every non-superuser.

DROP POLICY IF EXISTS "Uploaders and admins can remove attachments" ON public.cc_event_attachments;
CREATE POLICY "Uploaders and admins can remove attachments"
    ON public.cc_event_attachments FOR DELETE
    USING (
        uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.cc_events e
             WHERE e.id = cc_event_attachments.event_id
               AND e.organization_id IS NOT NULL
               AND public.is_org_admin(auth.uid(), e.organization_id)
        )
    );

-- ---------------------------------------------------------------------------
-- 5e. cc_contacts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members and solo owners can read contacts" ON public.cc_contacts;
CREATE POLICY "Org members and solo owners can read contacts"
    ON public.cc_contacts FOR SELECT
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Org members and solo owners can add contacts" ON public.cc_contacts;
CREATE POLICY "Org members and solo owners can add contacts"
    ON public.cc_contacts FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_contacts.coverage_id)
        AND (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
    );

DROP POLICY IF EXISTS "Org members and solo owners can edit contacts" ON public.cc_contacts;
CREATE POLICY "Org members and solo owners can edit contacts"
    ON public.cc_contacts FOR UPDATE
    USING (
        (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
        OR (organization_id IS NULL AND created_by = auth.uid())
    )
    WITH CHECK (
        (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL AND created_by = auth.uid()
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
        AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_contacts.coverage_id)
    );

DROP POLICY IF EXISTS "Creators and admins can delete contacts" ON public.cc_contacts;
CREATE POLICY "Creators and admins can delete contacts"
    ON public.cc_contacts FOR DELETE
    USING (
        (organization_id IS NOT NULL
            AND (created_by = auth.uid() OR public.is_org_admin(auth.uid(), organization_id)))
        OR (organization_id IS NULL AND created_by = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- 5f. cc_event_contacts -- the join table
-- ---------------------------------------------------------------------------
-- On INSERT one EXISTS does two jobs: it proves the event is visible to you, AND it
-- proves the contact belongs to the SAME coverage row. Without the second half you
-- could tag a contact from a different company, which would corrupt that contact's
-- derived "last met" date -- the one number this table exists to produce.
DROP POLICY IF EXISTS "Event contacts follow the event" ON public.cc_event_contacts;
CREATE POLICY "Event contacts follow the event"
    ON public.cc_event_contacts FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_contacts.event_id)
    );

DROP POLICY IF EXISTS "Event writers can tag contacts" ON public.cc_event_contacts;
CREATE POLICY "Event writers can tag contacts"
    ON public.cc_event_contacts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM public.cc_events e
              JOIN public.cc_contacts c ON c.coverage_id = e.coverage_id
             WHERE e.id = cc_event_contacts.event_id
               AND c.id = cc_event_contacts.contact_id
        )
    );

-- No UPDATE policy: the table is (event_id, contact_id) and nothing else, so an update
-- is a delete plus an insert.

DROP POLICY IF EXISTS "Event writers can untag contacts" ON public.cc_event_contacts;
CREATE POLICY "Event writers can untag contacts"
    ON public.cc_event_contacts FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_contacts.event_id)
    );

-- ============================================================================
-- 6. SEED THE GLOBAL BROKER LIST
-- ============================================================================
-- organization_id NULL + created_by NULL = global. cc_brokers_20_stamp would normally
-- overwrite both columns, but this runs as the migration owner with auth.uid() IS NULL,
-- so cc_stamp_owner returns early and leaves them NULL -- exactly the global shape.
-- Idempotent, so replaying the migration is safe.
INSERT INTO public.cc_brokers (organization_id, created_by, name)
SELECT NULL, NULL, s.v
  FROM (VALUES
        ('Kotak'),
        ('360 ONE'),
        ('Emkay'),
        ('Nuvama'),
        ('ICICI Securities'),
        ('IIFL'),
        ('Equirus')
  ) AS s(v)
 WHERE NOT EXISTS (
       SELECT 1 FROM public.cc_brokers b
        WHERE b.organization_id IS NULL AND b.created_by IS NULL
          AND lower(btrim(b.name)) = lower(btrim(s.v))
 );

-- ============================================================================
-- 7. THE ACTIVITY FEED VIEW
-- ============================================================================
-- WHY THE VERSION GATE. A plain view in Supabase is owned by `postgres` and runs with
-- the OWNER's rights, bypassing RLS on every underlying table. Here that would be a
-- cross-organisation leak of confidential research. `WITH (security_invoker = true)`
-- fixes it but needs PG15+. This repo ships SQL that gets pasted into a console, so
-- fail loudly rather than silently create an unsafe view.
--
-- This repo already has owner-rights views (v_posts_with_my_vote, v_stocks_with_my_vote
-- in migration_reddit_voting_system.sql:362-394). Do not copy that pattern here.
DO $cc_feed$
BEGIN
    IF current_setting('server_version_num')::int < 150000 THEN
        RAISE EXCEPTION
          'Command Center needs PostgreSQL 15+ for WITH (security_invoker = true). '
          'This instance is %. A view without it is owned by postgres and BYPASSES '
          'RLS on cc_events -- every organization would read every other organization. '
          'Upgrade the project, or drop the view and use cc_search_events() only.',
          current_setting('server_version');
    END IF;

    EXECUTE $ddl$
    CREATE OR REPLACE VIEW public.cc_activity_feed
    WITH (security_invoker = true) AS
    SELECT
        e.id                AS event_id,
        e.organization_id,
        e.coverage_id,
        cov.ticker,
        cov.company_name,
        cov.sector,
        cov.lead_analyst_id,
        e.kind,
        e.subtype,
        e.title,
        e.event_date,
        e.is_scheduled,
        e.attendance,
        e.period_label,
        e.thesis_impact,
        e.kta,
        e.open_questions,
        e.search_tsv,
        e.broker_id,
        b.name              AS broker_name,
        e.analyst_id,
        pa.username         AS analyst_username,
        e.created_by,
        pc.username         AS created_by_username,
        e.created_at,
        e.updated_at,
        (SELECT count(*) FROM public.cc_event_attachments a WHERE a.event_id = e.id)
                            AS attachment_count,
        (SELECT count(*) FROM public.cc_event_contacts ec WHERE ec.event_id = e.id)
                            AS contact_count
      FROM public.cc_events   e
      JOIN public.cc_coverage cov ON cov.id = e.coverage_id
      LEFT JOIN public.profiles   pa ON pa.id = e.analyst_id
      LEFT JOIN public.profiles   pc ON pc.id = e.created_by
      LEFT JOIN public.cc_brokers b  ON b.id  = e.broker_id
    $ddl$;
END
$cc_feed$;

REVOKE ALL ON public.cc_activity_feed FROM PUBLIC, anon;
GRANT SELECT ON public.cc_activity_feed TO authenticated, service_role;

COMMENT ON VIEW public.cc_activity_feed IS
    'security_invoker: RLS on cc_events / cc_coverage / cc_brokers / profiles applies '
    'to the CALLER. Do not recreate this view without WITH (security_invoker = true) -- '
    'a postgres-owned view here is a cross-organisation data leak.';

-- ============================================================================
-- 8. RANKED FULL-TEXT SEARCH OVER KTA BODIES
-- ============================================================================
-- A view is the right tool for paging the feed, but the WRONG tool for ranked search:
-- PostgREST can filter a tsvector with `fts` but cannot ORDER BY ts_rank_cd(...) or
-- return ts_headline snippets.
--
-- SECURITY INVOKER is the default for functions; it is stated explicitly so nobody
-- "fixes" it to DEFINER. Every table read below is RLS-protected and auth.uid() inside
-- the function is the caller's, so this adds ranking and highlighting WITHOUT adding an
-- authorization surface.
CREATE OR REPLACE FUNCTION public.cc_search_events(
    p_query       TEXT,
    p_coverage_id UUID     DEFAULT NULL,
    p_kinds       TEXT[]   DEFAULT NULL,
    p_analyst_id  UUID     DEFAULT NULL,
    p_from        DATE     DEFAULT NULL,
    p_to          DATE     DEFAULT NULL,
    p_limit       INT      DEFAULT 50,
    p_offset      INT      DEFAULT 0
)
RETURNS TABLE (
    event_id         UUID,
    coverage_id      UUID,
    ticker           TEXT,
    company_name     TEXT,
    kind             TEXT,
    title            TEXT,
    event_date       DATE,
    analyst_id       UUID,
    analyst_username TEXT,
    broker_name      TEXT,
    snippet          TEXT,
    rank             REAL
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
    WITH q AS (
        SELECT NULLIF(btrim(coalesce(p_query, '')), '') AS raw
    ), t AS (
        SELECT CASE WHEN q.raw IS NULL THEN NULL
                    ELSE websearch_to_tsquery('english'::regconfig, q.raw) END AS tsq
          FROM q
    )
    SELECT
        e.id, e.coverage_id, cov.ticker, cov.company_name, e.kind, e.title, e.event_date,
        e.analyst_id,
        pa.username,
        b.name,
        CASE WHEN t.tsq IS NULL THEN left(coalesce(e.kta, e.open_questions, e.title), 180)
             ELSE ts_headline('english'::regconfig,
                              coalesce(e.kta, e.open_questions, e.title),
                              t.tsq,
                              -- STX/ETX control characters, not '<mark>'. ts_headline does NOT
                    -- HTML-escape the source text, so emitting HTML tags here would let
                    -- anyone who can write a KTA inject markup into every colleague's
                    -- browser. These two bytes cannot occur in pasted notes, and the
                    -- client splits on them and renders text nodes.
                    'MaxFragments=2, MinWords=8, MaxWords=24, ' ||
                    'StartSel=' || chr(2) || ', StopSel=' || chr(3))
        END,
        CASE WHEN t.tsq IS NULL THEN 0::real ELSE ts_rank_cd(e.search_tsv, t.tsq) END
      FROM public.cc_events e
      CROSS JOIN t
      JOIN public.cc_coverage cov ON cov.id = e.coverage_id
      LEFT JOIN public.profiles   pa ON pa.id = e.analyst_id
      LEFT JOIN public.cc_brokers b  ON b.id  = e.broker_id
     WHERE (t.tsq IS NULL OR e.search_tsv @@ t.tsq)
       AND (p_coverage_id IS NULL OR e.coverage_id = p_coverage_id)
       AND (p_kinds       IS NULL OR e.kind = ANY(p_kinds))
       AND (p_analyst_id  IS NULL OR e.analyst_id = p_analyst_id)
       AND (p_from        IS NULL OR e.event_date >= p_from)
       AND (p_to          IS NULL OR e.event_date <= p_to)
     ORDER BY
        CASE WHEN t.tsq IS NULL THEN 0::real ELSE ts_rank_cd(e.search_tsv, t.tsq) END DESC,
        e.event_date DESC,
        e.created_at DESC
     LIMIT  greatest(1, least(coalesce(p_limit, 50), 200))
    OFFSET greatest(0, coalesce(p_offset, 0));
$fn$;

GRANT EXECUTE ON FUNCTION
    public.cc_search_events(TEXT,UUID,TEXT[],UUID,DATE,DATE,INT,INT)
    TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION
    public.cc_search_events(TEXT,UUID,TEXT[],UUID,DATE,DATE,INT,INT) FROM anon;

-- ============================================================================
-- 9. PRIVATE STORAGE BUCKET
-- ============================================================================
-- PRIVATE, unlike recommendation-images and community-images. Broker research is
-- licensed material; a public bucket makes every object a guessable, permanent,
-- unauthenticated URL. Reads go through createSignedUrl().
DO $cc_bucket$
BEGIN
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE id = 'command-center') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('command-center', 'command-center', false,
                52428800,  -- 50 MB, the same ceiling as research-reports
                ARRAY['application/pdf','image/png','image/jpeg','image/webp',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      'application/vnd.ms-excel',
                      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'text/csv','text/plain','text/markdown']);
        RAISE NOTICE 'Storage bucket "command-center" created';
    ELSE
        RAISE NOTICE 'Storage bucket "command-center" already exists';
    END IF;
END
$cc_bucket$;

-- PATH CONVENTION -- the policies below are only enforceable because of it:
--   org  : {organization_id}/{coverage_id}/{event_id}/{stamp}-{filename}
--   solo : user/{user_id}/{coverage_id}/{event_id}/{stamp}-{filename}
-- foldername(name)[1] is the tenant discriminator. The literal 'user' can never collide
-- with an organization_id because org ids are UUIDs. The solo shape needs that extra
-- segment precisely BECAUSE its tenant key is a user id rather than an org id --
-- without it, folder[1] would mean two different things and no single policy could
-- read it. The {stamp}- filename prefix stops two analysts overwriting each other's
-- upload of "presentation.pdf" against the same event.
--
-- cc_event_attachments' INSERT policy restates this same rule as a LIKE. Keep the two
-- in sync: storage.objects and that table cannot see each other.

DROP POLICY IF EXISTS "cc: upload to own org or own solo folder" ON storage.objects;
DROP POLICY IF EXISTS "cc: read own org or own solo folder"      ON storage.objects;
DROP POLICY IF EXISTS "cc: update own uploads"                   ON storage.objects;
DROP POLICY IF EXISTS "cc: delete own uploads or org admin"      ON storage.objects;

-- NOTE: every policy pins bucket_id. storage.objects policies are PERMISSIVE and OR
-- together across ALL buckets -- one that forgets bucket_id would grant the same access
-- to research-reports and community-images.
CREATE POLICY "cc: upload to own org or own solo folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'command-center'
    AND (
        -- get_user_organization_id returns NULL for a solo user, and `x = NULL` is
        -- NULL rather than true, so this branch fails closed for them instead of
        -- matching some literal string.
        (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
        OR (
            (storage.foldername(name))[1] = 'user'
            AND (storage.foldername(name))[2] = auth.uid()::text
            AND public.get_user_organization_id(auth.uid()) IS NULL
        )
    )
    AND (storage.foldername(name))[3] IS NOT NULL  -- coverage + event segments present
);

-- SELECT is what createSignedUrl() checks before it mints a token.
CREATE POLICY "cc: read own org or own solo folder"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'command-center'
    AND (
        (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
        OR (
            (storage.foldername(name))[1] = 'user'
            AND (storage.foldername(name))[2] = auth.uid()::text
            AND public.get_user_organization_id(auth.uid()) IS NULL
        )
    )
);

CREATE POLICY "cc: update own uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'command-center' AND owner = auth.uid());

CREATE POLICY "cc: delete own uploads or org admin"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'command-center'
    AND (
        owner = auth.uid()
        OR public.is_org_admin(
               auth.uid(),
               nullif((storage.foldername(name))[1], 'user')::uuid)
    )
);

-- ============================================================================
-- 10. DERIVED CONTACT RECENCY
-- ============================================================================
-- cc_contacts has no date_met column on purpose: a stored copy goes stale the moment
-- someone back-dates a meeting or deletes one, and there is no single write path that
-- could keep it honest.
--
-- "Last met" excludes scheduled rows and future dates -- a meeting on the calendar for
-- next Tuesday is not a meeting you have had. next_meeting_on surfaces those
-- separately, which is the value the UI wants next to it.
--
-- The LEFT JOIN LATERAL ... ORDER BY ... LIMIT 1 form is what makes this cheap, and it
-- returns the event id alongside the date so the UI can link "last met 14 Mar" straight
-- to that meeting's KTA -- which a max() aggregate cannot.
--
-- DO NOT MATERIALIZE THIS VIEW. Matviews ignore RLS entirely (security_invoker does not
-- apply to them) and PostgREST exposes them like tables, so a materialized version
-- would serve every desk's contact book to every user.
DO $cc_lastmet$
BEGIN
    EXECUTE $ddl$
    CREATE OR REPLACE VIEW public.cc_contact_last_met
    WITH (security_invoker = true) AS
    SELECT
        c.id              AS contact_id,
        c.coverage_id,
        c.organization_id,
        c.name,
        c.designation,
        c.designation_other,
        c.email,
        c.phone,
        c.created_by,
        c.created_at,
        c.updated_at,
        m.last_met_on,
        m.last_event_id,
        n.next_meeting_on
      FROM public.cc_contacts c
      LEFT JOIN LATERAL (
          SELECT e.event_date AS last_met_on,
                 e.id         AS last_event_id
            FROM public.cc_event_contacts ec
            JOIN public.cc_events e ON e.id = ec.event_id
           WHERE ec.contact_id = c.id
             AND e.is_scheduled = FALSE
             AND e.event_date <= CURRENT_DATE
           ORDER BY e.event_date DESC, e.created_at DESC
           LIMIT 1
      ) m ON TRUE
      LEFT JOIN LATERAL (
          SELECT min(e.event_date) AS next_meeting_on
            FROM public.cc_event_contacts ec
            JOIN public.cc_events e ON e.id = ec.event_id
           WHERE ec.contact_id = c.id
             AND e.is_scheduled = TRUE
             AND e.event_date >= CURRENT_DATE
      ) n ON TRUE
    $ddl$;
END
$cc_lastmet$;

REVOKE ALL ON public.cc_contact_last_met FROM PUBLIC, anon;
GRANT SELECT ON public.cc_contact_last_met TO authenticated, service_role;

COMMENT ON VIEW public.cc_contact_last_met IS
    'security_invoker: RLS on cc_contacts / cc_events applies to the CALLER. Never '
    'convert this to a MATERIALIZED VIEW -- matviews ignore RLS and PostgREST would '
    'serve every desk''s contact book to every user.';

-- ============================================================================
-- 10b. THE COVERAGE BOARD
-- ============================================================================
-- Coverage health -- "how long since anyone touched this name" -- is the whole point of
-- the board, and it is an aggregate over cc_events. Computing it in the client would
-- mean shipping every event row in the organisation to every board render; computing it
-- here means one indexed query.
--
-- Columns are listed explicitly rather than `c.*` so that adding a column to
-- cc_coverage later does not make CREATE OR REPLACE VIEW fail ("cannot change name of
-- view column"). Add new columns to the END of this list.
DO $cc_board$
BEGIN
    EXECUTE $ddl$
    CREATE OR REPLACE VIEW public.cc_coverage_board
    WITH (security_invoker = true) AS
    SELECT
        c.id,
        c.organization_id,
        c.created_by,
        c.ticker,
        c.company_name,
        c.market,
        c.understanding_level,
        c.model_status,
        c.corporate_address,
        c.sector,
        c.lead_analyst_id,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at,
        pl.username                       AS lead_analyst_username,
        agg.last_interaction_on,
        -- date - date yields an integer number of days in Postgres.
        CASE WHEN agg.last_interaction_on IS NULL THEN NULL
             ELSE (CURRENT_DATE - agg.last_interaction_on) END
                                          AS days_since_interaction,
        COALESCE(agg.event_count, 0)      AS event_count,
        COALESCE(agg.broker_report_count, 0) AS broker_report_count,
        cl.period_label                   AS latest_concall_period,
        cl.attendance                     AS latest_concall_attendance,
        ar.period_label                   AS latest_annual_report_period,
        ar.attendance                     AS latest_annual_report_attendance,
        nx.title                          AS next_scheduled_title,
        nx.event_date                     AS next_scheduled_on,
        cn.contact_count
      FROM public.cc_coverage c
      LEFT JOIN public.profiles pl ON pl.id = c.lead_analyst_id
      LEFT JOIN LATERAL (
          SELECT max(e.event_date) FILTER (
                     WHERE e.is_scheduled = FALSE AND e.event_date <= CURRENT_DATE
                 )                                        AS last_interaction_on,
                 count(*) FILTER (WHERE e.is_scheduled = FALSE) AS event_count,
                 count(*) FILTER (WHERE e.kind = 'broker_report') AS broker_report_count
            FROM public.cc_events e
           WHERE e.coverage_id = c.id
      ) agg ON TRUE
      LEFT JOIN LATERAL (
          SELECT e.period_label, e.attendance
            FROM public.cc_events e
           WHERE e.coverage_id = c.id AND e.kind = 'concall' AND e.is_scheduled = FALSE
           ORDER BY e.event_date DESC
           LIMIT 1
      ) cl ON TRUE
      LEFT JOIN LATERAL (
          SELECT e.period_label, e.attendance
            FROM public.cc_events e
           WHERE e.coverage_id = c.id AND e.kind = 'annual_report' AND e.is_scheduled = FALSE
           ORDER BY e.event_date DESC
           LIMIT 1
      ) ar ON TRUE
      LEFT JOIN LATERAL (
          SELECT e.title, e.event_date
            FROM public.cc_events e
           WHERE e.coverage_id = c.id AND e.is_scheduled = TRUE AND e.event_date >= CURRENT_DATE
           ORDER BY e.event_date ASC
           LIMIT 1
      ) nx ON TRUE
      LEFT JOIN LATERAL (
          SELECT count(*) AS contact_count
            FROM public.cc_contacts ct
           WHERE ct.coverage_id = c.id
      ) cn ON TRUE
    $ddl$;
END
$cc_board$;

REVOKE ALL ON public.cc_coverage_board FROM PUBLIC, anon;
GRANT SELECT ON public.cc_coverage_board TO authenticated, service_role;

COMMENT ON VIEW public.cc_coverage_board IS
    'security_invoker: RLS on cc_coverage / cc_events / cc_contacts / profiles applies '
    'to the CALLER. Do not recreate this view without WITH (security_invoker = true).';

-- ============================================================================
-- 11. RELOAD THE POSTGREST SCHEMA CACHE
-- ============================================================================
-- Mandatory. Without it PostgREST answers PGRST205 ("Could not find the table in the
-- schema cache") for minutes after the DDL lands, which looks exactly like the
-- migration not having run.
NOTIFY pgrst, 'reload schema';
