import { callGeminiAPI } from '../_shared/ai-config.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';

export interface ClothingItem {
  // Basic
  name: string;
  category: 'Tops' | 'Bottoms' | 'Outerwear' | 'Dresses' | 'Shoes' | 'Accessories';
  
  // Color (enhanced)
  primary_color: string;
  primary_color_name: string;
  color_family: string;
  secondary_colors?: string[];
  color_distribution?: number[];
  
  // Fabric & material
  fabric_primary: string;
  fabric_weight: string;
  material_finish: string;
  texture: string;
  
  // Pattern
  pattern_type: string;
  pattern_scale: string;
  pattern_colors?: string[];
  
  // Cut & fit
  fit_type: string;
  silhouette: string;
  length: string;
  
  // Design elements
  neckline?: string;
  sleeve_type?: string;
  closure_type: string;
  pocket_details: string;
  hardware_details: string;
  embellishments: string;
  special_features: string[];
  
  // Style & aesthetic
  style_aesthetic: string[];
  formality_level: string;
  style_notes_detailed: string;
  
  // Occasion & use
  suitable_occasions: string[];
  season: string[];
  weather_suitability: string;
  
  // Category-specific
  rise?: string;
  waist_style?: string;
  heel_type?: string;
  toe_style?: string;
  collar_type?: string;
  
  // Optional
  brand?: string;
  condition?: string;
}

export interface DetectionResult {
  items: ClothingItem[];
  needsReupload?: boolean;
  reuploadReason?: string;
}

function stripMarkdown(text: string): string {
  try {
    return text.replace(/```json|```/gi, '').trim();
  } catch {
    return text;
  }
}

export async function detectItems(
  imageUrl: string,
  apiKey: string
): Promise<ClothingItem[]> {
  console.log('Step 1: Detecting clothing items with enhanced metadata...');
  
  let detectionData;
  try {
    detectionData = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: WARDROBE_PROMPTS.DETECT_ITEMS
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'extract_clothing_items',
          description: 'Extract distinct clothing items with comprehensive metadata for deduplication and image generation',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Descriptive name (4-6 words)' },
                    category: { type: 'string', enum: ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Shoes', 'Accessories'] },
                    primary_color: { type: 'string', description: 'Hex code of dominant color' },
                    primary_color_name: { type: 'string', description: 'Human-readable color name' },
                    color_family: { type: 'string', enum: ['neutrals', 'blues', 'reds', 'greens', 'yellows', 'oranges', 'purples', 'pinks', 'earth_tones', 'pastels'] },
                    secondary_colors: { type: 'array', items: { type: 'string' }, description: 'Hex codes of accent colors' },
                    color_distribution: { type: 'array', items: { type: 'number' }, description: 'Percentage distribution' },
                    fabric_primary: { type: 'string', description: 'Primary fabric material' },
                    fabric_weight: { type: 'string', enum: ['lightweight', 'medium', 'heavyweight'] },
                    material_finish: { type: 'string', enum: ['matte', 'glossy', 'distressed', 'brushed', 'washed', 'raw'] },
                    texture: { type: 'string', enum: ['smooth', 'ribbed', 'quilted', 'textured', 'knitted', 'woven'] },
                    pattern_type: { type: 'string', enum: ['solid', 'striped', 'floral', 'geometric', 'plaid', 'polka_dot', 'abstract', 'animal_print', 'tie_dye'] },
                    pattern_scale: { type: 'string', enum: ['none', 'micro', 'small', 'medium', 'large', 'oversized'] },
                    pattern_colors: { type: 'array', items: { type: 'string' } },
                    fit_type: { type: 'string', enum: ['slim_fit', 'regular_fit', 'relaxed_fit', 'oversized', 'tailored', 'bodycon'] },
                    silhouette: { type: 'string', enum: ['straight', 'tapered', 'A-line', 'bodycon', 'flowy', 'boxy', 'fitted'] },
                    length: { type: 'string', enum: ['cropped', 'regular', 'long', 'ankle_length', 'knee_length', 'midi', 'maxi'] },
                    neckline: { type: 'string' },
                    sleeve_type: { type: 'string' },
                    closure_type: { type: 'string' },
                    pocket_details: { type: 'string' },
                    hardware_details: { type: 'string' },
                    embellishments: { type: 'string' },
                    special_features: { type: 'array', items: { type: 'string' } },
                    style_aesthetic: { type: 'array', items: { type: 'string' } },
                    formality_level: { type: 'string', enum: ['casual', 'smart_casual', 'business_casual', 'formal', 'athletic', 'lounge'] },
                    style_notes_detailed: { type: 'string' },
                    suitable_occasions: { type: 'array', items: { type: 'string' } },
                    season: { type: 'array', items: { type: 'string' } },
                    weather_suitability: { type: 'string', enum: ['cold', 'moderate', 'warm', 'versatile'] },
                    rise: { type: 'string' },
                    waist_style: { type: 'string' },
                    heel_type: { type: 'string' },
                    toe_style: { type: 'string' },
                    collar_type: { type: 'string' },
                    brand: { type: 'string' },
                    condition: { type: 'string' }
                  },
                  required: ['name', 'category', 'primary_color', 'primary_color_name', 'color_family', 'fabric_primary', 'fabric_weight', 'material_finish', 'texture', 'pattern_type', 'pattern_scale', 'fit_type', 'silhouette', 'length', 'closure_type', 'pocket_details', 'hardware_details', 'embellishments', 'special_features', 'style_aesthetic', 'formality_level', 'style_notes_detailed', 'suitable_occasions', 'season', 'weather_suitability']
                }
              },
              needsReupload: {
                type: 'boolean',
                description: 'true if any items excluded due to quality issues'
              },
              reuploadReason: {
                type: 'string',
                description: 'explanation if needsReupload is true'
              }
            },
            required: ['items']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'extract_clothing_items' } }
    });
  } catch (error: any) {
    console.error('Detection error:', error);
    throw new Error('Failed to detect clothing items');
  }
  console.log('Detection response received');
  
  const toolArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let detectionResult: DetectionResult | null = null;
  
  if (toolArgs) {
    detectionResult = JSON.parse(toolArgs);
  } else {
    const rawContent = detectionData?.choices?.[0]?.message?.content;
    if (typeof rawContent === 'string' && rawContent.trim()) {
      const stripped = stripMarkdown(rawContent);
      try {
        detectionResult = JSON.parse(stripped);
        console.log('Parsed detection result from content fallback');
      } catch (e) {
        console.error('Fallback JSON parse failed:', e);
        console.error('Raw content:', rawContent);
      }
    }
  }
  
  if (!detectionResult?.items || !Array.isArray(detectionResult.items)) {
    console.error('Invalid detection response:', detectionData);
    throw new Error('Invalid detection response from AI');
  }
  
  console.log('Detected items:', detectionResult.items.length);
  
  if (detectionResult.needsReupload) {
    throw new Error(detectionResult.reuploadReason || 'Image quality issue detected');
  }
  
  // Deduplicate items within the same detection
  const deduplicatedItems: ClothingItem[] = [];
  const seen = new Set<string>();
  
  for (const item of detectionResult.items) {
    const key = `${item.category.toLowerCase()}_${item.name.toLowerCase().substring(0, 15)}_${item.primary_color}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicatedItems.push(item);
    }
  }
  
  console.log(`After deduplication: ${deduplicatedItems.length} items`);
  
  if (deduplicatedItems.length === 0) {
    throw new Error('All detected items were duplicates or invalid');
  }
  
  return deduplicatedItems;
}