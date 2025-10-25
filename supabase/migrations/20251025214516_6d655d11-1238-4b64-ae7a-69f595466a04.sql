-- Add outfit_name column to style_checks table
ALTER TABLE public.style_checks ADD COLUMN IF NOT EXISTS outfit_name TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_style_checks_outfit_name ON public.style_checks(outfit_name);