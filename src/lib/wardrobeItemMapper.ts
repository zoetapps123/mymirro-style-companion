/**
 * Maps AI-detected item metadata to database wardrobe_items schema
 * Ensures all fields from the AI response are properly persisted
 */

export interface DetectedItem {
  name: string;
  category: string;
  
  // Phase 1 visual fields
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  primary_color_hex?: string;
  color_palette?: string[];
  pattern_geometry?: string;
  pattern_coverage?: string;
  color_blocking_layout?: string;
  graphic_type?: string;
  graphic_location?: string;
  graphic_size?: string;
  hem_style?: string;
  shoulder_style?: string;
  layers_detected?: string;
  visual_summary?: string;
  
  // Legacy color fields
  color?: string;
  primary_color?: string;
  primary_color_name?: string;
  secondary_colors?: string[];
  color_family?: string;
  color_distribution?: number[] | string[];
  pattern_colors?: string[];
  
  // Fabric fields
  fabric?: string;
  fabric_primary?: string;
  fabric_weight?: string;
  material_finish?: string;
  texture?: string;
  
  // Pattern fields
  pattern?: string;
  pattern_type?: string;
  pattern_scale?: string;
  
  // Style fields (Phase 2 semantic)
  style_notes?: string;
  style_notes_detailed?: string;
  style_aesthetic?: string[];
  formality_level?: string;
  suitable_occasions?: string[];
  season?: string[];
  weather_suitability?: string;
  
  // Fit and design fields
  fit_type?: string;
  silhouette?: string;
  length?: string;
  neckline?: string;
  sleeve_type?: string;
  collar_type?: string;
  closure_type?: string;
  pocket_details?: string;
  hardware_details?: string;
  embellishments?: string;
  special_features?: string[];
  
  // Category-specific
  waist_style?: string;
  rise?: string;
  heel_type?: string;
  toe_style?: string;
  
  // Item metadata
  brand?: string;
  condition?: string;
  imageUrl?: string;
  processedImageUrl?: string;
}

export function mapDetectedItemToDbRecord(
  item: DetectedItem,
  userId: string,
  imageUrl: string,
  processedImageUrl?: string
) {
  return {
    user_id: userId,
    name: item.name,
    category: item.category,
    
    // Phase 1 visual metadata fields
    bbox: item.bbox || null,
    primary_color_hex: item.primary_color_hex || null,
    color_palette: item.color_palette || null,
    pattern_geometry: item.pattern_geometry || null,
    pattern_coverage: item.pattern_coverage || null,
    color_blocking_layout: item.color_blocking_layout || null,
    graphic_type: item.graphic_type || null,
    graphic_location: item.graphic_location || null,
    graphic_size: item.graphic_size || null,
    hem_style: item.hem_style || null,
    shoulder_style: item.shoulder_style || null,
    layers_detected: item.layers_detected || null,
    visual_summary: item.visual_summary || null,
    
    // Legacy color fields - map from new fields when available
    color: item.primary_color_hex || item.primary_color || item.color || null,
    primary_color: item.primary_color_hex || item.primary_color || item.color || null,
    primary_color_name: item.primary_color_name || null,
    secondary_colors: item.secondary_colors || null,
    color_family: item.color_family || null,
    color_distribution: Array.isArray(item.color_distribution)
      ? (item.color_distribution as any[])
          .map((v: any) => (typeof v === 'number' ? v : parseFloat(v)))
          .filter((v: any) => Number.isFinite(v))
      : null,
    pattern_colors: item.pattern_colors || null,
    
    // Fabric fields (Phase 2 semantic)
    fabric: item.fabric || null,
    fabric_primary: item.fabric_primary || item.fabric || null,
    fabric_weight: item.fabric_weight || null,
    material_finish: item.material_finish || null,
    texture: item.texture || null,
    
    // Pattern fields
    pattern: item.pattern || null,
    pattern_type: item.pattern_type || item.pattern || null,
    pattern_scale: item.pattern_scale || null,
    
    // Fit and design fields (Phase 1 visual)
    fit_type: item.fit_type || null,
    silhouette: item.silhouette || null,
    length: item.length || null,
    neckline: item.neckline || null,
    sleeve_type: item.sleeve_type || null,
    collar_type: item.collar_type || null,
    closure_type: item.closure_type || null,
    pocket_details: item.pocket_details || null,
    hardware_details: item.hardware_details || null,
    embellishments: item.embellishments || null,
    
    // Style fields (Phase 2 semantic)
    special_features: item.special_features || null,
    style_aesthetic: item.style_aesthetic || null,
    formality_level: item.formality_level || null,
    style_notes: item.style_notes || null,
    style_notes_detailed: item.style_notes_detailed || item.style_notes || null,
    
    // Occasion and season (Phase 2 semantic)
    suitable_occasions: item.suitable_occasions || null,
    season: item.season || null,
    weather_suitability: item.weather_suitability || null,
    
    // Specific garment details
    waist_style: item.waist_style || null,
    rise: item.rise || null,
    heel_type: item.heel_type || null,
    toe_style: item.toe_style || null,
    
    // Item metadata (Phase 2 semantic)
    brand: item.brand || null,
    condition: item.condition || null,
    
    // Images
    image_url: imageUrl,
    processed_image_url: processedImageUrl || imageUrl,
    composite_image_url: null, // Reserved for future use
  };
}
