-- Change flow_id column from UUID to TEXT to support human-readable flow identifiers
ALTER TABLE analytics_events ALTER COLUMN flow_id TYPE TEXT USING flow_id::TEXT;