import { callGeminiAPI } from '../_shared/ai-config.ts';

export interface CompositeDetection {
  name: string;
  category: string;
  color: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Calculate overlap ratio between two bounding boxes (IoU - Intersection over Union)
 */
function calculateOverlap(bbox1: CompositeDetection['bbox'], bbox2: CompositeDetection['bbox']): number {
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

// Merge close shoe boxes (left/right) into a single pair box when they likely represent one pair
function mergeShoePairs(items: CompositeDetection[]): CompositeDetection[] {
  const result: CompositeDetection[] = [];
  const used = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const a = items[i];
    if (a.category !== 'Shoes') {
      result.push(a);
      continue;
    }

    let merged = false;
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const b = items[j];
      if (b.category !== 'Shoes') continue;

      // Heuristics: horizontally near, similar height, small IoU
      const acx = a.bbox.x + a.bbox.width / 2;
      const bcx = b.bbox.x + b.bbox.width / 2;
      const centerDx = Math.abs(acx - bcx);
      const heightRatio = Math.min(a.bbox.height, b.bbox.height) / Math.max(a.bbox.height, b.bbox.height);
      const iou = calculateOverlap(a.bbox, b.bbox);

      if (centerDx < 220 && heightRatio > 0.7 && iou < 0.05) {
        const minX = Math.min(a.bbox.x, b.bbox.x);
        const minY = Math.min(a.bbox.y, b.bbox.y);
        const maxX = Math.max(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width);
        const maxY = Math.max(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height);
        const mergedBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

        result.push({
          name: a.name.includes('shoe') || b.name.includes('shoe') ? 'Pair of Shoes' : `${a.name} + ${b.name}`,
          category: 'Shoes',
          color: a.color || b.color,
          bbox: mergedBox,
        });
        used.add(i);
        used.add(j);
        merged = true;
        break;
      }
    }

    if (!merged) result.push(a);
  }

  return result;
}

/**
 * Detect items in the generated composite image with their actual positions
 */
