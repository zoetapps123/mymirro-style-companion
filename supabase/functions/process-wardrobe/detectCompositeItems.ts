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
              text: `You are analyzing a composite grid image containing multiple isolated clothing items arranged on a white background.

**TASK**: Detect EACH INDIVIDUAL clothing item and provide PRECISE bounding boxes.

**CRITICAL RULES - READ CAREFULLY**:

1. **ONE ITEM PER BOX**: 
   - If you see a SHIRT, create ONE box for ONLY the shirt
   - If you see PANTS, create ONE box for ONLY the pants  
   - If you see a BLAZER, create ONE box for ONLY the blazer
   - NEVER combine blazer + pants, or shirt + pants, or any multiple items in one box

2. **TIGHT BOUNDING BOXES**:
   - Box edges must be TIGHT to the clothing item edges
   - Exclude ALL white space, padding, shadows, and grid lines
   - Leave minimal margin (5-10 pixels) around the actual item

3. **PIXEL COORDINATES**:
   - Use integer pixel coordinates: { x, y, width, height }
   - x, y = top-left corner position in pixels
   - width, height = box dimensions in pixels
   - Example: { x: 50, y: 100, width: 200, height: 300 }

4. **NO OVERLAPPING**: 
   - Boxes must NOT overlap each other
   - Each box must be for a completely separate item

5. **ITEM DETAILS**:
   - name: Specific item description (e.g., "Brown Plaid Flannel Shirt", "Olive Green Blazer", "Beige Chino Pants")
   - category: Must be one of: Tops, Bottoms, Shoes, Accessories, Layers, Dresses
   - color: Primary visible color

**OUTPUT FORMAT**: Return array of items in left-to-right, top-to-bottom reading order.

**EXAMPLE**:
For a 1024x768 composite with shirt at (100,50) to (400,350):
{ "name": "Brown Plaid Shirt", "category": "Tops", "color": "Brown", "bbox": { "x": 100, "y": 50, "width": 300, "height": 300 } }`
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
    
    // Validate and filter bboxes
    const validItems: CompositeDetection[] = [];
    const imageArea = 1024 * 1024; // assume standard composite size for validation
    
    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const w = item.bbox.width;
      const h = item.bbox.height;
      const area = w * h;
      
      // Check if this bbox overlaps significantly with any already validated box
      let hasOverlap = false;
      for (const validItem of validItems) {
        const overlap = calculateOverlap(item.bbox, validItem.bbox);
        if (overlap > 0.1) { // More than 10% overlap
          console.warn(`Item ${i} "${item.name}" overlaps with "${validItem.name}", skipping`);
          hasOverlap = true;
          break;
        }
      }
      
      if (hasOverlap) continue;
      
      // Warn if bbox is suspiciously large (might contain multiple items)
      const areaFraction = area / imageArea;
      if (areaFraction > 0.3) {
        console.warn(`Item ${i} "${item.name}" has large bbox (${(areaFraction * 100).toFixed(1)}% of image) - might contain multiple items`);
      }
      
      // Validate bbox has reasonable dimensions
      if (w > 0 && h > 0 && w < 2000 && h < 2000) {
        validItems.push(item);
      } else {
        console.warn(`Item ${i} "${item.name}" has invalid dimensions: ${w}x${h}`);
      }
    }
    
    console.log(`Validated ${validItems.length}/${result.items.length} items`);
    return validItems;
  } catch (error) {
    console.error('Error in detectCompositeItems:', error);
    throw error;
  }
}
