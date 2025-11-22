-- Phase 3: Create deduplicated view
CREATE VIEW v_analytics_events_clean AS
WITH ranked_events AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY 
        user_id, 
        session_id, 
        event_type,
        DATE_TRUNC('second', created_at),
        event_data
      ORDER BY 
        -- Prefer events WITH screen_name
        CASE WHEN screen_name IS NOT NULL THEN 0 ELSE 1 END,
        created_at DESC
    ) as rn
  FROM analytics_events
)
SELECT 
  id,
  user_id,
  event_data,
  viewport_width,
  viewport_height,
  created_at,
  session_metadata,
  flow_id,
  engagement_source,
  virtual_path,
  user_action,
  session_id,
  event_type,
  event_category,
  page_route,
  screen_name
FROM ranked_events
WHERE rn = 1;

-- Phase 4: Update v_analytics_health to detect duplicates
DROP VIEW IF EXISTS v_analytics_health;

CREATE VIEW v_analytics_health AS
-- Existing health checks
SELECT 
  'Missing user_id' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1) as pct_of_total
FROM analytics_events
WHERE user_id IS NULL

UNION ALL

SELECT 
  'Missing session_id' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1) as pct_of_total
FROM analytics_events
WHERE session_id IS NULL

UNION ALL

SELECT 
  'Missing event_type' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events), 0) * 100, 1) as pct_of_total
FROM analytics_events
WHERE event_type IS NULL

UNION ALL

-- NEW: Detect potential duplicates in last hour
SELECT 
  'Potential Duplicates in Last Hour' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events WHERE created_at > NOW() - INTERVAL '1 hour'), 0) * 100, 1) as pct_of_total
FROM (
  SELECT 
    user_id,
    session_id,
    event_type,
    DATE_TRUNC('second', created_at) as event_second,
    event_data,
    COUNT(*) as duplicate_count
  FROM analytics_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY 1,2,3,4,5
  HAVING COUNT(*) > 1
) duplicates

UNION ALL

-- NEW: Detect duplicates in last 24 hours
SELECT 
  'Potential Duplicates in Last 24 Hours' as issue,
  COUNT(*) as affected_rows,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM analytics_events WHERE created_at > NOW() - INTERVAL '24 hours'), 0) * 100, 1) as pct_of_total
FROM (
  SELECT 
    user_id,
    session_id,
    event_type,
    DATE_TRUNC('second', created_at) as event_second,
    event_data,
    COUNT(*) as duplicate_count
  FROM analytics_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY 1,2,3,4,5
  HAVING COUNT(*) > 1
) duplicates_24h;