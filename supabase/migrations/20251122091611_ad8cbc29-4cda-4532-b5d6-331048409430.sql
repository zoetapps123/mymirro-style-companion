-- Add virtual_path column to analytics_events table
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS virtual_path TEXT;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_virtual_path 
ON analytics_events(virtual_path);

-- Add comment explaining the column
COMMENT ON COLUMN analytics_events.virtual_path IS 'Virtual path for SPA sub-views (e.g., /app/wardrobe/items)';