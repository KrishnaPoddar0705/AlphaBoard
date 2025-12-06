/**
 * Edge Functions API Client
 * Communicates with Supabase Edge Functions for portfolio operations
 */

import { supabase } from './supabase';

/**
 * TODO: Backend integration needed to sync Clerk users with Supabase
 * Currently, this function attempts to get Supabase session token.
 * After Clerk-Supabase sync is implemented, this should:
 * 1. Verify Clerk user is authenticated
 * 2. Get or create corresponding Supabase session
 * 3. Return Supabase access token for API calls
 */

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
 * Uses Supabase session token (synced from Clerk authentication)
 */
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.access_token) {
    throw new Error('Not authenticated. Please sign in.');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
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

// ============================================================================
// Organization Edge Functions
// ============================================================================

interface CreateOrganizationRequest {
  name: string;
  adminUserId?: string;
}

interface CreateOrganizationResponse {
  organizationId: string;
  joinCode: string;
  name: string;
}

interface JoinOrganizationRequest {
  userId?: string;
  joinCode: string;
}

interface JoinOrganizationResponse {
  success: boolean;
  organizationId: string;
  organizationName: string;
}

interface OrganizationUser {
  userId: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'analyst';
  joinedAt: string;
}

interface OrganizationUsersResponse {
  analysts: OrganizationUser[];
  admins: OrganizationUser[];
  totalMembers: number;
}

interface AnalystPerformance {
  userId: string;
  username: string | null;
  returns: {
    '1M': number;
    '3M': number;
    '6M': number;
    '12M': number;
  };
  sharpe: number;
  volatility: number;
  drawdown: number;
  totalRecommendations: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
}

interface OrganizationPerformanceResponse {
  analysts: AnalystPerformance[];
  totalAnalysts: number;
}

/**
 * Create a new organization
 */
export async function createOrganization(
  name: string,
  adminUserId?: string,
  clerkUserId?: string
): Promise<CreateOrganizationResponse> {
  // Try to get auth headers, but don't fail if session isn't ready
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const authHeaders = await getAuthHeaders();
    headers = { ...headers, ...authHeaders };
  } catch (error) {
    // If we can't get auth headers but have Clerk user ID, continue anyway
    if (!clerkUserId) {
      throw new Error('Not authenticated. Please sign in.');
    }
    // Use anon key as fallback
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    headers['Authorization'] = `Bearer ${anonKey}`;
    headers['apikey'] = anonKey;
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/create-organization`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, adminUserId, clerkUserId } as CreateOrganizationRequest & { clerkUserId?: string }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to create organization');
  }

  return response.json();
}

/**
 * Join an organization using a join code
 */
export async function joinOrganization(
  joinCode: string,
  userId?: string,
  clerkUserId?: string
): Promise<JoinOrganizationResponse> {
  // Try to get auth headers, but don't fail if session isn't ready
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const authHeaders = await getAuthHeaders();
    headers = { ...headers, ...authHeaders };
  } catch (error) {
    // If we can't get auth headers but have Clerk user ID, continue anyway
    if (!clerkUserId) {
      throw new Error('Not authenticated. Please sign in.');
    }
    // Use anon key as fallback
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    headers['Authorization'] = `Bearer ${anonKey}`;
    headers['apikey'] = anonKey;
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/join-organization`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, joinCode, clerkUserId } as JoinOrganizationRequest & { clerkUserId?: string }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to join organization');
  }

  return response.json();
}

/**
 * Get all users in an organization (admin-only)
 */
export async function getOrganizationUsers(
  organizationId: string
): Promise<OrganizationUsersResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${EDGE_FUNCTION_URL}/get-organization-users?organizationId=${organizationId}`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get organization users');
  }

  return response.json();
}

/**
 * Get performance metrics for all analysts in an organization (admin-only)
 */
export async function getOrganizationPerformance(
  organizationId: string
): Promise<OrganizationPerformanceResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${EDGE_FUNCTION_URL}/get-organization-performance?organizationId=${organizationId}`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get organization performance');
  }

  return response.json();
}

/**
 * Remove an analyst from an organization (admin-only)
 */
export async function removeAnalyst(
  organizationId: string,
  analystUserId: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${EDGE_FUNCTION_URL}/remove-analyst`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ organizationId, analystUserId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove analyst');
  }

  return response.json();
}

/**
 * Update organization settings (admin-only)
 */
export async function updateOrganizationSettings(
  organizationId: string,
  name?: string,
  settings?: Record<string, any>
): Promise<{ success: boolean; organization: any }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${EDGE_FUNCTION_URL}/update-organization-settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ organizationId, name, settings }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update organization settings');
  }

  return response.json();
}

