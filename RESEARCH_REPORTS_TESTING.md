# Research Reports Testing Guide

## Overview

This document describes how to test the RAPID RAG research intelligence layer.

## Test Environment Setup

### 1. Set Environment Variables

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export GEMINI_API_KEY="your-gemini-api-key"
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Test user credentials
export TEST_AUTH_TOKEN="test-user-jwt-token"
export TEST_ORG_ID="test-org-uuid"
export TEST_USER_ID="test-user-uuid"
export TEST_REPORT_ID="test-report-uuid"
export TEST_GEMINI_FILE_URI="gemini-file-uri"

# Multi-org testing
export TEST_ORG_A_ID="org-a-uuid"
export TEST_ORG_A_TOKEN="org-a-token"
export TEST_ORG_A_USER_ID="org-a-user-uuid"
export TEST_ORG_B_ID="org-b-uuid"
export TEST_ORG_B_TOKEN="org-b-token"
export TEST_ORG_B_USER_ID="org-b-user-uuid"
```

### 2. Create Test Organizations

```sql
-- Create two test organizations for RLS testing
INSERT INTO organizations (id, name, join_code, created_by)
VALUES 
  ('org-a-uuid', 'Test Org A', 'TESTA123', 'org-a-user-uuid'),
  ('org-b-uuid', 'Test Org B', 'TESTB456', 'org-b-user-uuid');

-- Create memberships
INSERT INTO user_organization_membership (user_id, organization_id, role)
VALUES
  ('org-a-user-uuid', 'org-a-uuid', 'admin'),
  ('org-b-user-uuid', 'org-b-uuid', 'admin');
```

## Running Tests

### Edge Function Tests

```bash
# Upload function tests
cd supabase/functions/upload-research-report
deno test --allow-net --allow-env --allow-read test.ts

# Parse function tests
cd supabase/functions/parse-research-report
deno test --allow-net --allow-env test.ts

# Query/RAG function tests
cd supabase/functions/query-research-rag
deno test --allow-net --allow-env test.ts

# RLS Security tests
cd supabase/functions/_shared
deno test --allow-net --allow-env rls-security-test.ts
```

### Integration Tests

```bash
# Run all tests
deno test --allow-net --allow-env --allow-read supabase/functions/*/test.ts
```

## Manual Testing Checklist

### PDF Upload Flow
- [ ] Upload a valid PDF file
- [ ] Verify file appears in Supabase Storage with correct path: `{org_id}/{report_id}/{filename}`
- [ ] Verify database record created with status 'uploaded'
- [ ] Verify Gemini indexing completes (status changes to 'indexed')
- [ ] Verify parsing completes (status changes to 'parsed')
- [ ] Check that parsed JSON structure matches schema

### Parsing Accuracy
- [ ] Upload a sample research report
- [ ] Verify all required fields are extracted
- [ ] Check that citations include page numbers
- [ ] Validate company ratings format
- [ ] Verify financial tables are captured

### RAG Query
- [ ] Query: "What are the key risks?"
- [ ] Verify answer is relevant
- [ ] Check citations are present with page numbers
- [ ] Verify relevant_reports list is populated
- [ ] Test with sector filter
- [ ] Test with ticker filter
- [ ] Test with date range filter

### Multi-Org Security
- [ ] Create reports in Org A
- [ ] Login as Org B user
- [ ] Verify Org B cannot see Org A reports in library
- [ ] Verify RAG queries from Org B don't include Org A reports
- [ ] Try to access Org A PDF directly (should fail)
- [ ] Verify upload goes to correct org folder

### Performance
- [ ] Upload file < 10MB: Should complete in < 7s
- [ ] Parsing: Should complete in < 30s for typical report
- [ ] RAG query: Should return in < 3s
- [ ] Multiple simultaneous uploads: System should handle gracefully

### UI/UX Testing
- [ ] Research Library page loads reports
- [ ] Filters work correctly (sector, ticker, search)
- [ ] Upload modal opens and accepts PDFs
- [ ] Upload progress shows correctly
- [ ] Report detail page displays PDF and parsed data
- [ ] Tabs switch correctly
- [ ] RAG search bar returns results
- [ ] Citations are clickable and navigate to correct report

## Expected Results

### Successful Upload Response
```json
{
  "success": true,
  "report_id": "uuid",
  "title": "Report Title",
  "status": "uploaded",
  "message": "Report uploaded successfully. Indexing and parsing in progress.",
  "report": {
    "id": "uuid",
    "org_id": "uuid",
    "analyst_id": "uuid",
    "title": "Report Title",
    "upload_status": "uploaded",
    ...
  }
}
```

### Successful Parse Response
```json
{
  "success": true,
  "report_id": "uuid",
  "status": "parsed",
  "parsed_data": {
    "title": "...",
    "sector_outlook": "...",
    "three_key_insights": [...],
    "citations": [...]
  },
  "parse_time_ms": 15000
}
```

### Successful RAG Query Response
```json
{
  "answer": "Based on the research reports...",
  "citations": [
    {
      "excerpt": "Quote from report",
      "page": 10,
      "report_id": "uuid",
      "title": "Report Title"
    }
  ],
  "relevant_reports": [...],
  "query_time_ms": 2500,
  "total_reports_searched": 5
}
```

## Troubleshooting

### Upload Fails
- Check SUPABASE_URL and storage bucket exists
- Verify auth token is valid
- Check file size < 50MB
- Ensure file is PDF format

### Parsing Fails
- Check GEMINI_API_KEY is set
- Verify Gemini file was uploaded successfully
- Check Edge Function logs for errors
- Ensure prompt is valid JSON

### RAG Query Returns No Results
- Verify reports exist and are parsed
- Check org_id filter is applied correctly
- Ensure Gemini file URIs are valid
- Check filters aren't too restrictive

### RLS Issues
- Verify user_organization_membership exists
- Check RLS policies are enabled
- Ensure auth token includes correct user_id
- Test with service role key (bypasses RLS) to isolate issue

## Performance Benchmarks

| Operation | Target | Acceptable | Poor |
|-----------|--------|------------|------|
| Upload (5MB) | < 3s | < 7s | > 10s |
| Gemini Index | < 5s | < 10s | > 15s |
| Parse | < 15s | < 30s | > 60s |
| RAG Query | < 2s | < 5s | > 10s |

## Security Checklist

- [ ] RLS policies prevent cross-org data access
- [ ] Storage bucket paths are org-scoped
- [ ] Auth tokens are validated
- [ ] Gemini API keys are not exposed to client
- [ ] Service role key is only used in Edge Functions
- [ ] File uploads are validated (type, size)
- [ ] SQL injection is prevented (parameterized queries)
- [ ] CORS headers are configured correctly

