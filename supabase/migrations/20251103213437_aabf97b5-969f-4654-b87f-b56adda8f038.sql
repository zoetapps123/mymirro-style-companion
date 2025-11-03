-- Add quick_fix column to style_checks to store actionable styling tips
ALTER TABLE style_checks ADD COLUMN IF NOT EXISTS quick_fix text;

COMMENT ON COLUMN style_checks.quick_fix IS 'Actionable quick fixes from style analysis (pipe-separated)';
