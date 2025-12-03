// Test suite for parse-research-report Edge Function
// Run with: deno test --allow-net --allow-env

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parse-research-report`;

interface TestContext {
  authToken: string;
  reportId: string;
  geminiFileUri: string;
}

async function setupTestContext(): Promise<TestContext> {
  const authToken = Deno.env.get('TEST_AUTH_TOKEN') || '';
  const reportId = Deno.env.get('TEST_REPORT_ID') || '';
  const geminiFileUri = Deno.env.get('TEST_GEMINI_FILE_URI') || '';

  if (!authToken || !reportId || !geminiFileUri) {
    throw new Error('Test environment variables not set');
  }

  return { authToken, reportId, geminiFileUri };
}

Deno.test('Parse Research Report - Success', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      report_id: context.reportId,
      gemini_file_uri: context.geminiFileUri,
    }),
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.parsed_data);
  assertEquals(data.status, 'parsed');

  // Verify required fields are present
  assertExists(data.parsed_data.summary_sentence);
  assertExists(data.parsed_data.one_paragraph_thesis);
  assertExists(data.parsed_data.three_key_insights);
  assertExists(data.parsed_data.three_risks);
  assertExists(data.parsed_data.three_catalysts);

  console.log('✓ Parse test passed');
  console.log('  Parse time:', data.parse_time_ms, 'ms');
});

Deno.test('Parse Research Report - Missing Report ID', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 400);

  const data = await response.json();
  assertEquals(data.error, 'report_id is required');

  console.log('✓ Missing report ID test passed');
});

Deno.test('Parse Research Report - Already Parsed', async () => {
  const context = await setupTestContext();

  // Call parse twice
  await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      report_id: context.reportId,
      gemini_file_uri: context.geminiFileUri,
    }),
  });

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      report_id: context.reportId,
      gemini_file_uri: context.geminiFileUri,
    }),
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertEquals(data.status, 'already_parsed');

  console.log('✓ Already parsed test passed');
});

Deno.test('Parse Research Report - Verify JSON Structure', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      report_id: context.reportId,
      gemini_file_uri: context.geminiFileUri,
    }),
  });

  const data = await response.json();
  const parsed = data.parsed_data;

  // Verify structure matches expected schema
  const expectedFields = [
    'report_id',
    'title',
    'sector_outlook',
    'key_drivers',
    'company_ratings',
    'valuation_summary',
    'risks',
    'catalysts',
    'summary_sentence',
    'one_paragraph_thesis',
    'three_key_insights',
    'three_risks',
    'three_catalysts',
    'three_actionables',
    'citations',
  ];

  for (const field of expectedFields) {
    assertExists(parsed[field], `Field ${field} should exist`);
  }

  console.log('✓ JSON structure test passed');
});

console.log('\n=== Parse Research Report Tests ===');

