/**
 * Maps AI-detected item metadata to database wardrobe_items schema
 * Simplified to 15 core styling fields for outfit generation
 */

export interface DetectedItem {
  name: string;
  category: string;
  
  // Core 15 styling fields
  color?: string;
  pattern_type?: string;
  pattern_description?: string;
  fabric_primary?: string;
  texture?: string;
  fit_type?: string;
  length?: string;
  formality_level?: string;
  suitable_occasions?: string[];
  style_aesthetic?: string[];
  season?: string[];
  weather_suitability?: string;
  item_type?: string;
  style_notes_detailed?: string;
  
  // Image URLs
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
    
    // Core 15 styling fields
    color: item.color || null,
    pattern_type: item.pattern_type || null,
    pattern_description: item.pattern_description || null,
    fabric_primary: item.fabric_primary || null,
    texture: item.texture || null,
    fit_type: item.fit_type || null,
    length: item.length || null,
    formality_level: item.formality_level || null,
    suitable_occasions: item.suitable_occasions || null,
    style_aesthetic: item.style_aesthetic || null,
    season: item.season || null,
    weather_suitability: item.weather_suitability || null,
    item_type: item.item_type || null,
    style_notes_detailed: item.style_notes_detailed || null,
    
    // Images
    image_url: imageUrl,
    processed_image_url: processedImageUrl || imageUrl,
    original_image_url: imageUrl,
  };
}
