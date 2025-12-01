-- Migration: Add weight_pct field to recommendations table
-- Created: 2024

-- Add weight_pct column (nullable, optional weight percentage 0-100)
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS weight_pct numeric CHECK (weight_pct >= 0 AND weight_pct <= 100);

-- Add comment for documentation
COMMENT ON COLUMN public.recommendations.weight_pct IS 'Optional portfolio weight percentage (0-100). If null, equal weight is assumed.';

