-- Create AI cache table for reducing API calls
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  result_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for reading cache (public read)
CREATE POLICY "Anyone can read cache" 
ON public.ai_cache 
FOR SELECT 
USING (true);

-- Create policy for writing cache (public write)
CREATE POLICY "Anyone can write cache" 
ON public.ai_cache 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster cache key lookups
CREATE INDEX idx_ai_cache_key ON public.ai_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_cache(expires_at);

-- Create function to clean up expired cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_cache
  WHERE expires_at < now();
END;
$$;