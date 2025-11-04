import { AI_API_ENDPOINT } from '../_shared/ai-config.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';

export interface ClothingItem {
  name: string;
  category: 'Tops' | 'Bottoms' | 'Layers' | 'Dresses' | 'Shoes' | 'Accessories';
  color: string;
  fabric: string;
  texture: string;
  pattern: string;
  style_notes: string;
}

export interface DetectionResult {
  items: ClothingItem[];
  needsReupload?: boolean;
  reuploadReason?: string;
}

export async function detectItems(
  imageUrl: string,
  apiKey: string
): Promise<ClothingItem[]> {
  console.log('Step 1: Detecting clothing items...');
  
  const detectionResponse = await fetch(AI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
                    }
                  },
                  required: ['name', 'category', 'color', 'fabric', 'texture', 'pattern', 'style_notes']
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
    })
  });

  if (!detectionResponse.ok) {
    const errorText = await detectionResponse.text();
    console.error('Detection error:', errorText);
    throw new Error('Failed to detect clothing items');
  }

  const detectionData = await detectionResponse.json();
  console.log('Detection response structure:', JSON.stringify(detectionData, null, 2));
  
  const detectionArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!detectionArgs) {
    console.error('Invalid detection response:', detectionData);
    throw new Error('Invalid detection response from AI');
  }
  
  const detectionResult: DetectionResult = JSON.parse(detectionArgs);
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
