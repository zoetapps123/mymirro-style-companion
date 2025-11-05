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
4. PRECISE bounding box in normalized coordinates (0.0 to 1.0)

**CRITICAL BOUNDING BOX RULES**:
- Each bbox must contain EXACTLY ONE item only
- Draw the box TIGHTLY around the item's visible edges
- Exclude all white background/padding
- If you see a shirt, its bbox should ONLY include the shirt
- If you see a belt, its bbox should ONLY include the belt
- NEVER group multiple items in one bbox
- Boxes must NOT overlap
- Use normalized coordinates: x (left edge), y (top edge), width, height (all 0.0-1.0)

**READING ORDER**: 
Return items from left-to-right, top-to-bottom (like reading text).

Example good bbox: Shirt at top-left of 800x600 composite, actual item pixels 50-300 horizontal, 40-280 vertical:
{x: 0.0625, y: 0.067, width: 0.3125, height: 0.4}

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
                      description: 'Tight bounding box in normalized 0-1 coordinates, excluding white space',
                      properties: {
                        x: { type: 'number', description: 'Left edge (0.0 = left side, 1.0 = right side)', minimum: 0, maximum: 1 },
                        y: { type: 'number', description: 'Top edge (0.0 = top, 1.0 = bottom)', minimum: 0, maximum: 1 },
                        width: { type: 'number', description: 'Box width as fraction of image width', minimum: 0.01, maximum: 1 },
                        height: { type: 'number', description: 'Box height as fraction of image height', minimum: 0.01, maximum: 1 }
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
        const stripped = rawContent.replace(/```json|```/gi, '').trim();
        try {
          const result = JSON.parse(stripped);
          if (result.items && Array.isArray(result.items)) {
            console.log(`Detected ${result.items.length} items in composite (fallback)`);
            return result.items;
          }
        } catch (e) {
          console.error('Fallback parse failed:', e);
        }
      }
      
      console.error('No tool_calls or valid content in composite detection response');
      throw new Error('Failed to detect items in composite - invalid API response');
    }

    const result = JSON.parse(toolArgs);
    console.log(`Detected ${result.items.length} items in composite with bounding boxes`);
    
    // Validate bboxes - warn if any are suspiciously large (might contain multiple items)
    result.items.forEach((item: CompositeDetection, idx: number) => {
      const area = item.bbox.width * item.bbox.height;
      if (area > 0.35) { // More than 35% of image
        console.warn(`Item ${idx} "${item.name}" has large bbox (area: ${(area * 100).toFixed(1)}%) - might contain multiple items`);
      }
    });
    
    return result.items;
  } catch (error) {
    console.error('Error in detectCompositeItems:', error);
    throw error;
  }
}
