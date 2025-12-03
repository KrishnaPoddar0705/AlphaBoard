// Test suite for upload-research-report Edge Function
// Run with: deno test --allow-net --allow-env --allow-read

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/upload-research-report`;

// Mock PDF content for testing
const mockPdfContent = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, // %PDF header
  0x2d, 0x31, 0x2e, 0x34, // -1.4
  // ... truncated for brevity
]);

interface TestContext {
  authToken: string;
  orgId: string;
  userId: string;
}

async function setupTestContext(): Promise<TestContext> {
  // This would normally create a test user and organization
  // For this example, we'll assume these are set via environment variables
  
  const authToken = Deno.env.get('TEST_AUTH_TOKEN') || '';
  const orgId = Deno.env.get('TEST_ORG_ID') || '';
  const userId = Deno.env.get('TEST_USER_ID') || '';

  if (!authToken || !orgId || !userId) {
    throw new Error('Test environment variables not set. Set TEST_AUTH_TOKEN, TEST_ORG_ID, TEST_USER_ID');
  }

  return { authToken, orgId, userId };
}

Deno.test('Upload Research Report - Success', async () => {
  const context = await setupTestContext();

  // Create form data
  const formData = new FormData();
  const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
  formData.append('file', blob, 'test_report.pdf');
  formData.append('title', 'Test Research Report');
  formData.append('sector', 'Technology');
  formData.append('tickers', 'AAPL,MSFT');

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
    },
    body: formData,
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.report_id);
  assertEquals(data.success, true);
  assertExists(data.report);

  console.log('✓ Upload test passed:', data.report_id);
});

Deno.test('Upload Research Report - Missing File', async () => {
  const context = await setupTestContext();

  const formData = new FormData();
  formData.append('title', 'Test Report');

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
    },
    body: formData,
  });

  assertEquals(response.status, 400);

  const data = await response.json();
  assertExists(data.error);

  console.log('✓ Missing file test passed');
});

Deno.test('Upload Research Report - Invalid File Type', async () => {
  const context = await setupTestContext();

  const formData = new FormData();
  const blob = new Blob(['test content'], { type: 'text/plain' });
  formData.append('file', blob, 'test.txt');
  formData.append('title', 'Test Report');

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
    },
    body: formData,
  });

  assertEquals(response.status, 400);

  const data = await response.json();
  assertEquals(data.error, 'Only PDF files are supported');

  console.log('✓ Invalid file type test passed');
});

Deno.test('Upload Research Report - Unauthorized', async () => {
  const formData = new FormData();
  const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
  formData.append('file', blob, 'test_report.pdf');
  formData.append('title', 'Test Report');

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    body: formData,
  });

  assertEquals(response.status, 401);

  console.log('✓ Unauthorized test passed');
});

console.log('\n=== Upload Research Report Tests ===');
console.log('Run all tests with: deno test --allow-net --allow-env --allow-read');

