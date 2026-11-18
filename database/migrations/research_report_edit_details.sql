-- Let any member of a report's organization correct its broker, title and sector.
--
-- The row-level UPDATE policy on research_reports only admits the analyst who uploaded the
-- report, so a desk could not fix a mis-filed broker note someone else uploaded. Widening
-- that policy would let members rewrite every column (upload_status, storage_path, parsed,
-- the Gemini ids), so this function changes only the two descriptive fields instead.
-- The broker is not a column: it is the "[Broker]" prefix of the title, which is how the
-- workspace's folders and the RAG already read it.
CREATE OR REPLACE FUNCTION public.update_research_report_details(
  p_report_id UUID,
  p_title TEXT,
  p_sector TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT := btrim(coalesce(p_title, ''));
BEGIN
  IF v_title = '' THEN
    RAISE EXCEPTION 'A report needs a title' USING ERRCODE = '22023';
  END IF;
  IF length(v_title) > 300 THEN
    RAISE EXCEPTION 'The title is too long' USING ERRCODE = '22023';
  END IF;

  UPDATE public.research_reports r
     SET title = v_title,
         sector = nullif(btrim(coalesce(p_sector, '')), ''),
         updated_at = now()
   WHERE r.id = p_report_id
     AND r.org_id IN (
       SELECT m.organization_id
         FROM public.user_organization_membership m
        WHERE m.user_id = auth.uid()
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found in your organization' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_research_report_details(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_research_report_details(UUID, TEXT, TEXT) TO authenticated;
