/**
 * Allowed Origins Configuration
 * 
 * This file lists all allowed origins for the AlphaBoard application.
 * These domains should also be configured in:
 * - Clerk Dashboard → Settings → Paths → Allowed redirect URLs
 * - Supabase Dashboard → Authentication → URL Configuration (if applicable)
 */

export const ALLOWED_ORIGINS = [
  // Production domains
  'https://www.alphaboard.theunicornlabs.com',
  'https://alphaboard.onrender.com',
  
  // Development domains
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
] as const;

/**
 * Check if the current origin is in the allowed list
 */
export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (origin === allowed) return true;
    // Match with trailing slash
    if (origin === `${allowed}/`) return true;
    // Match subdomains (for development)
    if (allowed.startsWith('http://localhost') && origin.startsWith('http://localhost')) return true;
    if (allowed.startsWith('http://127.0.0.1') && origin.startsWith('http://127.0.0.1')) return true;
    return false;
  });
}

/**
 * Get the current origin
 */
export function getCurrentOrigin(): string {
  return window.location.origin;
}

/**
 * Validate current origin (for development/debugging)
 */
export function validateCurrentOrigin(): boolean {
  const origin = getCurrentOrigin();
  const isValid = isAllowedOrigin(origin);
  
  // Origin validation (console.warn removed)
  
  return isValid;
}

