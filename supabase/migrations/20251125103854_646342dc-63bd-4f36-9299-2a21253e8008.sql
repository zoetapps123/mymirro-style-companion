-- Phase 1: Database Schema Enhancement

-- 1.1 Create user_preferences table for Memory Engine
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('fashion', 'vibe', 'brand', 'emotional', 'experiment_level')),
  preference_key TEXT NOT NULL,
  preference_value JSONB,
  confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source TEXT CHECK (source IN ('explicit', 'inferred', 'repeated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_preference UNIQUE(user_id, preference_type, preference_key)
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_preferences
CREATE POLICY "Users can manage their own preferences"
ON public.user_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX idx_user_preferences_type ON public.user_preferences(user_id, preference_type);

-- Trigger to update updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 1.2 Enhance conversation_state table
ALTER TABLE public.conversation_state 
ADD COLUMN IF NOT EXISTS emotional_tone TEXT,
ADD COLUMN IF NOT EXISTS chat_direction TEXT DEFAULT 'casual_chat',
ADD COLUMN IF NOT EXISTS last_mode_used TEXT,
ADD COLUMN IF NOT EXISTS consecutive_outfit_blocks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_5_intents JSONB DEFAULT '[]'::jsonb;