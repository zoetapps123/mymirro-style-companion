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
              text: `Analyze this composite grid image containing isolated clothing items on white background.

**YOUR TASK**: For EACH individual clothing item visible, provide:
1. Exact item name
2. Category (Tops/Bottoms/Shoes/Accessories/Layers/Dresses)
3. Dominant color
4. PRECISE bounding box in PIXEL coordinates relative to the composite image (integers)

**CRITICAL BOUNDING BOX RULES**:
- Each bbox must contain EXACTLY ONE item only (no combined items)
- Draw the box TIGHTLY around the item's visible edges
- Exclude all white background/padding
- Do not include grid dividers or shadows
- NEVER group multiple items in one bbox
- Boxes must NOT overlap (IoU between any two boxes < 0.02)
- Pixel format: { x, y, width, height } with x/y as top-left pixel

Also include image dimensions if available: { image_width, image_height }.

**READING ORDER**:
Return items from left-to-right, top-to-bottom (like reading text).

Example good bbox (pixels): For 800x600 image, item at 50-300 (x) and 40-280 (y):
{ x: 50, y: 40, width: 250, height: 240 }

DO NOT return large boxes that encompass multiple items. Each item = one box.`
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
    
    // Validate bboxes - warn if any are suspiciously large (might contain multiple items)
    result.items.forEach((item: CompositeDetection, idx: number) => {
      const w = item.bbox.width;
      const h = item.bbox.height;
      // Only warn for suspicious area when using normalized coordinates
      if (w <= 1 && h <= 1) {
        const area = w * h;
        if (area > 0.35) {
          console.warn(`Item ${idx} "${item.name}" has large bbox (area: ${(area * 100).toFixed(1)}%) - might contain multiple items`);
        }
      }
    });
    
    return result.items;
  } catch (error) {
    console.error('Error in detectCompositeItems:', error);
    throw error;
  }
}
