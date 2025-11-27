-- Add new 12-field visual metadata columns to wardrobe_items
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS item_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fit_silhouette TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS secondary_palette TEXT[];
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS graphic_summary TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS sleeve_neck_summary TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fabric_family TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fabric_behavior TEXT;

-- Add metadata columns for visibility and confidence
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS visible_area_ratio NUMERIC;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS original_image_url TEXT;