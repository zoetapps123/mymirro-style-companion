-- Fix search_path security warning for trigger function
CREATE OR REPLACE FUNCTION trigger_regenerate_outfits()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE outfits 
  SET needs_regeneration = true
  WHERE user_id = NEW.user_id
  AND saved_to_lookbook = false;
  
  RETURN NEW;
END;
$$;