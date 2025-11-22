-- Drop all existing views first to allow recreation with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_analytics_health CASCADE;
DROP VIEW IF EXISTS public.analytics_flow_funnel CASCADE;
DROP VIEW IF EXISTS public.analytics_upload_success CASCADE;
DROP VIEW IF EXISTS public.analytics_screen_dropoff CASCADE;
DROP VIEW IF EXISTS public.analytics_rage_taps CASCADE;
DROP VIEW IF EXISTS public.v_feature_engagement CASCADE;
DROP VIEW IF EXISTS public.v_screen_time_analysis CASCADE;
DROP VIEW IF EXISTS public.v_user_action_frequency CASCADE;
DROP VIEW IF EXISTS public.v_session_summary CASCADE;
DROP VIEW IF EXISTS public.v_user_journey_detailed CASCADE;
DROP VIEW IF EXISTS public.v_user_journey CASCADE;
DROP VIEW IF EXISTS public.v_analytics_events_clean CASCADE;
DROP VIEW IF EXISTS public.v_event_analytics CASCADE;
DROP VIEW IF EXISTS public.v_page_analytics CASCADE;
DROP VIEW IF EXISTS public.v_session_analytics CASCADE;
DROP VIEW IF EXISTS public.v_analytics_events_unified CASCADE;

-- Recreate all views with SECURITY INVOKER for proper RLS enforcement

-- New analytics views for three-table architecture
CREATE VIEW public.v_analytics_events_unified
WITH (security_invoker = true)
AS
SELECT 
  ue.id,
  ue.user_id,
  ue.session_id,
  ue.event_type,
  ue.event_category,
  ue.event_source,
  ue.user_action,
  pv.page_route,
  pv.screen_name,
  pv.screen_category,
  pv.virtual_path,
  ue.duration_seconds,
  ue.flow_id,
  ue.event_data,
  s.viewport_width,
  s.viewport_height,
  s.session_metadata,
  ue.created_at
FROM public.user_events ue
LEFT JOIN public.page_views pv ON ue.page_view_id = pv.id
LEFT JOIN public.sessions s ON ue.session_id = s.session_id
UNION ALL
SELECT 
  pv.id,
  pv.user_id,
  pv.session_id,
  'page_view' as event_type,
  'navigation' as event_category,
  'navigation:page_view' as event_source,
  NULL as user_action,
  pv.page_route,
  pv.screen_name,
  pv.screen_category,
  pv.virtual_path,
  pv.duration_seconds,
  NULL as flow_id,
  '{}'::jsonb as event_data,
  s.viewport_width,
  s.viewport_height,
  s.session_metadata,
  pv.entered_at as created_at
FROM public.page_views pv
LEFT JOIN public.sessions s ON pv.session_id = s.session_id;

CREATE VIEW public.v_session_analytics
WITH (security_invoker = true)
AS
SELECT 
  s.session_id,
  s.user_id,
  s.started_at,
  s.ended_at,
  EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::INTEGER as session_duration_seconds,
  COUNT(DISTINCT pv.id) as page_views_count,
  COUNT(DISTINCT ue.id) as user_events_count,
  ARRAY_AGG(DISTINCT pv.screen_name ORDER BY pv.screen_name) FILTER (WHERE pv.screen_name IS NOT NULL) as screens_visited,
  ARRAY_AGG(DISTINCT ue.user_action ORDER BY ue.user_action) FILTER (WHERE ue.user_action IS NOT NULL) as actions_performed
FROM public.sessions s
LEFT JOIN public.page_views pv ON s.session_id = pv.session_id
LEFT JOIN public.user_events ue ON s.session_id = ue.session_id
GROUP BY s.session_id, s.user_id, s.started_at, s.ended_at;

CREATE VIEW public.v_page_analytics
WITH (security_invoker = true)
AS
SELECT 
  pv.screen_name,
  pv.screen_category,
  COUNT(*) as total_views,
  COUNT(DISTINCT pv.user_id) as unique_users,
  COUNT(DISTINCT pv.session_id) as unique_sessions,
  AVG(pv.duration_seconds) FILTER (WHERE pv.duration_seconds IS NOT NULL) as avg_duration_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pv.duration_seconds) FILTER (WHERE pv.duration_seconds IS NOT NULL) as median_duration_seconds,
  COUNT(*) FILTER (WHERE pv.exited_at IS NULL) as current_viewers
