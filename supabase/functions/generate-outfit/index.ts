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
    const { occasion, weatherContext, selectedItem, userItems } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating outfit for:', { occasion, weatherContext, selectedItem: selectedItem?.name, itemCount: userItems?.length });

    // Build outfit generation prompt anchored on selected item
    const prompt = `You are a professional fashion stylist. Generate a complete outfit for the following:

Occasion: ${occasion || 'Casual Day Out'}
Weather: ${weatherContext || 'Comfortable'}

SELECTED ANCHOR ITEM (MUST USE):
- ${selectedItem.name} (${selectedItem.category}, ${selectedItem.color})

${userItems?.length > 0 ? `Available wardrobe items to pair with:
${userItems.filter((item: any) => item.id !== selectedItem.id).map((item: any) => `- ${item.name} (${item.category}, ${item.color})`).join('\n')}` : 'No other wardrobe items available.'}

Create a complete outfit that INCLUDES the selected anchor item and pairs it with:
1. Top wear (if anchor is not top)
2. Bottom wear (if anchor is not bottom)
3. Layer (optional, if anchor is not layer)
4. Shoes (if anchor is not shoes)
5. Accessories (optional, if anchor is not accessories)

IMPORTANT RULES:
1. ALWAYS use the selected anchor item in its appropriate category
2. FIRST try to complete the outfit using available wardrobe items
3. ONLY suggest AI completions if no suitable wardrobe items exist for a category
4. Prioritize items that complement the anchor item's color and style
5. Ensure the complete outfit is appropriate for the occasion

For each piece:
- If using the anchor item, set useExisting=true and use its ID
- If a wardrobe item matches well, set useExisting=true with that item's ID
- If no suitable wardrobe item exists, set useExisting=false and provide a specific AI suggestion

Return your response as a structured outfit plan.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fashion stylist who creates balanced, occasion-appropriate outfits. Be specific and practical.'
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
              name: 'create_outfit',
              description: 'Create a complete outfit recommendation',
              parameters: {
                type: 'object',
                properties: {
                  outfit: {
                    type: 'object',
                    properties: {
                      top: {
                        type: 'object',
                        properties: {
                          useExisting: { type: 'boolean' },
                          itemId: { type: 'string' },
                          itemName: { type: 'string' },
                          aiSuggestion: { type: 'string' }
                        }
                      },
                      bottom: {
                        type: 'object',
                        properties: {
                          useExisting: { type: 'boolean' },
                          itemId: { type: 'string' },
                          itemName: { type: 'string' },
                          aiSuggestion: { type: 'string' }
                        }
                      },
                      layer: {
                        type: 'object',
                        properties: {
                          useExisting: { type: 'boolean' },
                          itemId: { type: 'string' },
                          itemName: { type: 'string' },
                          aiSuggestion: { type: 'string' }
                        }
                      },
                      shoes: {
                        type: 'object',
                        properties: {
                          useExisting: { type: 'boolean' },
                          itemId: { type: 'string' },
                          itemName: { type: 'string' },
                          aiSuggestion: { type: 'string' }
                        }
                      },
                      accessories: {
                        type: 'object',
                        properties: {
                          useExisting: { type: 'boolean' },
                          itemId: { type: 'string' },
                          itemName: { type: 'string' },
                          aiSuggestion: { type: 'string' }
                        }
                      }
                    },
                    required: ['top', 'bottom', 'shoes']
                  },
                  reasoning: { type: 'string' }
                },
                required: ['outfit', 'reasoning']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_outfit' } }
      }),
    });

    const data = await response.json();
    console.log('Outfit generation response received');

    // Surface rate limit and credits errors to the client
    if (response.status === 429 || data?.type === 'rate_limited') {
      return new Response(
        JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (response.status === 402 || data?.type === 'payment_required') {
      return new Response(
        JSON.stringify({ error: 'Payment required, please add credits to Lovable AI.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const outfitData = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!outfitData) {
      throw new Error('Failed to generate outfit');
    }

    return new Response(
      JSON.stringify(outfitData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-outfit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
