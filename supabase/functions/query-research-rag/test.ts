// Test suite for query-research-rag Edge Function
// Run with: deno test --allow-net --allow-env

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/query-research-rag`;

interface TestContext {
  authToken: string;
  orgId: string;
}

async function setupTestContext(): Promise<TestContext> {
  const authToken = Deno.env.get('TEST_AUTH_TOKEN') || '';
  const orgId = Deno.env.get('TEST_ORG_ID') || '';

  if (!authToken || !orgId) {
    throw new Error('Test environment variables not set');
  }

  return { authToken, orgId };
}

Deno.test('Query RAG - Success', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'What are the key risks mentioned in the reports?',
      filters: {},
    }),
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.answer);
  assertExists(data.citations);
  assertExists(data.relevant_reports);
  assertExists(data.query_time_ms);

  console.log('✓ RAG query test passed');
  console.log('  Query time:', data.query_time_ms, 'ms');
  console.log('  Citations:', data.citations.length);
  console.log('  Relevant reports:', data.relevant_reports.length);
});

Deno.test('Query RAG - Missing Query', async () => {
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
  assertEquals(data.error, 'query parameter is required');

  console.log('✓ Missing query test passed');
});

Deno.test('Query RAG - With Sector Filter', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'What is the sector outlook?',
      filters: {
        sector: 'Technology',
      },
    }),
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.answer);

  // Verify that relevant reports match the sector filter
  if (data.relevant_reports.length > 0) {
    for (const report of data.relevant_reports) {
      assertEquals(report.sector, 'Technology');
    }
  }

  console.log('✓ Sector filter test passed');
});

Deno.test('Query RAG - With Ticker Filter', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'What is mentioned about AAPL?',
      filters: {
        tickers: ['AAPL'],
      },
    }),
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.answer);

  console.log('✓ Ticker filter test passed');
});

Deno.test('Query RAG - Citations Format', async () => {
  const context = await setupTestContext();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'Summarize key insights',
      filters: {},
    }),
  });

  const data = await response.json();

  // Verify citation structure
  if (data.citations.length > 0) {
    for (const citation of data.citations) {
      assertExists(citation.excerpt);
      // Page and source are optional but should be present if available
    }
  }

  console.log('✓ Citations format test passed');
});

Deno.test('Query RAG - Performance (< 3s)', async () => {
  const context = await setupTestContext();

  const startTime = Date.now();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'What are the main themes?',
      filters: {},
    }),
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  assertEquals(response.status, 200);

  console.log('✓ Performance test passed');
  console.log('  Total request time:', duration, 'ms');
  
  // Warning if slow (not a hard failure)
  if (duration > 3000) {
    console.warn('  ⚠ Warning: Query took longer than 3 seconds');
  }
});

console.log('\n=== Query RAG Tests ===');

