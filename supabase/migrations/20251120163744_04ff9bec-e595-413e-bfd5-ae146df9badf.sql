-- Fix Security Definer Views - Change to SECURITY INVOKER
-- This ensures RLS policies are enforced based on the querying user, not the view owner

-- Drop existing views
DROP VIEW IF EXISTS analytics_flow_funnel;
DROP VIEW IF EXISTS analytics_rage_taps;
DROP VIEW IF EXISTS analytics_screen_dropoff;
DROP VIEW IF EXISTS analytics_upload_success;

-- Recreate analytics_flow_funnel with SECURITY INVOKER
CREATE VIEW analytics_flow_funnel
WITH (security_invoker = true)
AS
SELECT (event_data ->> 'flow_name'::text) AS flow_name,
    count(DISTINCT
        CASE
            WHEN (event_type = 'flow_started'::text) THEN session_id
            ELSE NULL::text
        END) AS started,
    count(DISTINCT
        CASE
            WHEN (event_type = 'flow_completed'::text) THEN session_id
            ELSE NULL::text
        END) AS completed,
    count(DISTINCT
        CASE
            WHEN (event_type = 'flow_abandoned'::text) THEN session_id
            ELSE NULL::text
        END) AS abandoned,
    round(((100.0 * (count(DISTINCT
        CASE
            WHEN (event_type = 'flow_completed'::text) THEN session_id
            ELSE NULL::text
        END))::numeric) / (NULLIF(count(DISTINCT
        CASE
            WHEN (event_type = 'flow_started'::text) THEN session_id
            ELSE NULL::text
        END), 0))::numeric), 2) AS completion_rate
   FROM analytics_events
  WHERE ((event_type = ANY (ARRAY['flow_started'::text, 'flow_completed'::text, 'flow_abandoned'::text])) AND (created_at > (now() - '7 days'::interval)))
  GROUP BY (event_data ->> 'flow_name'::text);

-- Recreate analytics_rage_taps with SECURITY INVOKER
CREATE VIEW analytics_rage_taps
WITH (security_invoker = true)
AS
SELECT (event_data ->> 'element'::text) AS element,
    page_route,
    count(*) AS rage_tap_count,
    count(DISTINCT user_id) AS affected_users,
    avg(((event_data ->> 'click_count'::text))::integer) AS avg_clicks
   FROM analytics_events
  WHERE ((event_type = 'rage_tap'::text) AND (created_at > (now() - '7 days'::interval)))
  GROUP BY (event_data ->> 'element'::text), page_route
  ORDER BY (count(*)) DESC;

-- Recreate analytics_screen_dropoff with SECURITY INVOKER
CREATE VIEW analytics_screen_dropoff
WITH (security_invoker = true)
AS
WITH screen_views AS (
         SELECT analytics_events.user_id,
            analytics_events.session_id,
            COALESCE(analytics_events.screen_name, (analytics_events.event_data ->> 'screen_name'::text)) AS screen_name,
            analytics_events.created_at,
            lead(COALESCE(analytics_events.screen_name, (analytics_events.event_data ->> 'screen_name'::text))) OVER (PARTITION BY analytics_events.session_id ORDER BY analytics_events.created_at) AS next_screen
           FROM analytics_events
          WHERE ((analytics_events.event_type = ANY (ARRAY['screen_view'::text, 'page_view'::text])) AND (analytics_events.created_at > (now() - '7 days'::interval)))
        )
 SELECT screen_name,
    count(*) AS total_views,
    count(DISTINCT user_id) AS unique_users,
    count(
        CASE
            WHEN (next_screen IS NULL) THEN 1
            ELSE NULL::integer
        END) AS exit_count,
    round(((100.0 * (count(
        CASE
            WHEN (next_screen IS NULL) THEN 1
            ELSE NULL::integer
        END))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS exit_rate
   FROM screen_views
  WHERE (screen_name IS NOT NULL)
  GROUP BY screen_name
  ORDER BY (round(((100.0 * (count(
        CASE
            WHEN (next_screen IS NULL) THEN 1
            ELSE NULL::integer
        END))::numeric) / (NULLIF(count(*), 0))::numeric), 2)) DESC;

-- Recreate analytics_upload_success with SECURITY INVOKER
CREATE VIEW analytics_upload_success
WITH (security_invoker = true)
AS
SELECT date(created_at) AS date,
    count(
        CASE
            WHEN (event_type = 'upload_attempt'::text) THEN 1
            ELSE NULL::integer
        END) AS total_attempts,
    count(
        CASE
            WHEN (event_type = 'upload_success'::text) THEN 1
            ELSE NULL::integer
        END) AS successful_uploads,
    count(
        CASE
            WHEN (event_type = 'upload_failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_uploads,
    round(((100.0 * (count(
        CASE
            WHEN (event_type = 'upload_success'::text) THEN 1
            ELSE NULL::integer
        END))::numeric) / (NULLIF(count(
        CASE
            WHEN (event_type = 'upload_attempt'::text) THEN 1
            ELSE NULL::integer
        END), 0))::numeric), 2) AS success_rate,
    (avg(
        CASE
            WHEN (event_type = 'upload_success'::text) THEN ((event_data ->> 'duration_ms'::text))::numeric
            ELSE NULL::numeric
        END) / 1000.0) AS avg_duration_seconds
   FROM analytics_events
  WHERE ((event_type = ANY (ARRAY['upload_attempt'::text, 'upload_success'::text, 'upload_failed'::text])) AND (created_at > (now() - '30 days'::interval)))
  GROUP BY (date(created_at))
  ORDER BY (date(created_at)) DESC;