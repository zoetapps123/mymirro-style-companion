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
    const { occasion, weatherContext, dressCode, userItems } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating outfit for:', { occasion, weatherContext, dressCode, itemCount: userItems?.length });

    // Build outfit generation prompt
    const prompt = `You are a professional fashion stylist. Generate a complete outfit for the following:

Occasion: ${occasion || 'Casual Day Out'}
Weather: ${weatherContext || 'Comfortable'}
Dress Code: ${dressCode || 'Relaxed'}

${userItems?.length > 0 ? `Available wardrobe items:
${userItems.map((item: any) => `- ${item.name} (${item.category}, ${item.color})`).join('\n')}` : 'No wardrobe items available yet.'}

Create a complete outfit suggestion with the following categories:
1. Top wear
2. Bottom wear  
3. Layer (optional)
4. Shoes
5. Accessories (optional)

For each piece:
- If a user item matches well, specify which one to use
- If no suitable item exists in wardrobe, suggest an AI completion with specific description

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
