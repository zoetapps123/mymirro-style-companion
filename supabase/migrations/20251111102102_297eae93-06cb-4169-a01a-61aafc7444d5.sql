-- Add enhanced metadata columns to wardrobe_items table

-- Color enhancement (for better deduplication)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS primary_color_name TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS color_family TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS secondary_colors TEXT[];
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS color_distribution INTEGER[];

-- Fabric & material (enhanced)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fabric_primary TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fabric_weight TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS material_finish TEXT;

-- Pattern (more specific)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS pattern_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS pattern_scale TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS pattern_colors TEXT[];

-- Cut & fit (critical for deduplication)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS fit_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS silhouette TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS length TEXT;

-- Design elements (unique identifiers)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS neckline TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS sleeve_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS closure_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS pocket_details TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS hardware_details TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS embellishments TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS special_features TEXT[];

-- Style & aesthetic (enhanced style_notes)
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS style_aesthetic TEXT[];
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS formality_level TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS style_notes_detailed TEXT;

-- Occasion & use case
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS suitable_occasions TEXT[];
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS season TEXT[];
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS weather_suitability TEXT;

-- Category-specific fields
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS rise TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS waist_style TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS heel_type TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS toe_style TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS collar_type TEXT;

-- Optional fields
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_color_family ON wardrobe_items(color_family);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_fit_type ON wardrobe_items(fit_type);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_formality ON wardrobe_items(formality_level);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_occasions ON wardrobe_items USING GIN(suitable_occasions);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_season ON wardrobe_items USING GIN(season);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_style_aesthetic ON wardrobe_items USING GIN(style_aesthetic);