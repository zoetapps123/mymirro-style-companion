-- Add email and phone columns to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text;

-- Create index for phone lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone);

-- Create chat_logs table for chat persistence
CREATE TABLE public.chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  messages jsonb,
  user_message text,
  ai_response text,
  intent text,
  conversation_turn integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat logs
CREATE POLICY "Users can view their own chat logs"
  ON public.chat_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Allow inserts (service role will bypass RLS anyway, but this allows authenticated users too)
CREATE POLICY "Users can insert their own chat logs"
  ON public.chat_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);