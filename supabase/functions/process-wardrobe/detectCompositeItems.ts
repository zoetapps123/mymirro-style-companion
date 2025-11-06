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

1. **ONE ITEM = ONE BOX** (NEVER group multiple items):
   - SHIRT → ONE box for ONLY the shirt
   - PANTS → ONE box for ONLY the pants  
   - BLAZER → ONE box for ONLY the blazer
   - SHOES → ONE box for ONLY the shoes
   - NEVER combine: blazer+shirt, shirt+pants, etc. in one box

2. **TIGHT BOUNDING BOXES**:
   - Draw box edges TIGHT to the visible clothing item boundaries
   - Include the ENTIRE item but exclude white space
   - Add only 8-12 pixels padding around the actual item edges
   - Do NOT include grid lines, shadows, or excessive white space

3. **PIXEL COORDINATES** (Integer values):
   - Format: { x, y, width, height }
   - x, y = top-left corner in pixels (0,0 = top-left of image)
   - width, height = box dimensions in pixels
   - Example: { "x": 50, "y": 100, "width": 200, "height": 300 }

4. **NO OVERLAPPING**: 
   - Each box must be completely separate
   - If boxes overlap, you've grouped multiple items - FIX IT
   - Minimum 40px separation between any two boxes

5. **ITEM DETAILS**:
   - name: Descriptive (e.g., "Navy Blue Denim Jacket", "White Cotton T-Shirt")
   - category: MUST be one of: Tops, Bottoms, Shoes, Accessories, Layers, Dresses
   - color: Primary visible color (e.g., "Navy Blue", "White", "Black")

6. **OUTPUT ORDER**: 
   - Scan left-to-right, top-to-bottom (reading order)
   - Return items in the order they appear in the grid

**QUALITY CHECK**:
Before returning, verify:
✓ Each box contains ONLY ONE clothing item
✓ No boxes overlap
✓ Boxes are tight to item edges (not including excessive white space)
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
                      description: 'Tight bounding box in PIXEL coordinates, excluding white space',
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
    
    // Validate and filter bboxes with strict checks
    const validItems: CompositeDetection[] = [];
    const imageArea = 1024 * 1024;
    
    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const w = item.bbox.width;
      const h = item.bbox.height;
      const area = w * h;
      
      // Skip invalid dimensions
      if (w <= 0 || h <= 0 || w >= 2000 || h >= 2000) {
        console.warn(`Item ${i} "${item.name}" has invalid dimensions: ${w}x${h}, skipping`);
        continue;
      }
      
      // Check overlap with already validated boxes (strict 5% threshold)
      let hasOverlap = false;
      for (const validItem of validItems) {
        const overlap = calculateOverlap(item.bbox, validItem.bbox);
        if (overlap > 0.05) {
          console.warn(`Item ${i} "${item.name}" overlaps ${(overlap * 100).toFixed(1)}% with "${validItem.name}", skipping`);
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Check proximity (minimum 30px separation)
      let tooClose = false;
      for (const validItem of validItems) {
        const dx = Math.abs((item.bbox.x + item.bbox.width / 2) - (validItem.bbox.x + validItem.bbox.width / 2));
        const dy = Math.abs((item.bbox.y + item.bbox.height / 2) - (validItem.bbox.y + validItem.bbox.height / 2));
        const minDist = Math.min(dx, dy);
        if (minDist < 30) {
          console.warn(`Item ${i} "${item.name}" too close to "${validItem.name}" (${minDist}px), skipping`);
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      // Warn if bbox is suspiciously large (might contain multiple items)
      const areaFraction = area / imageArea;
      if (areaFraction > 0.4) {
        console.warn(`Item ${i} "${item.name}" has very large bbox (${(areaFraction * 100).toFixed(1)}% of image) - might contain multiple items, skipping`);
        continue;
      }
      
      validItems.push(item);
    }
    
    console.log(`Validated ${validItems.length}/${result.items.length} items after strict filtering`);
    return validItems;
  } catch (error) {
    console.error('Error in detectCompositeItems:', error);
    throw error;
  }
}
