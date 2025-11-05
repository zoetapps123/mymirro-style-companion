import { callGeminiAPI } from '../_shared/ai-config.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';

export interface ClothingItem {
  name: string;
  category: 'Tops' | 'Bottoms' | 'Layers' | 'Dresses' | 'Shoes' | 'Accessories';
  color: string;
  fabric: string;
  texture: string;
  pattern: string;
  style_notes: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  console.log('Step 1: Detecting clothing items...');
  
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
          description: 'Extract distinct clothing items with accurate color, fabric, and design details',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Descriptive name (e.g., Navy Blue Denim Jacket)'
                    },
                    category: {
                      type: 'string',
                      enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories']
                    },
                    color: {
                      type: 'string',
                      description: 'Accurate primary color hex code'
                    },
                    fabric: {
                      type: 'string',
                      description: 'Fabric type (cotton, silk, denim, etc.)'
                    },
                    texture: {
                      type: 'string',
                      description: 'Texture detail (smooth, ribbed, quilted, etc.)'
                    },
                    pattern: {
                      type: 'string',
                      description: 'Pattern type (solid, striped, floral, etc.)'
                    },
                    style_notes: {
                      type: 'string',
                      description: 'Cut and unique features'
                    },
                    bbox: {
                      type: 'object',
                      description: 'Bounding box coordinates in the original image (normalized 0-1)',
                      properties: {
                        x: { type: 'number', description: 'Left edge (0-1)' },
                        y: { type: 'number', description: 'Top edge (0-1)' },
                        width: { type: 'number', description: 'Width (0-1)' },
                        height: { type: 'number', description: 'Height (0-1)' }
                      },
                      required: ['x', 'y', 'width', 'height']
                    }
                  },
                  required: ['name', 'category', 'color', 'fabric', 'texture', 'pattern', 'style_notes', 'bbox']
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
  console.log('Detection response structure:', JSON.stringify(detectionData, null, 2));
  
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

  // Deduplicate items
  const deduplicatedItems: ClothingItem[] = [];
  const seen = new Set<string>();
  
  for (const item of detectionResult.items) {
    const key = `${item.category.toLowerCase()}_${item.name.toLowerCase().substring(0, 15)}_${item.color}`;
    
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
