/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for AlphaBoard.
 * Flags can be controlled via environment variables or localStorage.
 */

const FEATURE_FLAGS = {
  UI_V2: 'UI_V2',
  UI_V3: 'UI_V3',
} as const;

type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

/**
 * Get feature flag value from environment variable or localStorage
 */
function getFeatureFlag(flag: FeatureFlag): boolean {
  // Check environment variable first (for build-time flags)
  const envValue = import.meta.env[`VITE_${flag}`];
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }

  // Check localStorage (for runtime flags)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`feature_flag_${flag}`);
    if (stored !== null) {
      return stored === 'true';
    }
  }

  // Default to false (feature disabled)
  return false;
}

/**
 * Set feature flag value in localStorage
 */
function setFeatureFlag(flag: FeatureFlag, value: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`feature_flag_${flag}`, value.toString());
    // Dispatch custom event for components to react to flag changes
    window.dispatchEvent(new CustomEvent('featureFlagChanged', { 
      detail: { flag, value } 
    }));
  }
}

/**
 * Check if UI_V2 is enabled
 */
export function isUIV2Enabled(): boolean {
  return getFeatureFlag(FEATURE_FLAGS.UI_V2);
}

/**
 * Enable/disable UI_V2
 */
export function setUIV2Enabled(enabled: boolean): void {
  setFeatureFlag(FEATURE_FLAGS.UI_V2, enabled);
}

/**
 * Check if UI_V3 is enabled
 */
export function isUIV3Enabled(): boolean {
  return getFeatureFlag(FEATURE_FLAGS.UI_V3);
}

/**
 * Enable/disable UI_V3
 */
export function setUIV3Enabled(enabled: boolean): void {
  setFeatureFlag(FEATURE_FLAGS.UI_V3, enabled);
}

// Note: React hook version is in hooks/useFeatureFlag.ts

export { FEATURE_FLAGS };
export type { FeatureFlag };