FROM public.page_views pv
GROUP BY pv.screen_name, pv.screen_category;

CREATE VIEW public.v_event_analytics
WITH (security_invoker = true)
AS
SELECT 
  ue.event_source,
  ue.user_action,
  pv.screen_name,
  pv.screen_category,
  COUNT(*) as event_count,
  COUNT(DISTINCT ue.user_id) as unique_users,
  COUNT(DISTINCT ue.session_id) as unique_sessions,
  AVG(ue.duration_seconds) FILTER (WHERE ue.duration_seconds IS NOT NULL) as avg_duration_seconds
FROM public.user_events ue
LEFT JOIN public.page_views pv ON ue.page_view_id = pv.id
GROUP BY ue.event_source, ue.user_action, pv.screen_name, pv.screen_category;

-- Legacy views for backward compatibility with analytics_events table
CREATE VIEW public.v_analytics_events_clean
WITH (security_invoker = true)
AS
SELECT *
FROM public.analytics_events
WHERE screen_name IS NOT NULL
  AND event_source IS NOT NULL;

CREATE VIEW public.v_user_journey
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  session_id,
  screen_name,
  user_action,
  created_at,
  LAG(user_action) OVER (PARTITION BY session_id ORDER BY created_at) as previous_action,
  LEAD(user_action) OVER (PARTITION BY session_id ORDER BY created_at) as next_action,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at)))::NUMERIC as seconds_since_last_action
FROM public.analytics_events
WHERE user_action IS NOT NULL
ORDER BY user_id, session_id, created_at;

CREATE VIEW public.v_user_journey_detailed
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  session_id,
  screen_name,
  screen_category,
  user_action,
  event_source,
  virtual_path,
  created_at,
  duration_seconds,
  event_data,
  LAG(screen_name) OVER (PARTITION BY session_id ORDER BY created_at) as previous_screen,
  LEAD(screen_name) OVER (PARTITION BY session_id ORDER BY created_at) as next_screen,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at)))::INTEGER as seconds_since_last_event
FROM public.analytics_events
WHERE event_type != 'page_view'
ORDER BY user_id, session_id, created_at;

CREATE VIEW public.v_session_summary
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  session_id,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))::NUMERIC as session_duration_seconds,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_action) as unique_actions,
  ARRAY_AGG(DISTINCT user_action ORDER BY user_action) FILTER (WHERE user_action IS NOT NULL) as actions_performed,
  ARRAY_AGG(DISTINCT screen_name ORDER BY screen_name) FILTER (WHERE screen_name IS NOT NULL) as screens_visited
FROM public.analytics_events
GROUP BY user_id, session_id;

CREATE VIEW public.v_user_action_frequency
WITH (security_invoker = true)
AS
SELECT 
  user_action,
  event_source,
  screen_category,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(duration_seconds)::INTEGER as avg_duration_seconds
FROM public.analytics_events
WHERE user_action IS NOT NULL
GROUP BY user_action, event_source, screen_category
ORDER BY event_count DESC;

CREATE VIEW public.v_screen_time_analysis
WITH (security_invoker = true)
AS
SELECT 
  screen_name,
  screen_category,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(duration_seconds)::INTEGER as avg_duration_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds)::INTEGER as median_duration_seconds,
  SUM(duration_seconds) as total_time_seconds
FROM public.analytics_events
WHERE screen_name IS NOT NULL
  AND duration_seconds IS NOT NULL
GROUP BY screen_name, screen_category
ORDER BY unique_users DESC;

CREATE VIEW public.v_feature_engagement
WITH (security_invoker = true)
AS
SELECT 
  user_action,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM public.analytics_events
WHERE user_action IS NOT NULL
GROUP BY user_action
ORDER BY unique_users DESC;

