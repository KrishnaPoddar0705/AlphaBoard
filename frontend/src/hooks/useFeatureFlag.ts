/**
 * Feature Flag Hook
 * 
 * React hook for accessing feature flags with reactive updates.
 */

import { useState, useEffect } from 'react';
import { isUIV2Enabled, setUIV2Enabled, isUIV3Enabled, setUIV3Enabled, type FeatureFlag } from '../config/featureFlags';

/**
 * Hook to check if UI_V2 is enabled
 */
export function useUIV2() {
  const [enabled, setEnabled] = useState(() => isUIV2Enabled());

  useEffect(() => {
    const handleChange = () => {
      setEnabled(isUIV2Enabled());
    };

    window.addEventListener('featureFlagChanged', handleChange);
    return () => {
      window.removeEventListener('featureFlagChanged', handleChange);
    };
  }, []);

  return [
    enabled,
    (newValue: boolean) => {
      setUIV2Enabled(newValue);
      setEnabled(newValue);
    },
  ] as const;
}

/**
 * Hook to check if UI_V3 is enabled
 */
export function useUIV3() {
  const [enabled, setEnabled] = useState(() => isUIV3Enabled());

  useEffect(() => {
    const handleChange = () => {
      setEnabled(isUIV3Enabled());
    };

    window.addEventListener('featureFlagChanged', handleChange);
    return () => {
      window.removeEventListener('featureFlagChanged', handleChange);
    };
  }, []);

  return [
    enabled,
    (newValue: boolean) => {
      setUIV3Enabled(newValue);
      setEnabled(newValue);
    },
  ] as const;
}

