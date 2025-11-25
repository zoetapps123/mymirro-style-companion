-- Fix numeric field overflow for last_intent_confidence
-- Current precision (3,2) only allows values up to 9.99
-- We need to store confidence values from 0-100

ALTER TABLE public.conversation_state
ALTER COLUMN last_intent_confidence TYPE NUMERIC(5,2);

-- This allows values from -999.99 to 999.99
-- Which is more than enough for confidence scores (0-100)