CREATE VIEW public.analytics_rage_taps
WITH (security_invoker = true)
AS
SELECT 
  event_data->>'element' as element,
  page_route,
  COUNT(*) as rage_tap_count,
  COUNT(DISTINCT user_id) as affected_users,
  AVG((event_data->>'clickCount')::INTEGER) as avg_clicks
FROM public.analytics_events
WHERE event_type = 'rage_tap'
GROUP BY event_data->>'element', page_route
ORDER BY rage_tap_count DESC;

CREATE VIEW public.analytics_screen_dropoff
WITH (security_invoker = true)
AS
WITH screen_entries AS (
  SELECT screen_name, COUNT(*) as total_views, COUNT(DISTINCT user_id) as unique_users
  FROM public.analytics_events
  WHERE event_type = 'page_view' AND screen_name IS NOT NULL
  GROUP BY screen_name
),
screen_exits AS (
  SELECT screen_name, COUNT(*) as exit_count
  FROM public.analytics_events
  WHERE user_action = 'page_exit' AND screen_name IS NOT NULL
  GROUP BY screen_name
)
SELECT 
  e.screen_name,
  e.total_views,
  e.unique_users,
  COALESCE(x.exit_count, 0) as exit_count,
  ROUND((COALESCE(x.exit_count, 0)::NUMERIC / e.total_views * 100), 2) as exit_rate
FROM screen_entries e
LEFT JOIN screen_exits x ON e.screen_name = x.screen_name
ORDER BY exit_rate DESC;

CREATE VIEW public.analytics_upload_success
WITH (security_invoker = true)
AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE event_source = 'user_action:upload_start') as total_attempts,
  COUNT(*) FILTER (WHERE event_source = 'user_action:complete_upload') as successful_uploads,
  COUNT(*) FILTER (WHERE event_source LIKE '%error%') as failed_uploads,
  ROUND(
    (COUNT(*) FILTER (WHERE event_source = 'user_action:complete_upload')::NUMERIC / 
     NULLIF(COUNT(*) FILTER (WHERE event_source = 'user_action:upload_start'), 0) * 100), 2
  ) as success_rate,
  AVG(duration_seconds) FILTER (WHERE event_source = 'user_action:complete_upload') as avg_duration_seconds
FROM public.analytics_events
WHERE event_source IN ('user_action:upload_start', 'user_action:complete_upload')
   OR event_source LIKE '%error%'
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE VIEW public.analytics_flow_funnel
WITH (security_invoker = true)
AS
SELECT 
  event_data->>'flowName' as flow_name,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_start' THEN session_id END) as started,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_complete' THEN session_id END) as completed,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_abandon' THEN session_id END) as abandoned,
  ROUND(
    (COUNT(DISTINCT CASE WHEN event_type = 'flow_complete' THEN session_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'flow_start' THEN session_id END), 0) * 100), 2
  ) as completion_rate
FROM public.analytics_events
WHERE event_type IN ('flow_start', 'flow_complete', 'flow_abandon')
GROUP BY event_data->>'flowName'
ORDER BY started DESC;

CREATE VIEW public.v_analytics_health
WITH (security_invoker = true)
AS
WITH total_events AS (
  SELECT COUNT(*) as total FROM public.analytics_events
)
SELECT 
  'Missing screen_name' as issue,
  COUNT(*) as affected_rows,
  ROUND((COUNT(*)::NUMERIC / (SELECT total FROM total_events) * 100), 2) as pct_of_total
FROM public.analytics_events
WHERE screen_name IS NULL
UNION ALL
SELECT 
  'Missing event_source' as issue,
  COUNT(*) as affected_rows,
  ROUND((COUNT(*)::NUMERIC / (SELECT total FROM total_events) * 100), 2) as pct_of_total
FROM public.analytics_events
WHERE event_source IS NULL
UNION ALL
SELECT 
  'Missing duration_seconds' as issue,
  COUNT(*) as affected_rows,
  ROUND((COUNT(*)::NUMERIC / (SELECT total FROM total_events) * 100), 2) as pct_of_total
FROM public.analytics_events
WHERE duration_seconds IS NULL AND user_action IS NOT NULL
ORDER BY affected_rows DESC;