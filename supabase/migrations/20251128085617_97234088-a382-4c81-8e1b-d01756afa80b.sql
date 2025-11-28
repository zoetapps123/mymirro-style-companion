-- MyMirro Wardrobe 12-Field Visual Signature Migration
-- Hard reset to new detection schema

-- Add new 12-field visual signature columns
ALTER TABLE wardrobe_items
ADD COLUMN IF NOT EXISTS item_type TEXT,
ADD COLUMN IF NOT EXISTS fit_silhouette TEXT,
ADD COLUMN IF NOT EXISTS secondary_palette JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pattern_geometry TEXT,
ADD COLUMN IF NOT EXISTS graphic_summary TEXT,
ADD COLUMN IF NOT EXISTS sleeve_neck_summary TEXT,
ADD COLUMN IF NOT EXISTS fabric_family TEXT,
ADD COLUMN IF NOT EXISTS fabric_behavior TEXT,
ADD COLUMN IF NOT EXISTS visible_area_ratio FLOAT,
ADD COLUMN IF NOT EXISTS confidence FLOAT;

-- Create index on new visual signature fields for faster deduplication
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_visual_signature 
ON wardrobe_items (category, item_type, primary_color_hex, pattern_type, fit_silhouette);

-- Create index on secondary_palette for array operations
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_secondary_palette 
ON wardrobe_items USING GIN (secondary_palette);

-- Keep existing Phase 2 semantic fields:
-- style_aesthetic, formality_level, suitable_occasions, season, 
-- weather_suitability, brand, condition, special_features, style_notes_detailed

COMMENT ON COLUMN wardrobe_items.item_type IS 'Phase 1: Specific item type (e.g., t-shirt, jeans, bomber jacket)';
COMMENT ON COLUMN wardrobe_items.fit_silhouette IS 'Phase 1: Overall silhouette (oversized, fitted, relaxed, etc.)';
COMMENT ON COLUMN wardrobe_items.secondary_palette IS 'Phase 1: Array of secondary color hex codes';
COMMENT ON COLUMN wardrobe_items.pattern_geometry IS 'Phase 1: Pattern shape/structure (linear, circular, organic, etc.)';
COMMENT ON COLUMN wardrobe_items.graphic_summary IS 'Phase 1: Brief description of graphics/logos if present';
COMMENT ON COLUMN wardrobe_items.sleeve_neck_summary IS 'Phase 1: Combined sleeve and neckline description';
COMMENT ON COLUMN wardrobe_items.fabric_family IS 'Phase 1: Fabric category (cotton, wool, synthetic, leather, etc.)';
COMMENT ON COLUMN wardrobe_items.fabric_behavior IS 'Phase 1: Fabric drape/structure (structured, flowing, stiff, etc.)';
COMMENT ON COLUMN wardrobe_items.visible_area_ratio IS 'Phase 1: Ratio of visible item area to total item area (0-1)';
COMMENT ON COLUMN wardrobe_items.confidence IS 'Phase 1: Detection confidence score (0-1)';