import { AI_API_ENDPOINT } from '../_shared/ai-config.ts';
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

  const compositeResponse = await fetch(AI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    })
  });

  if (!compositeResponse.ok) {
    const errorText = await compositeResponse.text();
    console.error('Failed to generate composite image:', compositeResponse.status, errorText);
    throw new Error(`Failed to generate composite image: ${compositeResponse.status} ${errorText}`);
  }

  const compositeData = await compositeResponse.json();
  console.log('Composite response structure:', JSON.stringify(compositeData, null, 2));
  
  if (!compositeData || !compositeData.choices || compositeData.choices.length === 0) {
    console.error('Invalid composite response structure:', compositeData);
    throw new Error('Invalid response from composite image generation');
  }
  
  const compositeImageUrl = compositeData.choices[0]?.message?.images?.[0]?.image_url?.url;

  if (!compositeImageUrl) {
    console.error('No composite image URL in response:', compositeData);
    throw new Error('No composite image generated');
  }

  console.log(`Successfully generated composite image with ${items.length} items`);

  // Calculate grid layout
  const itemCount = items.length;
  const columns = Math.min(3, Math.ceil(Math.sqrt(itemCount)));
  const rows = Math.ceil(itemCount / columns);

  return {
    compositeImageUrl,
    gridLayout: { rows, columns, itemCount }
  };
}
