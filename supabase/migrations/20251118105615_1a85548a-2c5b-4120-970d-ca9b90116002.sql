-- Add new columns to analytics_events for enhanced tracking
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS screen_name TEXT,
ADD COLUMN IF NOT EXISTS flow_id UUID,
ADD COLUMN IF NOT EXISTS session_metadata JSONB;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_flow_tracking 
ON analytics_events(event_type, (event_data->>'flow_name'), created_at) 
WHERE event_type IN ('flow_started', 'flow_step', 'flow_completed', 'flow_abandoned');

CREATE INDEX IF NOT EXISTS idx_analytics_screen_tracking
ON analytics_events(screen_name, created_at)
WHERE screen_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_rage_taps
ON analytics_events(event_type, created_at)
WHERE event_type = 'rage_tap';

CREATE INDEX IF NOT EXISTS idx_analytics_upload_tracking
ON analytics_events(event_type, created_at)
WHERE event_type IN ('upload_attempt', 'upload_success', 'upload_failed');

-- Create view for flow funnel analysis
CREATE OR REPLACE VIEW analytics_flow_funnel AS
SELECT 
  event_data->>'flow_name' as flow_name,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_started' THEN session_id END) as started,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_completed' THEN session_id END) as completed,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_abandoned' THEN session_id END) as abandoned,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'flow_completed' THEN session_id END) / 
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'flow_started' THEN session_id END), 0),
    2
  ) as completion_rate
FROM analytics_events
WHERE event_type IN ('flow_started', 'flow_completed', 'flow_abandoned')
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_data->>'flow_name';

-- Create view for rage tap hotspots
CREATE OR REPLACE VIEW analytics_rage_taps AS
SELECT 
  event_data->>'element' as element,
  page_route,
  COUNT(*) as rage_tap_count,
  COUNT(DISTINCT user_id) as affected_users,
  AVG((event_data->>'click_count')::int) as avg_clicks
FROM analytics_events
WHERE event_type = 'rage_tap'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_data->>'element', page_route
ORDER BY rage_tap_count DESC;

-- Create view for screen drop-off analysis
CREATE OR REPLACE VIEW analytics_screen_dropoff AS
WITH screen_views AS (
  SELECT 
    user_id,
    session_id,
    COALESCE(screen_name, event_data->>'screen_name') as screen_name,
    created_at,
    LEAD(COALESCE(screen_name, event_data->>'screen_name')) OVER (PARTITION BY session_id ORDER BY created_at) as next_screen
  FROM analytics_events
  WHERE event_type IN ('screen_view', 'page_view')
  AND created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  screen_name,
  COUNT(*) as total_views,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN next_screen IS NULL THEN 1 END) as exit_count,
  ROUND(
    100.0 * COUNT(CASE WHEN next_screen IS NULL THEN 1 END) / NULLIF(COUNT(*), 0),
    2
  ) as exit_rate
FROM screen_views
WHERE screen_name IS NOT NULL
GROUP BY screen_name
ORDER BY exit_rate DESC;

-- Create view for upload success rate
CREATE OR REPLACE VIEW analytics_upload_success AS
SELECT 
  DATE(created_at) as date,
  COUNT(CASE WHEN event_type = 'upload_attempt' THEN 1 END) as total_attempts,
  COUNT(CASE WHEN event_type = 'upload_success' THEN 1 END) as successful_uploads,
  COUNT(CASE WHEN event_type = 'upload_failed' THEN 1 END) as failed_uploads,
  ROUND(
    100.0 * COUNT(CASE WHEN event_type = 'upload_success' THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN event_type = 'upload_attempt' THEN 1 END), 0),
    2
  ) as success_rate,
  AVG(CASE WHEN event_type = 'upload_success' 
      THEN (event_data->>'duration_ms')::numeric END) / 1000.0 as avg_duration_seconds
FROM analytics_events
WHERE event_type IN ('upload_attempt', 'upload_success', 'upload_failed')
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;