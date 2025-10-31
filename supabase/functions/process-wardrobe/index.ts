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
          modalities: ['image', 'text'],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image and detect ALL distinct clothing items visible. For each item, provide: 1) item name (e.g., "White Oxford Shirt"), 2) category (one of: Tops, Bottoms, Layers, Dresses, Shoes, Accessories), 3) primary color as a simple name (e.g., white, black, blue). Return an object {"items": [{"name":"...","category":"...","color":"..."} ...]}.'
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
      // Return empty list to avoid 500s; client will handle messaging
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For each detected item, use the original image as the processed image
    // Background removal and item extraction will be handled by a separate process
    const processedItems = clothingItems.map((item: any) => ({
      ...item,
      processedImageUrl: inputUrl
    }));

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