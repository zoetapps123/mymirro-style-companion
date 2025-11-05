import { AI_API_ENDPOINT } from '../_shared/ai-config.ts';
import { WARDROBE_PROMPTS, SystemRole, SYSTEM_PROMPTS } from '../_shared/prompts.ts';

export interface ValidationResult {
  isValidForExtraction: boolean;
  contentType: 'human_wearing' | 'clothing_only' | 'invalid';
  rejectionReason?: string;
}

export async function validateImage(
  imageUrl: string,
  apiKey: string
): Promise<ValidationResult> {
  console.log('Step 0: Validating image content...');
  
  const validationResponse = await fetch(AI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: WARDROBE_PROMPTS.VALIDATE_IMAGE
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
          name: 'validate_image_content',
          description: 'Checks if image contains real humans or clothing items',
          parameters: {
            type: 'object',
            properties: {
              isValidForExtraction: {
                type: 'boolean',
                description: 'true if contains humans or clothing'
              },
              contentType: {
                type: 'string',
                enum: ['human_wearing', 'clothing_only', 'invalid'],
                description: 'Type of content in image'
              },
              rejectionReason: {
                type: 'string',
                description: 'Only if isValidForExtraction is false'
              }
            },
            required: ['isValidForExtraction', 'contentType']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'validate_image_content' } }
    })
  });

  if (validationResponse.status === 429) {
    throw new Error('Rate limit exceeded. Please try again in a moment.');
  }

  if (validationResponse.status === 402) {
    throw new Error('AI credits depleted. Please add credits to continue.');
  }

  const validationData = await validationResponse.json();
  console.log('Validation response structure:', JSON.stringify(validationData, null, 2));

  // Check if AI returned an error response
  if (validationData.error) {
    console.error('AI API validation error:', validationData.error);
    throw new Error(validationData.error.message || 'The AI could not process this image. Please try a different photo with better lighting and clarity.');
  }

  let validationResult: ValidationResult | null = null;

  // 1) Try tool-calls path
  try {
    const validationArgs = validationData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (validationArgs) {
      validationResult = JSON.parse(validationArgs);
    }
  } catch (e) {
    console.warn('Failed to parse validation tool arguments:', e);
  }

  // 2) Fallback: try to parse JSON from content
  if (!validationResult) {
    const content = validationData?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      try {
        validationResult = JSON.parse(content);
      } catch (_) {}
    }
  }

  // 3) Fallback: make a JSON-only request
  if (!validationResult) {
    console.log('Falling back to JSON-only validation call...');
    const fallbackResp = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[SystemRole.IMAGE_PROCESSOR] },
          {
            role: 'user',
            content: [
              { type: 'text', text: WARDROBE_PROMPTS.VALIDATE_IMAGE_FALLBACK },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    const fallbackData = await fallbackResp.json();
    console.log('Validation fallback response:', JSON.stringify(fallbackData, null, 2));
    
    // Check for error in fallback response
    if (fallbackData.error) {
      console.error('AI API fallback validation error:', fallbackData.error);
      throw new Error('Unable to analyze this image. Please ensure the photo is clear, well-lit, and contains visible clothing items or a person wearing clothes.');
    }
    
    const fallbackContent = fallbackData?.choices?.[0]?.message?.content;
    if (typeof fallbackContent === 'string') {
      try {
        validationResult = JSON.parse(fallbackContent);
      } catch (e) {
        console.error('Failed to parse fallback validation JSON:', e);
      }
    }
  }

  if (!validationResult || typeof validationResult.isValidForExtraction !== 'boolean' || !validationResult.contentType) {
    console.error('Invalid validation result after all strategies:', validationResult);
    throw new Error('Invalid validation response from AI');
  }

  console.log('Validation result:', validationResult);

  if (!validationResult.isValidForExtraction) {
    throw new Error(validationResult.rejectionReason || 'Image does not contain valid clothing or humans wearing clothing');
  }

  return validationResult;
}
