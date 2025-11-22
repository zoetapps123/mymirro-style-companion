-- Add engagement_source column to analytics_events table
ALTER TABLE analytics_events 
ADD COLUMN engagement_source TEXT;

-- Create index for faster querying on engagement_source
CREATE INDEX idx_analytics_engagement_source ON analytics_events(engagement_source);

-- Add comment to describe the column
COMMENT ON COLUMN analytics_events.engagement_source IS 'Human-readable description of the event source (e.g., "AI Chat - Message Sent", "Wardrobe - Upload Photo Button")';