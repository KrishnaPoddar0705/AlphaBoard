/**
 * Edge Functions API Client
 * Communicates with Supabase Edge Functions for portfolio operations
 */

import { supabase } from './supabase';

// Get Supabase URL and construct Edge Functions endpoint
const getEdgeFunctionUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  
  if (supabaseUrl) {
    // Remove any trailing slashes and /rest/v1
    const baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    return `${baseUrl}/functions/v1`;
  }
  
  // Fallback for local development
  return 'http://localhost:54321/functions/v1';
};

const EDGE_FUNCTION_URL = getEdgeFunctionUrl();

console.log('Edge Function URL:', EDGE_FUNCTION_URL);

interface Weight {
  ticker: string;
  weight: number;
}

interface SaveWeightsRequest {
  userId: string;
  weights: Weight[];
}

interface RebalanceRequest {
  currentWeights: Weight[];
  targetTicker: string;
  newWeight: number;
}

interface PortfolioReturnsResponse {
  returns: {
    '1M': number;
    '3M': number;
    '6M': number;
    '12M': number;
  };
  volatility: number;
  sharpe: number;
  drawdown: number;
  equityCurve: Array<{ date: string; value: number }>;
  timestamp: string;
}

/**
 * Get auth headers for Edge Function requests
 */
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
}

/**
 * Save portfolio weights to database
 */
export async function saveWeights(userId: string, weights: Weight[]): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/save-weights`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, weights } as SaveWeightsRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save weights');
  }

  return response.json();
}

/**
 * Get portfolio weights from database
 */
export async function getWeights(userId: string): Promise<{ weights: Weight[]; totalWeight: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/get-weights?userId=${userId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get weights');
  }

  return response.json();
}

/**
 * Rebalance portfolio weights
 */
export async function rebalancePortfolioWeights(
  currentWeights: Weight[],
  targetTicker: string,
  newWeight: number
): Promise<{ rebalancedWeights: Weight[] }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/rebalance`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ currentWeights, targetTicker, newWeight } as RebalanceRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to rebalance');
  }

  return response.json();
}

/**
 * Calculate portfolio returns and metrics (ALWAYS FRESH - NO CACHE)
 */
export async function calculatePortfolioReturns(
  userId: string, 
  period: '1M' | '3M' | '6M' | '12M' = '12M'
): Promise<PortfolioReturnsResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/portfolio-returns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, period }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to calculate returns');
  }

  const data = await response.json();
  
  // Validate response structure
  if (!data.returns || typeof data.returns !== 'object') {
    console.error('Invalid response structure:', data);
    throw new Error('Invalid response structure from portfolio-returns function. Expected returns object.');
  }
  
  if (typeof data.volatility !== 'number' || typeof data.sharpe !== 'number' || typeof data.drawdown !== 'number') {
    console.error('Invalid response structure:', data);
    throw new Error('Invalid response structure from portfolio-returns function. Missing required metrics.');
  }
  
  return data as PortfolioReturnsResponse;
}

