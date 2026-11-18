-- Keyword search over report text: one row per PDF page, indexed with Postgres full-text
-- search. Rows are written by the upload-research-report edge function (service role) and by
-- local-db/backfill_report_text.py; clients can only read their own organization's pages.

CREATE TABLE IF NOT EXISTS public.research_report_chunks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id UUID REFERENCES public.research_reports(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  page_number INT NOT NULL,
  content TEXT NOT NULL,
  -- to_tsvector(regconfig, text) is IMMUTABLE; the one-argument form is only STABLE and is
  -- rejected in a generated column.
  search_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (report_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_report_chunks_tsv ON public.research_report_chunks USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_report_chunks_report ON public.research_report_chunks(report_id);

ALTER TABLE public.research_report_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_report_chunks_select" ON public.research_report_chunks
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM public.user_organization_membership WHERE user_id = auth.uid()
    )
  );

-- Ranked keyword search. SECURITY INVOKER (stated on purpose): every table read is RLS
-- protected and auth.uid() is the caller's, so this adds ranking and snippets without adding
-- an authorization surface.
--
-- Matches use websearch_to_tsquery ("exact phrase", -exclude, or). Stemming can mangle
-- tickers and codes (Q2FY26, BEE 5-star), so when the full-text query finds nothing the
-- same text is tried as a plain case-insensitive substring.
--
-- Snippets mark hits with STX/ETX control characters, not <mark>: ts_headline does not
-- HTML-escape the source text, so the client splits on the two bytes and renders text nodes.
CREATE OR REPLACE FUNCTION public.search_report_chunks(
  p_query      TEXT,
  p_report_ids UUID[] DEFAULT NULL,
  p_limit      INT    DEFAULT 20
)
RETURNS TABLE (
  report_id       UUID,
  title           TEXT,
  sector          TEXT,
  tickers         TEXT[],
  page_number     INT,
  snippet         TEXT,
  rank            REAL,
  report_hits     BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH q AS (
    SELECT NULLIF(btrim(coalesce(p_query, '')), '') AS raw
  ), t AS (
    SELECT q.raw,
           CASE WHEN q.raw IS NULL THEN NULL ELSE websearch_to_tsquery('english'::regconfig, q.raw) END AS tsq,
           replace(replace(replace(coalesce(q.raw, ''), '\', '\\'), '%', '\%'), '_', '\_') AS like_term
      FROM q
  ), fts AS MATERIALIZED (
    SELECT c.report_id, c.page_number,
           ts_headline('english'::regconfig, c.content, t.tsq,
                       'MaxFragments=2, MinWords=8, MaxWords=24, StartSel=' || chr(2) || ', StopSel=' || chr(3)) AS snippet,
           ts_rank_cd(c.search_tsv, t.tsq) AS rank
      FROM public.research_report_chunks c
     CROSS JOIN t
     WHERE t.tsq IS NOT NULL
       AND c.search_tsv @@ t.tsq
       AND (p_report_ids IS NULL OR c.report_id = ANY(p_report_ids))
  ), fallback AS (
    SELECT c.report_id, c.page_number,
           substr(c.content, greatest(1, position(lower(t.raw) IN lower(c.content)) - 80), 200) AS snippet,
           0::real AS rank
      FROM public.research_report_chunks c
     CROSS JOIN t
     WHERE t.raw IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fts)
       AND c.content ILIKE '%' || t.like_term || '%'
       AND (p_report_ids IS NULL OR c.report_id = ANY(p_report_ids))
  ), hits AS (
    SELECT * FROM fts UNION ALL SELECT * FROM fallback
  )
  SELECT h.report_id, r.title, r.sector, r.tickers, h.page_number,
         -- fallback snippets carry no markers yet: wrap the first occurrence of the term
         CASE WHEN position(chr(2) IN h.snippet) > 0 THEN h.snippet
              ELSE regexp_replace(h.snippet, '(' || regexp_replace(t.raw, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || ')',
                                  chr(2) || '\1' || chr(3), 'i')
         END,
         h.rank,
         count(*) OVER (PARTITION BY h.report_id)
    FROM hits h
    CROSS JOIN t
    JOIN public.research_reports r ON r.id = h.report_id
   ORDER BY h.rank DESC, h.report_id, h.page_number
   LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$fn$;

GRANT EXECUTE ON FUNCTION public.search_report_chunks(TEXT, UUID[], INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.search_report_chunks(TEXT, UUID[], INT) FROM anon;
