-- Phase 1: Add user_action computed column for unified analytics
ALTER TABLE analytics_events 
ADD COLUMN user_action TEXT GENERATED ALWAYS AS (
  CASE 
    -- Direct mappings from custom events
    WHEN event_type IN (
      'chat_message_sent', 'chat_reset', 'suggestion_clicked', 
      'query_card_clicked', 'wardrobe_upload_started', 
      'wardrobe_upload_completed', 'wardrobe_item_deleted',
      'style_check_started', 'style_check_occasion_selected',
      'style_check_completed', 'outfit_generation_started',
      'outfit_generation_completed', 'outfit_battle_completed',
      'outfit_saved_to_lookbook', 'onboarding_started',
      'onboarding_completed', 'session_started', 'session_end',
      'swipe_left', 'swipe_right', 'swipe_up',
      'share_style_check', 'share_outfit', 'share_battle',
      'style_check_submit', 'outfit_generation_submit',
      'wardrobe_upload_submit'
    ) THEN event_type
    
    -- Map screen views to semantic actions
    WHEN event_type = 'screen_view' THEN 'view_' || COALESCE(screen_name, event_data->>'screen_name', 'unknown')
    WHEN event_type = 'tab_change' THEN 'switch_to_' || COALESCE(event_data->>'tab', 'unknown')
    
    -- Map clicks with analytics IDs
    WHEN event_type = 'click' AND event_data->>'data-analytics-id' IS NOT NULL 
      THEN 'click_' || (event_data->>'data-analytics-id')
    
    ELSE event_type
  END
) STORED;

-- Create index for faster queries
CREATE INDEX idx_analytics_user_action ON analytics_events(user_action);

-- Phase 5: Create Analysis Helper Views

-- Feature Engagement Summary
CREATE VIEW v_feature_engagement AS
SELECT 
  user_action,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM analytics_events
WHERE user_action IS NOT NULL
GROUP BY user_action
ORDER BY total_events DESC;

-- User Journey Funnel
CREATE VIEW v_user_journey AS
SELECT 
  user_id,
  session_id,
  user_action,
  created_at,
  screen_name,
  LAG(user_action) OVER (PARTITION BY session_id ORDER BY created_at) as previous_action,
  LEAD(user_action) OVER (PARTITION BY session_id ORDER BY created_at) as next_action,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at))) as seconds_since_last_action
FROM analytics_events
WHERE user_action IS NOT NULL;

-- Session Summary
CREATE VIEW v_session_summary AS
SELECT 
  session_id,
  user_id,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as session_duration_seconds,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_action) as unique_actions,
  array_agg(DISTINCT user_action ORDER BY user_action) FILTER (WHERE user_action IS NOT NULL) as actions_performed,
  array_agg(DISTINCT screen_name ORDER BY screen_name) FILTER (WHERE screen_name IS NOT NULL) as screens_visited
FROM analytics_events
GROUP BY session_id, user_id;

-- Phase 6: Data Quality Monitoring
CREATE VIEW v_analytics_health AS
SELECT 
  'Missing screen_name for navigation events' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1) as pct_of_total
FROM analytics_events
WHERE screen_name IS NULL AND event_category = 'Navigation'
UNION ALL
SELECT 
  'Empty event_data for custom events',
  COUNT(*),
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1)
FROM analytics_events
WHERE event_category = 'custom' AND (event_data IS NULL OR event_data = '{}'::jsonb)
UNION ALL
SELECT 
  'Events with page_route not /',
  COUNT(*),
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1)
FROM analytics_events
WHERE page_route != '/'
UNION ALL
SELECT 
  'Events missing user_action',
  COUNT(*),
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1)
FROM analytics_events
WHERE user_action IS NULL;