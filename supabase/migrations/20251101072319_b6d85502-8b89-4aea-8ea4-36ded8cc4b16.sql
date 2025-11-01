-- Add new fields to wardrobe_items for better item tracking
ALTER TABLE wardrobe_items 
ADD COLUMN IF NOT EXISTS fabric TEXT,
ADD COLUMN IF NOT EXISTS texture TEXT,
ADD COLUMN IF NOT EXISTS pattern TEXT,
ADD COLUMN IF NOT EXISTS style_notes TEXT;

-- Add fields to outfits table for lookbook and regeneration
ALTER TABLE outfits
ADD COLUMN IF NOT EXISTS style_tag TEXT,
ADD COLUMN IF NOT EXISTS saved_to_lookbook BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_regeneration BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create trigger function for auto-regeneration when items added
CREATE OR REPLACE FUNCTION trigger_regenerate_outfits()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE outfits 
  SET needs_regeneration = true
  WHERE user_id = NEW.user_id
  AND saved_to_lookbook = false;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER after_wardrobe_item_insert
AFTER INSERT ON wardrobe_items
FOR EACH ROW
EXECUTE FUNCTION trigger_regenerate_outfits();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_outfits_lookbook 
ON outfits(user_id, saved_to_lookbook);

CREATE INDEX IF NOT EXISTS idx_outfits_occasion 
ON outfits(occasion) WHERE occasion IS NOT NULL;