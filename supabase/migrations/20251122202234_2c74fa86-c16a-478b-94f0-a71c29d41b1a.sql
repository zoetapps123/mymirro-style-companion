-- Add missing viewport columns to page_views table
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS viewport_width integer,
ADD COLUMN IF NOT EXISTS viewport_height integer;