-- Phase 1: Add new columns and rename engagement_source
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE analytics_events 
RENAME COLUMN engagement_source TO event_source;

ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS screen_category TEXT;

-- Phase 2: Standardize existing screen names
UPDATE analytics_events 
SET screen_name = CASE
  WHEN screen_name IN ('stylecheck', 'stylecheck-hub') THEN 'stylecheck-hub'
  WHEN screen_name = 'stylecheck-battle' THEN 'stylecheck-battle'
  WHEN screen_name = 'stylecheck-outfit-check' THEN 'stylecheck-check'
  WHEN screen_name IN ('wardrobe', 'wardrobe-items') THEN 'wardrobe-items'
  WHEN screen_name = 'wardrobe-suggestion' THEN 'wardrobe-outfits'
  WHEN screen_name = 'ai-companion' THEN 'chat'
  ELSE screen_name
END
WHERE screen_name IS NOT NULL;

-- Populate screen_category from standardized screen_name
UPDATE analytics_events 
SET screen_category = CASE
  WHEN screen_name LIKE 'stylecheck%' THEN 'stylecheck'
  WHEN screen_name LIKE 'wardrobe%' THEN 'wardrobe'
  WHEN screen_name = 'chat' THEN 'chat'
  WHEN screen_name = 'home' THEN 'home'
  WHEN screen_name = 'profile' THEN 'profile'
  ELSE 'other'
END
WHERE screen_name IS NOT NULL;

-- Phase 3: Backfill virtual_path from screen_name where missing
UPDATE analytics_events 
SET virtual_path = CASE
  WHEN screen_name IS NOT NULL THEN '/app/' || screen_name
  WHEN event_type = 'page_view' AND event_data ? 'virtual_path' THEN event_data->>'virtual_path'
  ELSE '/'
END
WHERE virtual_path IS NULL OR virtual_path = '/';

-- Extract duration_seconds from event_data where it exists
UPDATE analytics_events 
SET duration_seconds = CAST(event_data->>'duration_seconds' AS INTEGER)
WHERE event_data ? 'duration_seconds' 
  AND duration_seconds IS NULL
  AND event_data->>'duration_seconds' ~ '^\d+$';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_screen_category ON analytics_events(screen_category);
CREATE INDEX IF NOT EXISTS idx_analytics_duration ON analytics_events(duration_seconds) WHERE duration_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_event_source ON analytics_events(event_source);
CREATE INDEX IF NOT EXISTS idx_analytics_virtual_path ON analytics_events(virtual_path);

-- Drop and recreate v_analytics_events_clean with new columns
DROP VIEW IF EXISTS v_analytics_events_clean CASCADE;

CREATE VIEW v_analytics_events_clean AS
SELECT 
  id,
  user_id,
  event_data,
  viewport_width,
  viewport_height,
  created_at,
  session_metadata,
  flow_id,
  virtual_path,
  user_action,
  session_id,
  event_type,
  event_category,
  page_route,
  screen_name,
  screen_category,
  event_source,
  duration_seconds
FROM analytics_events
WHERE event_type NOT IN ('duplicate_event', 'test_event')
  AND user_id IS NOT NULL
  AND session_id IS NOT NULL
ORDER BY created_at DESC;

-- Phase 8: Create new analysis views

-- 1. User Journey View (answers: what are users doing, where, and for how long?)
CREATE VIEW v_user_journey_detailed AS
SELECT 
  user_id,
  session_id,
  screen_name,
  screen_category,
  virtual_path,
  user_action,
  event_source,
  duration_seconds,
  created_at,
  event_data,
  LAG(screen_name) OVER (PARTITION BY session_id ORDER BY created_at) as previous_screen,
  LEAD(screen_name) OVER (PARTITION BY session_id ORDER BY created_at) as next_screen,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at)))::INTEGER as seconds_since_last_event
FROM v_analytics_events_clean
ORDER BY user_id, session_id, created_at;

-- 2. Screen Time Analysis
CREATE VIEW v_screen_time_analysis AS
SELECT 
  screen_name,
  screen_category,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(duration_seconds)::INTEGER as avg_duration_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds)::INTEGER as median_duration_seconds,
  SUM(duration_seconds) as total_time_seconds
FROM v_analytics_events_clean
WHERE duration_seconds IS NOT NULL
GROUP BY screen_name, screen_category
ORDER BY total_time_seconds DESC NULLS LAST;

-- 3. User Action Frequency
CREATE VIEW v_user_action_frequency AS
SELECT 
  user_action,
  screen_category,
  event_source,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(duration_seconds)::INTEGER as avg_duration_seconds
FROM v_analytics_events_clean
WHERE user_action IS NOT NULL
GROUP BY user_action, screen_category, event_source
ORDER BY event_count DESC;