-- Add new visual metadata columns for Phase 1 visual-only extraction
ALTER TABLE wardrobe_items
ADD COLUMN IF NOT EXISTS bbox jsonb,
ADD COLUMN IF NOT EXISTS primary_color_hex text,
ADD COLUMN IF NOT EXISTS color_palette text[],
ADD COLUMN IF NOT EXISTS pattern_geometry text,
ADD COLUMN IF NOT EXISTS pattern_coverage text,
ADD COLUMN IF NOT EXISTS color_blocking_layout text,
ADD COLUMN IF NOT EXISTS graphic_type text,
ADD COLUMN IF NOT EXISTS graphic_location text,
ADD COLUMN IF NOT EXISTS graphic_size text,
ADD COLUMN IF NOT EXISTS hem_style text,
ADD COLUMN IF NOT EXISTS shoulder_style text,
ADD COLUMN IF NOT EXISTS layers_detected text,
ADD COLUMN IF NOT EXISTS visual_summary text;

-- Add comments for schema clarity
COMMENT ON COLUMN wardrobe_items.bbox IS 'Bounding box from Phase 1 detection {x,y,width,height}';
COMMENT ON COLUMN wardrobe_items.primary_color_hex IS 'Phase 1 visual: Primary color as hex';
COMMENT ON COLUMN wardrobe_items.color_palette IS 'Phase 1 visual: Array of hex codes for all visible colors';
COMMENT ON COLUMN wardrobe_items.pattern_geometry IS 'Phase 1 visual: Pattern direction/layout (horizontal, vertical, etc.)';
COMMENT ON COLUMN wardrobe_items.pattern_coverage IS 'Phase 1 visual: Where pattern appears (all_over, chest_center, etc.)';
COMMENT ON COLUMN wardrobe_items.color_blocking_layout IS 'Phase 1 visual: Color blocking style';
COMMENT ON COLUMN wardrobe_items.graphic_type IS 'Phase 1 visual: Type of graphic if present';
COMMENT ON COLUMN wardrobe_items.graphic_location IS 'Phase 1 visual: Location of graphic';
COMMENT ON COLUMN wardrobe_items.graphic_size IS 'Phase 1 visual: Size of graphic';
COMMENT ON COLUMN wardrobe_items.hem_style IS 'Phase 1 visual: Hem finish style';
COMMENT ON COLUMN wardrobe_items.shoulder_style IS 'Phase 1 visual: Shoulder construction';
COMMENT ON COLUMN wardrobe_items.layers_detected IS 'Phase 1 visual: Layering context';
COMMENT ON COLUMN wardrobe_items.visual_summary IS 'Phase 1 visual: AI-generated visual description';
COMMENT ON COLUMN wardrobe_items.style_aesthetic IS 'Phase 2 semantic: Style aesthetic tags';
COMMENT ON COLUMN wardrobe_items.formality_level IS 'Phase 2 semantic: Formality level';
COMMENT ON COLUMN wardrobe_items.suitable_occasions IS 'Phase 2 semantic: Suitable occasions';
COMMENT ON COLUMN wardrobe_items.season IS 'Phase 2 semantic: Suitable seasons';
COMMENT ON COLUMN wardrobe_items.weather_suitability IS 'Phase 2 semantic: Weather suitability';