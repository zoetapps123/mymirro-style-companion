-- Add missing columns to page_views table
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS page_title text,
ADD COLUMN IF NOT EXISTS referrer text,
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS entry_point text,
ADD COLUMN IF NOT EXISTS device_type text,
ADD COLUMN IF NOT EXISTS os_name text,
ADD COLUMN IF NOT EXISTS browser_name text,
ADD COLUMN IF NOT EXISTS duration_ms int,
ADD COLUMN IF NOT EXISTS exit_reason text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS occurred_at timestamptz;

-- Set occurred_at from entered_at for existing records
UPDATE page_views SET occurred_at = entered_at WHERE occurred_at IS NULL;

-- Make occurred_at NOT NULL after backfill
ALTER TABLE page_views ALTER COLUMN occurred_at SET NOT NULL;
ALTER TABLE page_views ALTER COLUMN occurred_at SET DEFAULT now();

-- Add missing columns to user_events table
ALTER TABLE user_events 
ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS event_name text,
ADD COLUMN IF NOT EXISTS element_id text,
ADD COLUMN IF NOT EXISTS element_text text,
ADD COLUMN IF NOT EXISTS value text,
ADD COLUMN IF NOT EXISTS numeric_value numeric,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Backfill occurred_at from created_at
UPDATE user_events SET occurred_at = created_at WHERE occurred_at IS NULL;

-- Make occurred_at NOT NULL
ALTER TABLE user_events ALTER COLUMN occurred_at SET NOT NULL;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_occurred_at ON page_views(occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_page_view_id ON user_events(page_view_id);
CREATE INDEX IF NOT EXISTS idx_user_events_occurred_at ON user_events(occurred_at);

-- Add index for device type analytics
CREATE INDEX IF NOT EXISTS idx_page_views_device_type ON page_views(device_type);

-- Add index for UTM tracking
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source) WHERE utm_source IS NOT NULL;