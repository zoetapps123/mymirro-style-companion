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
  
  const detectionData = await callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Detect all clothing items in this composite grid image. For each item, provide:
1. Name/description
2. Category (Tops/Bottoms/Shoes/Accessories/Layers/Dresses)
3. Primary color
4. EXACT bounding box coordinates (normalized 0-1)

CRITICAL: Bounding boxes must be TIGHT around each item with minimal white space included.

Return items in reading order: left-to-right, top-to-bottom (like reading a book).`
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
        description: 'Detect clothing items in composite grid with bounding boxes',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Item name' },
                  category: {
                    type: 'string',
                    enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories']
                  },
                  color: { type: 'string', description: 'Primary color' },
                  bbox: {
                    type: 'object',
                    description: 'Normalized bounding box (0-1)',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' }
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

  const toolArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  
  if (!toolArgs) {
    throw new Error('Failed to detect items in composite');
  }

  const result = JSON.parse(toolArgs);
  console.log(`Detected ${result.items.length} items in composite with bounding boxes`);
  
  return result.items;
}
