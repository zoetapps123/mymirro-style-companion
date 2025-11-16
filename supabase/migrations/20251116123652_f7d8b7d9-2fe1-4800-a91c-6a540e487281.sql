-- Add UNIQUE constraint to cache_key column in ai_cache table
-- This fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error
ALTER TABLE ai_cache
ADD CONSTRAINT ai_cache_cache_key_unique
UNIQUE (cache_key);