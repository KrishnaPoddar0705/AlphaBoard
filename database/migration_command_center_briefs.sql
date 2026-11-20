-- ============================================================================
-- Command Center: daily and weekly briefs for org admins
-- ============================================================================
--
-- A brief condenses an organization's newly logged entries into bullets plus a short
-- two-host podcast. The backend writes one per org per slot from its scheduler:
--
--   daily   every day at 08:00 IST, covering the 24 hours before
--   weekly  Mondays at 08:00 IST, covering the 7 days before
--
-- (organization_id, kind, brief_date) is unique, so a rerun or a startup catch-up
-- replaces the slot's brief instead of adding a second one.
--
-- Only org admins can read briefs: they summarise everyone's work, including teams a
-- PM or analyst cannot otherwise see. Writes are service-role only.
--
-- The audio sits in the private `cc-briefs` bucket at <organization_id>/<file>, and the
-- same rule applies to it: an admin of that org can mint a signed URL, nobody else.
--
-- Safe to run more than once.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cc_briefs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    kind             TEXT        NOT NULL CHECK (kind IN ('daily', 'weekly')),
    -- The slot's date in IST: the morning it was made for.
    brief_date       DATE        NOT NULL,
    period_start     TIMESTAMPTZ NOT NULL,
    period_end       TIMESTAMPTZ NOT NULL,
    headline         TEXT,
    bullets          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    -- Counted in code, not by the model: entries, companies, analysts, log-type mix,
    -- House View tally and the latest view per stock.
    stats            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- [{ "speaker": "...", "text": "..." }]
    script           JSONB,
    audio_path       TEXT,
    audio_seconds    NUMERIC,
    model            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, kind, brief_date)
);

CREATE INDEX IF NOT EXISTS cc_briefs_org_kind_date
    ON public.cc_briefs (organization_id, kind, brief_date DESC);

ALTER TABLE public.cc_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cc_briefs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cc_briefs TO authenticated;
GRANT ALL ON public.cc_briefs TO service_role;

DROP POLICY IF EXISTS cc_briefs_admin_select ON public.cc_briefs;
CREATE POLICY cc_briefs_admin_select ON public.cc_briefs
    FOR SELECT TO authenticated
    USING (public.is_org_admin(auth.uid(), organization_id));

COMMENT ON TABLE public.cc_briefs IS
    'Daily (08:00 IST) and weekly (Mon 08:00 IST) AI briefs of an org''s new log entries; admins only.';

-- Audio --------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('cc-briefs', 'cc-briefs', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS cc_briefs_audio_admin_read ON storage.objects;
CREATE POLICY cc_briefs_audio_admin_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'cc-briefs'
        AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
    );

COMMIT;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT organization_id, kind, brief_date, jsonb_array_length(bullets), audio_path
--   FROM public.cc_briefs ORDER BY brief_date DESC LIMIT 10;
-- ============================================================================
