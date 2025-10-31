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

    // First, detect all clothing items in the image
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
                  text: 'Analyze this image and detect ONLY clearly visible and identifiable clothing items. SKIP any items that are blurry, partially visible, occluded, or unclear. For each clearly visible item, provide: 1) Specific item name (e.g., "White Cotton T-Shirt", "Dark Blue Denim Jeans"), 2) Category - must be EXACTLY one of: Tops, Bottoms, Layers, Dresses, Shoes, Accessories, 3) Primary dominant color as a simple, accurate color name (e.g., white, black, navy blue, light gray, beige). Be precise with colors - distinguish between similar shades (e.g., navy vs royal blue, cream vs white). Return JSON: {"items": [{"name":"...","category":"...","color":"..."} ...]}.'
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
                description: 'Extract all clothing items from the image',
                parameters: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', description: 'Name of the clothing item' },
                          category: { 
                            type: 'string', 
                            enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories'],
                            description: 'Category of clothing' 
                          },
                          color: { type: 'string', description: 'Primary color (simple name)' }
                        },
                        required: ['name', 'category', 'color']
                      }
                    }
                  },
                  required: ['items']
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
    try {
      if (toolCall?.function?.arguments) {
        const detectionResult = JSON.parse(toolCall.function.arguments);
        clothingItems = detectionResult?.items || [];
      } else {
        const content = analysisData.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          const parsed = JSON.parse(content);
          clothingItems = parsed?.items || [];
        }
      }
    } catch (e) {
      console.warn('Fallback parse failed', e);
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

    // Generate clean cutouts per item with fallback to source image
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
                  content: `Cut out this single item: ${item.name}. Remove background and other objects. Center on white background, high quality PNG.`
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