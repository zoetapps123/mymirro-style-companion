-- Create sessions table
CREATE TABLE public.sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  viewport_width INTEGER,
  viewport_height INTEGER,
  session_metadata JSONB DEFAULT '{}'::jsonb
);

-- Create page_views table
CREATE TABLE public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_route TEXT NOT NULL,
  screen_name TEXT,
  screen_category TEXT,
  virtual_path TEXT,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- Create user_events table
CREATE TABLE public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  page_view_id UUID REFERENCES public.page_views(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_source TEXT,
  user_action TEXT,
  duration_seconds INTEGER,
  flow_id TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can create their own sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for page_views
CREATE POLICY "Users can create their own page views"
  ON public.page_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own page views"
  ON public.page_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_events
CREATE POLICY "Users can create their own events"
  ON public.user_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own events"
  ON public.user_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_started_at ON public.sessions(started_at DESC);

CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX idx_page_views_user_id ON public.page_views(user_id);
CREATE INDEX idx_page_views_entered_at ON public.page_views(entered_at DESC);
CREATE INDEX idx_page_views_screen_name ON public.page_views(screen_name);

CREATE INDEX idx_user_events_session_id ON public.user_events(session_id);
CREATE INDEX idx_user_events_page_view_id ON public.user_events(page_view_id);
CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_created_at ON public.user_events(created_at DESC);
CREATE INDEX idx_user_events_event_source ON public.user_events(event_source);
CREATE INDEX idx_user_events_user_action ON public.user_events(user_action);

-- Migrate existing data from analytics_events

-- 1. Create sessions from page_view and session_timeout events
INSERT INTO public.sessions (session_id, user_id, started_at, viewport_width, viewport_height, session_metadata)
SELECT DISTINCT ON (session_id)
  session_id,
  user_id,
  MIN(created_at) OVER (PARTITION BY session_id) as started_at,
  viewport_width,
  viewport_height,
  session_metadata
FROM public.analytics_events
WHERE session_id IS NOT NULL
ORDER BY session_id, created_at;

-- Update sessions end times from session_timeout events
UPDATE public.sessions s
SET ended_at = (
  SELECT created_at
  FROM public.analytics_events
  WHERE session_id = s.session_id
    AND event_type = 'session_timeout'
  ORDER BY created_at DESC
  LIMIT 1
);

-- 2. Create page_views from page_view events
WITH page_view_events AS (
  SELECT 
    gen_random_uuid() as id,
    session_id,
    user_id,
    page_route,
    screen_name,
    screen_category,
    virtual_path,
    created_at as entered_at,
    duration_seconds,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as view_order
  FROM public.analytics_events
  WHERE event_type = 'page_view'
    AND session_id IS NOT NULL
)
INSERT INTO public.page_views (id, session_id, user_id, page_route, screen_name, screen_category, virtual_path, entered_at, duration_seconds)
SELECT id, session_id, user_id, page_route, screen_name, screen_category, virtual_path, entered_at, duration_seconds
FROM page_view_events;

-- Update page_views exit times with next page view entry or session end
UPDATE public.page_views pv
SET exited_at = COALESCE(
  (SELECT MIN(pv2.entered_at)
   FROM public.page_views pv2
   WHERE pv2.session_id = pv.session_id
     AND pv2.entered_at > pv.entered_at),
  (SELECT ended_at
   FROM public.sessions s
   WHERE s.session_id = pv.session_id)
);

-- 3. Migrate user action events to user_events
INSERT INTO public.user_events (
  session_id,
  page_view_id,
  user_id,
  event_type,
  event_category,
  event_source,
  user_action,
  duration_seconds,
  flow_id,
  event_data,
  created_at
)
SELECT 
  ae.session_id,
  (SELECT pv.id
   FROM public.page_views pv
   WHERE pv.session_id = ae.session_id
     AND pv.entered_at <= ae.created_at
     AND (pv.exited_at IS NULL OR pv.exited_at >= ae.created_at)
   ORDER BY pv.entered_at DESC
   LIMIT 1) as page_view_id,
  ae.user_id,
  ae.event_type,
  ae.event_category,
  ae.event_source,
  ae.user_action,
  ae.duration_seconds,
  ae.flow_id,
  ae.event_data,
  ae.created_at
FROM public.analytics_events ae
WHERE ae.event_type NOT IN ('page_view', 'session_timeout')
  AND ae.session_id IS NOT NULL;

-- Create backward compatibility view
CREATE OR REPLACE VIEW public.v_analytics_events_unified AS
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

-- Create analytics summary views
CREATE OR REPLACE VIEW public.v_session_analytics AS
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

CREATE OR REPLACE VIEW public.v_page_analytics AS
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

CREATE OR REPLACE VIEW public.v_event_analytics AS
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