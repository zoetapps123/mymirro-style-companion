import { callGeminiAPI } from '../_shared/ai-config.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';
import { ClothingItem } from './detectItems.ts';

export interface CompositeResult {
  compositeImageUrl: string;
  gridLayout: {
    rows: number;
    columns: number;
    itemCount: number;
  };
}

export async function generateComposite(
  imageUrl: string,
  items: ClothingItem[],
  apiKey: string
): Promise<CompositeResult> {
  console.log('Step 2: Generating composite image...');
  
  const itemsList = items.map((item, idx) => 
    `${idx + 1}. ${item.name} (${item.category})`
  ).join('\n');

  let compositeData;
  try {
    console.log('Calling Gemini image model for composite generation...');
    compositeData = await callGeminiAPI({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: WARDROBE_PROMPTS.GENERATE_COMPOSITE(itemsList)
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      modalities: ['image', 'text']
    });
    console.log('Composite generation response received:', JSON.stringify(compositeData, null, 2));
  } catch (error) {
    console.error('Failed to generate composite:', error);
    throw new Error('Failed to generate composite image');
  }
  
  if (!compositeData || !compositeData.choices || compositeData.choices.length === 0) {
    console.error('Invalid composite response structure:', compositeData);
    throw new Error('Invalid response from composite image generation');
  }
  
  // Extract generated image from response
  const generatedImage = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!generatedImage) {
    console.error('No image generated in response:', compositeData);
    throw new Error('AI did not generate a composite image');
  }
  
  const compositeImageUrl = generatedImage;

  console.log(`Successfully generated composite description with ${items.length} items`);

  // Calculate grid layout
  const itemCount = items.length;
  const columns = Math.min(3, Math.ceil(Math.sqrt(itemCount)));
  const rows = Math.ceil(itemCount / columns);

  return {
    compositeImageUrl,
    gridLayout: { rows, columns, itemCount }
  };
}
