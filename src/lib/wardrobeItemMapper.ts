/**
 * Maps AI-detected item metadata to database wardrobe_items schema
 * NEW 12-FIELD VISUAL METADATA SYSTEM
 */

export interface Phase1Item {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible_area_ratio: number; // 0-1
  confidence: number; // 0-1
  
  // The 12 visual fields
  category: string;
  item_type: string;
  fit_silhouette: string;
  length: string;
  primary_color_hex: string;
  secondary_palette: string[];
  pattern_type: string;
  pattern_geometry: string;
  graphic_summary: string;
  sleeve_neck_summary: string;
  fabric_family: string;
  fabric_behavior: string;
}

export function mapDetectedItemToDbRecord(
  item: Phase1Item,
  userId: string,
  originalImageUrl: string,
  processedImageUrl?: string
) {
  return {
    user_id: userId,
    
    // Name derived from item_type (convert underscores to spaces for display)
    name: item.item_type.replace(/_/g, ' '),
    
    // 12 Visual Fields
    category: item.category,
    item_type: item.item_type,
    fit_silhouette: item.fit_silhouette,
    length: item.length,
    primary_color_hex: item.primary_color_hex,
    secondary_palette: item.secondary_palette,
    pattern_type: item.pattern_type,
    pattern_geometry: item.pattern_geometry,
    graphic_summary: item.graphic_summary,
    sleeve_neck_summary: item.sleeve_neck_summary,
    fabric_family: item.fabric_family,
    fabric_behavior: item.fabric_behavior,
    
    // Metadata
    bbox: item.bbox,
    visible_area_ratio: item.visible_area_ratio,
    confidence: item.confidence,
    
    // Images
    original_image_url: originalImageUrl,
    image_url: originalImageUrl,
    processed_image_url: processedImageUrl || originalImageUrl,
    
    // Legacy fields for backward compatibility
    color: item.primary_color_hex,
    primary_color: item.primary_color_hex,
    pattern: item.pattern_type,
    fit_type: item.fit_silhouette.split('-')[0], // Extract fit portion
    silhouette: item.fit_silhouette.split('-')[1] || item.fit_silhouette, // Extract silhouette
    
    // Phase 2 fields (will be added by enrichment)
    style_aesthetic: null,
    formality_level: null,
    suitable_occasions: null,
    season: null,
    weather_suitability: null,
    brand: null,
    condition: null,
    special_features: null,
    style_notes_detailed: null,
  };
}
