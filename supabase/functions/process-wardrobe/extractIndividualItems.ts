import { callGeminiAPI } from '../_shared/ai-config.ts';
import { ClothingItem } from './detectItems.ts';

export interface ExtractedItem {
  item: ClothingItem;
  imageUrl: string;
}

/**
 * Extract each clothing item as an isolated product image
 */
export async function extractIndividualItems(
  originalImageUrl: string,
  items: ClothingItem[],
  apiKey: string
): Promise<ExtractedItem[]> {
  console.log(`Extracting ${items.length} items individually...`);
  
  const extractedItems: ExtractedItem[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`Extracting item ${i + 1}/${items.length}: ${item.name}`);
    
    try {
      const extractData = await callGeminiAPI({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract and isolate ONLY the ${item.name} from this image as a clean product photo.

REQUIREMENTS:
- Show ONLY the clothing item itself (${item.category}: ${item.name})
- Remove the person completely - show the item as if laid flat or on a mannequin
- Pure white background (#FFFFFF)
- Item should be centered, front-facing, and fully visible
- Maintain accurate colors: ${item.color}
- Keep fabric texture: ${item.fabric}, ${item.texture}
- Preserve pattern: ${item.pattern}
- Professional e-commerce product photography style
- No shadows, clean lighting
- Item should take up 60-70% of the frame with white space around it

Generate a single isolated product image of just this item.`
              },
              {
                type: 'image_url',
                image_url: { url: originalImageUrl }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      });

      const generatedImage = extractData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (generatedImage) {
        extractedItems.push({
          item,
          imageUrl: generatedImage
        });
        console.log(`Successfully extracted: ${item.name}`);
      } else {
        console.error(`Failed to extract image for: ${item.name}`);
      }
    } catch (error) {
      console.error(`Error extracting ${item.name}:`, error);
      // Continue with other items even if one fails
    }
  }
  
  console.log(`Successfully extracted ${extractedItems.length}/${items.length} items`);
  return extractedItems;
}
