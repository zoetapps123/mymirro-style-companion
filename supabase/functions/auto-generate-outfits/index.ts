import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AI_API_ENDPOINT, getAIApiKey } from '../_shared/ai-config.ts';
import { AUTO_OUTFIT_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    console.error('Auth failed:', authError);
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { items } = await req.json();
    const apiKey = getAIApiKey();

    console.log('Auto-generating outfits with:', { itemCount: items?.length });

    // Separate items by category
    const tops = items.filter((item: any) => item.category === 'Tops' || item.category === 'Shirts');
    const bottoms = items.filter((item: any) => item.category === 'Bottoms' || item.category === 'Pants' || item.category === 'Skirts');
    const shoes = items.filter((item: any) => item.category === 'Shoes');
    const accessories = items.filter((item: any) => item.category === 'Accessories');
    const layers = items.filter((item: any) => item.category === 'Layers' || item.category === 'Jackets');

    const prompt = AUTO_OUTFIT_PROMPTS.GENERATE_STYLE_AND_OCCASION({ tops, bottoms, shoes, accessories, layers });

    const response = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fashion stylist who creates cohesive, wearable outfit combinations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_outfit_collections',
              description: 'Create collections of outfit combinations',
              parameters: {
                type: 'object',
                properties: {
                  styleOutfits: {
                    type: 'array',
                    description: 'Array of 5 style-based outfits, each with a unique creative name',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique identifier' },
                        label: { 
                          type: 'string', 
                          description: 'Creative 2-3 word outfit name (e.g., "Urban Edge", "Minimalist Maven")'
                        },
                        itemIds: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Array of item IDs from different categories'
                        },
                        type: { type: 'string', enum: ['style'] }
                      },
                      required: ['id', 'label', 'itemIds', 'type']
                    }
                  },
                  occasionOutfits: {
                    type: 'array',
                    description: 'Array of 5 occasion-based outfits, each with a unique creative name',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique identifier' },
                        label: { 
                          type: 'string', 
                          description: 'Creative 2-3 word outfit name (e.g., "Date Night Charm", "Boardroom Boss")'
                        },
                        itemIds: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Array of item IDs from different categories'
                        },
                        type: { type: 'string', enum: ['occasion'] }
                      },
                      required: ['id', 'label', 'itemIds', 'type']
                    }
                  }
                },
                required: ['styleOutfits', 'occasionOutfits']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_outfit_collections' } }
      }),
    });

    const data = await response.json();
    console.log('Outfit generation response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const outfitData = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!outfitData) {
      throw new Error('Failed to generate outfits');
    }

    // Map item IDs to actual items
    const mapOutfits = (outfits: any[]) => outfits.map(outfit => ({
      ...outfit,
      items: outfit.itemIds.map((id: string) => items.find((item: any) => item.id === id)).filter(Boolean)
    }));

    const result = {
      styleOutfits: mapOutfits(outfitData.styleOutfits || []),
      occasionOutfits: mapOutfits(outfitData.occasionOutfits || [])
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auto-generate-outfits:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
