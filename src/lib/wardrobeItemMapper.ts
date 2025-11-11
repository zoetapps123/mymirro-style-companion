/**
 * Maps AI-detected item metadata to database wardrobe_items schema
 * Ensures all fields from the AI response are properly persisted
 */

export interface DetectedItem {
  name: string;
  category: string;
  color?: string;
  primary_color?: string;
  primary_color_name?: string;
  secondary_colors?: string[];
  color_family?: string;
  color_distribution?: number[] | string[];
  pattern_colors?: string[];
  fabric?: string;
  fabric_primary?: string;
  fabric_weight?: string;
  material_finish?: string;
  texture?: string;
  pattern?: string;
  pattern_type?: string;
  pattern_scale?: string;
  style_notes?: string;
  style_notes_detailed?: string;
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
  style_aesthetic?: string[];
  formality_level?: string;
  suitable_occasions?: string[];
  season?: string[];
  weather_suitability?: string;
  waist_style?: string;
  rise?: string;
  heel_type?: string;
  toe_style?: string;
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
    
    // Color fields - prefer primary_color over color for the DB color field
    color: item.primary_color || item.color || null,
    primary_color: item.primary_color || item.color || null,
    primary_color_name: item.primary_color_name || null,
    secondary_colors: item.secondary_colors || null,
    color_family: item.color_family || null,
    color_distribution: Array.isArray(item.color_distribution)
      ? (item.color_distribution as any[])
          .map((v: any) => (typeof v === 'number' ? v : parseFloat(v)))
          .filter((v: any) => Number.isFinite(v))
      : null,
    pattern_colors: item.pattern_colors || null,
    
    // Fabric fields
    fabric: item.fabric || null,
    fabric_primary: item.fabric_primary || item.fabric || null,
    fabric_weight: item.fabric_weight || null,
    material_finish: item.material_finish || null,
    texture: item.texture || null,
    
    // Pattern fields
    pattern: item.pattern || null,
    pattern_type: item.pattern_type || item.pattern || null,
    pattern_scale: item.pattern_scale || null,
    
    // Fit and design fields
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
    
    // Style fields
    special_features: item.special_features || null,
    style_aesthetic: item.style_aesthetic || null,
    formality_level: item.formality_level || null,
    style_notes: item.style_notes || null,
    style_notes_detailed: item.style_notes_detailed || item.style_notes || null,
    
    // Occasion and season
    suitable_occasions: item.suitable_occasions || null,
    season: item.season || null,
    weather_suitability: item.weather_suitability || null,
    
    // Specific garment details
    waist_style: item.waist_style || null,
    rise: item.rise || null,
    heel_type: item.heel_type || null,
    toe_style: item.toe_style || null,
    
    // Item metadata
    brand: item.brand || null,
    condition: item.condition || null,
    
    // Images
    image_url: imageUrl,
    processed_image_url: processedImageUrl || imageUrl,
    composite_image_url: null, // Reserved for future use
  };
}