export async function detectCompositeItems(
  compositeImageUrl: string,
  apiKey: string
): Promise<CompositeDetection[]> {
  console.log('Detecting items in composite image with bounding boxes...');
  
  try {
    const detectionData = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are analyzing a composite grid image with isolated clothing items on a white background.

🚨 CRITICAL TASK: Detect EACH INDIVIDUAL clothing item and provide PRECISE bounding boxes.

**ABSOLUTE RULES**:

1. **ONE ITEM = ONE BOX** (NEVER group multiple items) EXCEPT footwear pairs:
   - SHOES as a pair (left+right) → ONE box containing BOTH shoes
   - Otherwise: SHIRT → one box, PANTS → one box, BLAZER → one box, BAG → one box, BELT → one box, JEWELRY piece → one box

2. **ULTRA-TIGHT BOUNDING BOXES**:
   - Draw edges AS CLOSE AS POSSIBLE to the visible item boundaries
   - Include the ENTIRE item but minimize white space
   - Add only 2-4px padding around the actual item edges
   - Do NOT include grid lines, shadows, or excessive white space
   - The box should hug the item tightly

3. **PIXEL COORDINATES** (Integer values):
   - Format: { x, y, width, height }
   - x, y = top-left corner in pixels (0,0 = top-left of image)
   - width, height = box dimensions in pixels
   - Example: { "x": 50, "y": 100, "width": 200, "height": 300 }

4. **NO OVERLAPPING**: 
   - Each box must be completely separate
   - If boxes overlap, you've grouped multiple items incorrectly — FIX IT
   - Minimum 40px separation between any two boxes

5. **ITEM DETAILS**:
   - name: Descriptive (e.g., "Navy Blue Denim Jacket", "White Cotton T-Shirt")
   - category: MUST be one of: Tops, Bottoms, Shoes, Accessories, Layers, Dresses
   - color: Primary visible color (e.g., "Navy Blue", "White", "Black")

6. **SPECIAL HANDLING (QUALITY)**:
   - Footwear: If both shoes are present, return ONE box enclosing the pair; ensure the box contains both shoes completely
   - Accessories (belts, bags, jewelry, hats, scarves, ties): Scale awareness — these are often small; choose boxes that capture the WHOLE item clearly and avoid ultra-thin strips
   - MINIMUM box size guideline: avoid boxes thinner than ~40px in either dimension; if an item is tiny, include a bit more margin so it's fully visible

7. **OUTPUT ORDER**: 
   - Scan left-to-right, top-to-bottom (reading order)
   - Return items in the order they appear in the grid

**QUALITY CHECK**:
Before returning, verify:
✓ Each box contains ONLY ONE clothing item (or shoe pair)
✓ No boxes overlap
✓ Boxes are ULTRA-TIGHT to item edges with minimal padding (2-4px max)
✓ All coordinates are positive integers`
            },
            {
              type: 'image_url',
              image_url: { url: compositeImageUrl }
            }
          ]
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'detect_composite_items',
          description: 'Detect individual clothing items with precise bounding boxes',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description: 'Array of detected items, each with its own tight bounding box',
                items: {
                  type: 'object',
                  properties: {
                    name: { 
                      type: 'string', 
                      description: 'Specific item name (e.g., "Brown Plaid Flannel Shirt", "Brown Leather Belt")'
                    },
                    category: {
                      type: 'string',
                      enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories'],
                      description: 'Item category'
                    },
                    color: { 
                      type: 'string', 
                      description: 'Primary visible color'
                    },
                    bbox: {
                      type: 'object',
                      description: 'Ultra-tight bounding box in PIXEL coordinates with only 2-4px padding',
                      properties: {
                        x: { type: 'integer', description: 'Left edge in pixels (0 = left side)', minimum: 0 },
                        y: { type: 'integer', description: 'Top edge in pixels (0 = top)', minimum: 0 },
                        width: { type: 'integer', description: 'Box width in pixels', minimum: 1 },
                        height: { type: 'integer', description: 'Box height in pixels', minimum: 1 }
                      },
                      required: ['x', 'y', 'width', 'height']
                    }
                  },
                  required: ['name', 'category', 'color', 'bbox']
                }
              }
            },
            required: ['items']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'detect_composite_items' } }
    });

    console.log('Composite detection response:', JSON.stringify(detectionData, null, 2));

    const toolArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    
    if (!toolArgs) {
      // Try fallback: check for content field
      const rawContent = detectionData?.choices?.[0]?.message?.content;
      if (typeof rawContent === 'string' && rawContent.trim()) {
        console.log('Trying content fallback for composite detection');
        // Extract JSON inside code fences if present
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/i);
        const candidate = jsonMatch ? jsonMatch[1] : rawContent;
        const stripped = candidate.trim();
        try {
          const parsed = JSON.parse(stripped);
          if (Array.isArray(parsed)) {
            console.log(`Detected ${parsed.length} items in composite (fallback array)`);
            return parsed;
          }
          if (parsed.items && Array.isArray(parsed.items)) {
            console.log(`Detected ${parsed.items.length} items in composite (fallback object)`);
            return parsed.items;
          }
        } catch (e) {
          console.error('Fallback parse failed:', e, 'raw snippet:', stripped.slice(0, 200));
        }
      }
      
      console.error('No tool_calls or valid content in composite detection response');
      throw new Error('Failed to detect items in composite - invalid API response');
    }

    const result = JSON.parse(toolArgs);
    console.log(`Detected ${result.items.length} items in composite with bounding boxes`);
    
    // Validate, normalize categories, and filter bboxes with strict-but-fair checks
    const normalizeCategory = (name: string, category: string): CompositeDetection['category'] => {
      const n = (name || '').toLowerCase();
      const c = (category || '').toLowerCase();
      if (/shoe|sneaker|boot|heel|loafer|sandal/.test(n) || c === 'footwear') return 'Shoes';
      if (/belt|bag|watch|bracelet|ring|necklace|earring|hat|cap|scarf|tie|sunglass/.test(n) || c === 'accessory' || c === 'accessories') return 'Accessories';
      if (c === 'jackets' || c === 'outerwear' || c === 'layers') return 'Layers';
      if (c === 'tops' || c === 'top') return 'Tops';
      if (c === 'bottoms' || c === 'bottom') return 'Bottoms';
      if (c === 'dresses' || c === 'dress') return 'Dresses';
      return (category as any) || 'Tops';
    };

    const validItems: CompositeDetection[] = [];
    const imageArea = 1024 * 1024; // fallback when actual image size is unknown

    for (let i = 0; i < result.items.length; i++) {
      const raw = result.items[i];
      const item: CompositeDetection = {
        ...raw,
        category: normalizeCategory(raw.name, raw.category)
      };
      const w = item.bbox.width;
      const h = item.bbox.height;
      const area = w * h;

      // Size validation with category-aware exceptions (belts, small accessories)
      const isAccessory = item.category === 'Accessories';
      const isBeltLike = /belt/.test((item.name || '').toLowerCase());
      const tooLarge = w >= 3000 || h >= 3000;
      const tooSmallGeneral = (w < 40 || h < 40);
      const tooSmallAccessory = !( (w >= 32 && h >= 18) || (w >= 18 && h >= 32) || (isBeltLike && w >= 60 && h >= 12) );

      if (w <= 0 || h <= 0 || tooLarge || (!isAccessory && tooSmallGeneral) || (isAccessory && tooSmallAccessory)) {
        console.warn(`Item ${i} "${item.name}" (${item.category}) invalid size: ${w}x${h}, skipping`);
        continue;
      }

      // Check overlap (strict 5% IoU)
      let hasOverlap = false;
      for (const v of validItems) {
        const overlap = calculateOverlap(item.bbox, v.bbox);
        if (overlap > 0.05) {
          console.warn(`Item ${i} "${item.name}" overlaps ${(overlap * 100).toFixed(1)}% with "${v.name}", skipping`);
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // Proximity: consider items too close only if both center deltas are small
      let tooClose = false;
      for (const v of validItems) {
        const dx = Math.abs((item.bbox.x + item.bbox.width / 2) - (v.bbox.x + v.bbox.width / 2));
        const dy = Math.abs((item.bbox.y + item.bbox.height / 2) - (v.bbox.y + v.bbox.height / 2));
        if (dx < 40 && dy < 40) {
          console.warn(`Item ${i} "${item.name}" too close to "${v.name}" (dx=${dx}, dy=${dy}), skipping`);
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Very large boxes likely span multiple cells; keep but warn only if extreme
      const areaFraction = area / imageArea;
      if (areaFraction > 0.8) {
        console.warn(`Item ${i} "${item.name}" unusually large (${(areaFraction * 100).toFixed(1)}% of image) - review`);
      }

      validItems.push(item);
    }

    const merged = mergeShoePairs(validItems);
    console.log(`Validated ${merged.length}/${result.items.length} items after strict filtering (post-merge)`);
    return merged;
  } catch (error) {
    console.error('Error in detectCompositeItems:', error);
    throw error;
  }
}
