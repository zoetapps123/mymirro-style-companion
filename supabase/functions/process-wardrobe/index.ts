import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Processing wardrobe item...');

    const inputUrl = imageUrl || (typeof imageData === 'string' 
      ? (imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`)
      : '');
    if (!inputUrl) {
      return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 0: Validate human presence
    const validationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
                text: 'Analyze the image and return true only if it contains at least one real, non-AI human. Reject images that include only animals, objects, cartoons, or AI-generated humans.'
              },
              {
                type: 'image_url',
                image_url: { url: inputUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'validate_human_presence',
              description: 'Checks if the image includes real-life human(s) only',
              parameters: {
                type: 'object',
                properties: {
                  isRealHumanPresent: { type: 'boolean', description: 'true if image contains a real human, otherwise false' }
                },
                required: ['isRealHumanPresent']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'validate_human_presence' } }
      }),
    });

    const validationData = await validationResponse.json();
    
    if (validationResponse.status === 429 || validationData?.type === 'rate_limited') {
      return new Response(
        JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (validationResponse.status === 402 || validationData?.type === 'payment_required') {
      return new Response(
        JSON.stringify({ error: 'Payment required, please add credits to Lovable AI.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationCall = validationData.choices?.[0]?.message?.tool_calls?.[0];
    let isHumanPresent = false;
    try {
      if (validationCall?.function?.arguments) {
        const result = JSON.parse(validationCall.function.arguments);
        isHumanPresent = result?.isRealHumanPresent || false;
      }
    } catch (e) {
      console.warn('Validation parse failed', e);
    }

    if (!isHumanPresent) {
      return new Response(
        JSON.stringify({ error: 'Please upload an image with a real human wearing clothing.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Detect all clothing items in the image
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
                text: `Analyze this image and detect ALL distinct clothing items visible on the human subject. Only include items that meet ALL of the following:
- Clearly visible
- The clothing category (e.g., Tops, Bottoms, Dresses, Accessories) and the design (e.g., pattern, cut, style) can both be confidently identified

Ignore items that are:
- Too small (e.g., rings, tiny earrings)
- Visually unclear (e.g., blurry, poorly lit, or obstructed)
- Partially visible (e.g., only a bag strap is shown without the full bag)

For each valid item, return:
1) Item name (e.g., "White Oxford Shirt")
2) Category (choose from: Tops, Bottoms, Layers, Dresses, Shoes, Accessories)
3) Primary color (as hex code)

Set needsReupload=true if any item is excluded due to visibility, clarity, incompleteness, or missing category/design.`
              },
              {
                type: 'image_url',
                image_url: { url: inputUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_clothing_items',
              description: 'Extract only full, clearly visible clothing items where category and design are identifiable. Ignore small, unclear, or incomplete items. Request reupload if needed.',
              parameters: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Name of clothing item' },
                        category: { 
                          type: 'string', 
                          enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories'],
                          description: 'Category of clothing' 
                        },
                        color: { type: 'string', description: 'Primary color as hex code' }
                      },
                      required: ['name', 'category', 'color']
                    }
                  },
                  needsReupload: { type: 'boolean', description: 'true if any item is excluded due to visibility, clarity, incompleteness, or missing category/design' }
                },
                required: ['items', 'needsReupload']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_clothing_items' } }
      }),
    });

    const analysisData = await analysisResponse.json();
    console.log('Analysis response:', analysisData);

    // Surface rate limit and credits errors to the client
    if (analysisResponse.status === 429 || analysisData?.type === 'rate_limited') {
      return new Response(
        JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (analysisResponse.status === 402 || analysisData?.type === 'payment_required') {
      return new Response(
        JSON.stringify({ error: 'Payment required, please add credits to Lovable AI.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
    let clothingItems: any[] = [];
    let needsReupload = false;
    try {
      if (toolCall?.function?.arguments) {
        const detectionResult = JSON.parse(toolCall.function.arguments);
        clothingItems = detectionResult?.items || [];
        needsReupload = detectionResult?.needsReupload || false;
      } else {
        const content = analysisData.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          const parsed = JSON.parse(content);
          clothingItems = parsed?.items || [];
          needsReupload = parsed?.needsReupload || false;
        }
      }
    } catch (e) {
      console.warn('Fallback parse failed', e);
    }

    if (needsReupload) {
      return new Response(
        JSON.stringify({ error: 'Some items were not clear. Please upload a clearer image with better lighting and visibility.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clothingItems || clothingItems.length === 0) {
      // Fallback attempt with a simpler prompt and no tool calling
      const fallbackResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract ONLY clearly visible clothing items from this image. Skip blurry or partially visible items. For each item: provide specific name, exact category (Tops, Bottoms, Layers, Dresses, Shoes, Accessories), and accurate primary color name. Return JSON: {"items":[{"name":"","category":"","color":""}...]}.' },
                { type: 'image_url', image_url: { url: inputUrl } }
              ]
            }
          ]
        }),
      });
      const fbData = await fallbackResp.json();
      // Surface rate limit and credits errors to the client for fallback as well
      if (fallbackResp.status === 429 || fbData?.type === 'rate_limited') {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (fallbackResp.status === 402 || fbData?.type === 'payment_required') {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add credits to Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      try {
        const text = fbData.choices?.[0]?.message?.content;
        if (typeof text === 'string') {
          const parsed = JSON.parse(text);
          clothingItems = parsed?.items || [];
        }
      } catch {}
    }

    if (!clothingItems || clothingItems.length === 0) {
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Generate clean cutouts per item with proper presentation
    const processedItems = await Promise.all(
      clothingItems.map(async (item: any) => {
        try {
          const genResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
                      text: `Extract the ${item.name} from this image and display it in a straight, front-facing position with the garment fully unfolded and clearly visible. Place the item on a clean white background.

Ensure the following:
- No human, background, or other items are present
- The item is neatly aligned, not folded, crumpled, or worn
- Lighting is even and shadows are minimal
- The clothing is centered and fully in frame
- Presentation matches a product catalog photo suitable for e-commerce or wardrobe management`
                    },
                    {
                      type: 'image_url',
                      image_url: { url: inputUrl }
                    }
                  ]
                }
              ],
              modalities: ['image', 'text']
            }),
          });
          const genData = await genResp.json();
          const cutoutUrl = genData.choices?.[0]?.message?.images?.[0]?.image_url?.url || inputUrl;
          return { ...item, processedImageUrl: cutoutUrl, sourceUrl: inputUrl };
        } catch {
          return { ...item, processedImageUrl: inputUrl, sourceUrl: inputUrl };
        }
      })
    );

    console.log(`Processed ${processedItems.length} items`);

    return new Response(
      JSON.stringify({
        items: processedItems
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-wardrobe:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});