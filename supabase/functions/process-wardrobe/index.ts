import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AI_API_ENDPOINT, getAIApiKey } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData, imageUrl } = await req.json();
    const apiKey = getAIApiKey();

    const actualImageUrl = imageUrl || imageData;
    if (!actualImageUrl) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Processing image...');

    // STEP 0: Image Validation (Human OR Clothing)
    console.log('Step 0: Validating image content...');
    const validationResponse = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and determine if it contains EITHER: 1) At least one real, non-AI human wearing clothing, OR 2) Clothing items visible on surfaces (bed, floor, hanger, mannequin). Reject images that contain ONLY: animals without clothing context, random objects unrelated to fashion, cartoons or AI-generated scenes, empty rooms or landscapes.'
              },
              {
                type: 'image_url',
                image_url: { url: actualImageUrl }
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
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in a moment.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (validationResponse.status === 402) {
      return new Response(JSON.stringify({ 
        error: 'AI credits depleted. Please add credits to continue.' 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validationData = await validationResponse.json();
    console.log('Validation response structure:', JSON.stringify(validationData, null, 2));

    // Check if AI returned an error response
    if (validationData.error) {
      console.error('AI API validation error:', validationData.error);
      return new Response(JSON.stringify({ 
        error: 'Image processing failed',
        message: validationData.error.message || 'The AI could not process this image. Please try a different photo with better lighting and clarity.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let validationResult: any | null = null;

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
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Respond with STRICT JSON only. No prose.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Classify the image. Return JSON with keys: isValidForExtraction (boolean), contentType ("human_wearing"|"clothing_only"|"invalid"), rejectionReason (optional string if invalid). JSON only.' },
                { type: 'image_url', image_url: { url: actualImageUrl } }
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
        return new Response(JSON.stringify({ 
          error: 'Image processing failed',
          message: 'Unable to analyze this image. Please ensure the photo is clear, well-lit, and contains visible clothing items or a person wearing clothes.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
      return new Response(JSON.stringify({ error: 'Invalid validation response from AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Validation result:', validationResult);

    if (!validationResult.isValidForExtraction) {
      return new Response(JSON.stringify({
        error: 'Invalid image',
        message: validationResult.rejectionReason || 'Image does not contain valid clothing or humans wearing clothing'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STEP 1: Enhanced Item Detection
    console.log('Step 1: Detecting clothing items...');
    const detectionResponse = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Detect ALL distinct clothing items in this image with EXTREME ATTENTION TO:

**COLOR ACCURACY**
- Identify the TRUE dominant color, not lighting artifacts
- Return precise hex codes (e.g., #2C3E50 for navy, not #000000 for black)
- Distinguish between similar shades (e.g., cream vs. white, navy vs. black)

**TEXTURE & FABRIC CAPTURE**
- Identify fabric type: cotton, silk, denim, leather, wool, polyester, linen, etc.
- Note texture details: ribbed, smooth, textured, quilted, etc.
- Capture pattern: solid, striped, floral, geometric, polka dot, etc.

**DESIGN DETAILS**
- Cut/style: slim fit, oversized, cropped, fitted, etc.
- Unique features: buttons, zippers, pockets, collars, sleeves

**DUPLICATE PREVENTION**
- If multiple similar items appear, only extract if they are DISTINCTLY different
- Items must differ in at least TWO of: color, pattern, fabric, or cut

INCLUSION CRITERIA: Clearly visible, well-lit, identifiable category and design
EXCLUSION CRITERIA: Too small, blurry, poorly lit, partially visible, or duplicate`
              },
              {
                type: 'image_url',
                image_url: { url: actualImageUrl }
              }
            ]
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_clothing_items',
            description: 'Extract distinct clothing items with accurate color, fabric, and design details',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Descriptive name (e.g., Navy Blue Denim Jacket)'
                      },
                      category: {
                        type: 'string',
                        enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories']
                      },
                      color: {
                        type: 'string',
                        description: 'Accurate primary color hex code'
                      },
                      fabric: {
                        type: 'string',
                        description: 'Fabric type (cotton, silk, denim, etc.)'
                      },
                      texture: {
                        type: 'string',
                        description: 'Texture detail (smooth, ribbed, quilted, etc.)'
                      },
                      pattern: {
                        type: 'string',
                        description: 'Pattern type (solid, striped, floral, etc.)'
                      },
                      style_notes: {
                        type: 'string',
                        description: 'Cut and unique features'
                      }
                    },
                    required: ['name', 'category', 'color', 'fabric', 'texture', 'pattern', 'style_notes']
                  }
                },
                needsReupload: {
                  type: 'boolean',
                  description: 'true if any items excluded due to quality issues'
                },
                reuploadReason: {
                  type: 'string',
                  description: 'explanation if needsReupload is true'
                }
              },
              required: ['items']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_clothing_items' } }
      })
    });

    if (!detectionResponse.ok) {
      const errorText = await detectionResponse.text();
      console.error('Detection error:', errorText);
      throw new Error('Failed to detect clothing items');
    }

    const detectionData = await detectionResponse.json();
    console.log('Detection response structure:', JSON.stringify(detectionData, null, 2));
    const detectionArgs = detectionData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!detectionArgs) {
      console.error('Invalid detection response:', detectionData);
      throw new Error('Invalid detection response from AI');
    }
    const detectionResult = JSON.parse(detectionArgs);

    console.log('Detected items:', detectionResult.items.length);

    if (detectionResult.needsReupload) {
      return new Response(JSON.stringify({
        error: 'Image quality issue',
        message: detectionResult.reuploadReason
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deduplicate items BEFORE generating composite image
    const deduplicatedItems = [];
    const seen = new Set();
    
    for (const item of detectionResult.items) {
      const key = `${item.category.toLowerCase()}_${item.name.toLowerCase().substring(0, 15)}_${item.color}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedItems.push(item);
      }
    }

    console.log(`After deduplication: ${deduplicatedItems.length} items`);

    if (deduplicatedItems.length === 0) {
      return new Response(JSON.stringify({
        error: 'No valid items found',
        message: 'All detected items were duplicates or invalid'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STEP 2: Generate Composite Image with Deduplicated Items
    console.log('Step 2: Generating composite image with deduplicated items...');
    
    const itemsList = deduplicatedItems.map((item: any, idx: number) => 
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
                text: `Create a composite image showing ALL detected clothing items arranged in a clean grid layout:

**ITEMS TO EXTRACT:**
${itemsList}

**LAYOUT REQUIREMENTS:**
- Arrange items in a grid (2-3 items per row depending on total count)
- Each item in its own cell with ~40px internal whitespace (not borders)
- Pure white background (#FFFFFF)
- Equal-sized cells for consistency

**ITEM PRESENTATION:**
- Each item: front-facing, straight orientation
- Fully unfolded and neatly arranged
- Centered in its cell
- Item fills ~70% of cell space
- Even, soft lighting with no shadows
- True-to-life colors
- Professional e-commerce quality

**GRID STRUCTURE:**
- Maintain order: top-left to bottom-right
- Consistent spacing between all items
- Do NOT draw borders, frames, grid lines, drop shadows, or outlines; separation must be whitespace only
- Clear visual separation between cells via whitespace`
              },
              {
                type: 'image_url',
                image_url: { url: actualImageUrl }
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

    console.log(`Successfully generated composite image with ${deduplicatedItems.length} items`);

    // Calculate grid layout based on deduplicated items
    const itemCount = deduplicatedItems.length;
    const columns = Math.min(3, Math.ceil(Math.sqrt(itemCount)));
    const rows = Math.ceil(itemCount / columns);

    return new Response(
      JSON.stringify({
        success: true,
        items: deduplicatedItems,
        compositeImageUrl,
        gridLayout: { rows, columns, itemCount },
        contentType: validationResult.contentType
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in process-wardrobe:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
