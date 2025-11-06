import { callGeminiAPI } from '../_shared/ai-config.ts';

export interface ClothingItemWithBbox {
  name: string;
  category: 'Tops' | 'Bottoms' | 'Layers' | 'Dresses' | 'Shoes' | 'Accessories';
  color: string;
  fabric: string;
  texture: string;
  pattern: string;
  style_notes: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Detect items with bounding boxes in a single pass
 * This replaces the old 3-step process (detect → composite → detectComposite)
 */
export async function detectItemsWithBbox(
  imageUrl: string,
  apiKey: string
): Promise<ClothingItemWithBbox[]> {
  console.log('Detecting items with bounding boxes in original image...');
  
  const detectionData = await callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are analyzing an image containing clothing items (either worn by a person or laid out).

**YOUR TASK**: Detect EVERY distinct clothing item and provide PRECISE bounding boxes for each.

**CRITICAL DETECTION RULES**:

1. **ONE ITEM = ONE BOX**:
   - Each piece of clothing gets exactly ONE bounding box
   - NEVER combine multiple items (shirt + pants, blazer + shirt, etc.)
   - Each box must contain ONLY a single clothing item

2. **PRECISE BOUNDING BOXES**:
   - Use pixel coordinates: {x, y, width, height}
   - x, y = top-left corner of the item (in pixels)
   - width, height = dimensions of the item (in pixels)
   - Box should tightly fit the clothing item with 5-10px padding
   - NO overlapping boxes between different items

3. **ITEM ATTRIBUTES** (extract from the ORIGINAL image):
   - name: Descriptive name (e.g., "Navy Blue Denim Jacket")
   - category: Tops | Bottoms | Layers | Dresses | Shoes | Accessories
   - color: PRIMARY visible color (accurate, not lighting-affected)
   - fabric: Material type (cotton, silk, denim, leather, wool, polyester, etc.)
   - texture: Surface feel (smooth, ribbed, quilted, textured, etc.)
   - pattern: Design (solid, striped, floral, geometric, plaid, etc.)
   - style_notes: Cut/fit/unique features (slim fit, oversized, cropped, button-down, etc.)

4. **QUALITY CHECKS**:
   - Only include items that are clearly visible and identifiable
   - Skip items that are:
     * Too small or partially visible
     * Heavily obscured or blurry
     * Poor lighting or unclear details
   - Ensure accurate color representation (not washed out by lighting)

**DUPLICATE PREVENTION**:
- If you see similar items, only include ONE unless they differ in:
  * Color AND (pattern OR fabric OR cut)
  * Example: Two white shirts → include only one
  * Example: White cotton shirt + white silk blouse → include both

**OUTPUT FORMAT**:
Return array of items in natural reading order (top to bottom, left to right).

**EXAMPLE OUTPUT**:
{
  "name": "Navy Blue Denim Jacket",
  "category": "Layers",
  "color": "#1B3A5F",
  "fabric": "denim",
  "texture": "textured",
  "pattern": "solid",
  "style_notes": "Classic fit with button closure and chest pockets",
  "bbox": { "x": 120, "y": 50, "width": 280, "height": 320 }
}`
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
        name: 'detect_clothing_items_with_bboxes',
        description: 'Detect clothing items with precise bounding boxes and detailed attributes',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'Array of detected clothing items with bounding boxes',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Descriptive name (e.g., "Navy Blue Denim Jacket")'
                  },
                  category: {
                    type: 'string',
                    enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories'],
                    description: 'Item category'
                  },
                  color: {
                    type: 'string',
                    description: 'Primary visible color (hex code preferred)'
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
                    description: 'Cut, fit, and unique features'
                  },
                  bbox: {
                    type: 'object',
                    description: 'Precise bounding box in pixel coordinates',
                    properties: {
                      x: {
                        type: 'integer',
                        description: 'Left edge in pixels (0 = left side of image)',
                        minimum: 0
                      },
                      y: {
                        type: 'integer',
                        description: 'Top edge in pixels (0 = top of image)',
                        minimum: 0
                      },
                      width: {
                        type: 'integer',
                        description: 'Box width in pixels',
                        minimum: 1
                      },
                      height: {
                        type: 'integer',
                        description: 'Box height in pixels',
                        minimum: 1
                      }
                    },
                    required: ['x', 'y', 'width', 'height']
                  }
                },
                required: ['name', 'category', 'color', 'fabric', 'texture', 'pattern', 'style_notes', 'bbox']
              }
            }
          },
          required: ['items']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'detect_clothing_items_with_bboxes' } }
  });

  console.log('Detection response:', JSON.stringify(detectionData, null, 2));

  const toolArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  
  if (!toolArgs) {
    // Fallback: try content field
    const rawContent = detectionData?.choices?.[0]?.message?.content;
    if (typeof rawContent === 'string' && rawContent.trim()) {
      console.log('Trying content fallback for detection');
      const stripped = rawContent.replace(/```json|```/gi, '').trim();
      try {
        const parsed = JSON.parse(stripped);
        if (Array.isArray(parsed)) {
          console.log(`Detected ${parsed.length} items (fallback array)`);
          return validateAndCleanItems(parsed);
        }
        if (parsed.items && Array.isArray(parsed.items)) {
          console.log(`Detected ${parsed.items.length} items (fallback object)`);
          return validateAndCleanItems(parsed.items);
        }
      } catch (e) {
        console.error('Fallback parse failed:', e);
      }
    }
    
    console.error('No tool_calls or valid content in detection response');
    throw new Error('Failed to detect items - invalid API response');
  }

  const result = JSON.parse(toolArgs);
  console.log(`Raw detection: ${result.items.length} items`);
  
  return validateAndCleanItems(result.items);
}

/**
 * Validate and clean detected items
 */
function validateAndCleanItems(items: any[]): ClothingItemWithBbox[] {
  const validItems: ClothingItemWithBbox[] = [];
  const seenKeys = new Set<string>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Validate required fields
    if (!item.name || !item.category || !item.bbox) {
      console.warn(`Item ${i} missing required fields, skipping`);
      continue;
    }
    
    const bbox = item.bbox;
    
    // Validate bbox dimensions
    if (!bbox.x && bbox.x !== 0 || !bbox.y && bbox.y !== 0 || !bbox.width || !bbox.height) {
      console.warn(`Item ${i} "${item.name}" has invalid bbox, skipping`);
      continue;
    }
    
    if (bbox.width < 20 || bbox.height < 20) {
      console.warn(`Item ${i} "${item.name}" bbox too small (${bbox.width}x${bbox.height}), skipping`);
      continue;
    }
    
    if (bbox.width > 4000 || bbox.height > 4000) {
      console.warn(`Item ${i} "${item.name}" bbox too large (${bbox.width}x${bbox.height}), skipping`);
      continue;
    }
    
    // Check for duplicates (same category + similar color + similar name)
    const key = `${item.category.toLowerCase()}_${item.color.substring(0, 7)}_${item.name.toLowerCase().substring(0, 10)}`;
    if (seenKeys.has(key)) {
      console.log(`Skipping duplicate: ${item.name}`);
      continue;
    }
    seenKeys.add(key);
    
    // Check for overlaps with already validated items
    let hasOverlap = false;
    for (const validItem of validItems) {
      const overlap = calculateOverlap(bbox, validItem.bbox);
      if (overlap > 0.15) { // 15% overlap threshold
        console.warn(`Item ${i} "${item.name}" overlaps with "${validItem.name}" by ${(overlap * 100).toFixed(1)}%, skipping`);
        hasOverlap = true;
        break;
      }
    }
    
    if (hasOverlap) continue;
    
    // Add validated item
    validItems.push({
      name: item.name,
      category: item.category,
      color: item.color || '#808080',
      fabric: item.fabric || 'unknown',
      texture: item.texture || 'smooth',
      pattern: item.pattern || 'solid',
      style_notes: item.style_notes || '',
      bbox: {
        x: Math.round(bbox.x),
        y: Math.round(bbox.y),
        width: Math.round(bbox.width),
        height: Math.round(bbox.height)
      }
    });
  }
  
  console.log(`Validated ${validItems.length}/${items.length} items`);
  return validItems;
}

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
function calculateOverlap(bbox1: any, bbox2: any): number {
  const x1 = Math.max(bbox1.x, bbox2.x);
  const y1 = Math.max(bbox1.y, bbox2.y);
  const x2 = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width);
  const y2 = Math.min(bbox1.y + bbox1.height, bbox2.y + bbox2.height);
  
  if (x2 <= x1 || y2 <= y1) return 0; // No overlap
  
  const intersectionArea = (x2 - x1) * (y2 - y1);
  const bbox1Area = bbox1.width * bbox1.height;
  const bbox2Area = bbox2.width * bbox2.height;
  const unionArea = bbox1Area + bbox2Area - intersectionArea;
  
  return intersectionArea / unionArea;
}
