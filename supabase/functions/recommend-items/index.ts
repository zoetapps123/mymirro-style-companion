import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { STYLING_PROMPTS } from '../_shared/prompts.ts';
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
    const { currentOutfit, availableItems, occasion, styleTag } = await req.json();

    console.log('Generating recommendations for outfit...');

    const prompt = STYLING_PROMPTS.RECOMMEND_ITEMS(currentOutfit, availableItems, occasion, styleTag);

    let data;
    try {
      data = await callGeminiAPI({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fashion stylist providing wardrobe recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'recommend_items',
            description: 'Return recommended wardrobe item IDs in priority order',
            parameters: {
              type: 'object',
              properties: {
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      itemId: {
                        type: 'string',
                        description: 'The ID of the recommended item'
                      },
                      reasoning: {
                        type: 'string',
                        description: 'Why this item is recommended'
                      },
                      priority: {
                        type: 'number',
                        description: 'Priority score (1-10, higher is better)'
                      }
                    },
                    required: ['itemId', 'reasoning', 'priority']
                  }
                }
              },
              required: ['recommendations']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'recommend_items' } }
      });
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (error.message === 'PAYMENT_REQUIRED') {
        return new Response(JSON.stringify({ 
          error: 'AI credits depleted. Please add credits to continue.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.error('AI API error:', error);
      throw new Error('Failed to generate recommendations');
    }
    const result = JSON.parse(
      data.choices[0].message.tool_calls[0].function.arguments
    );

    // Map IDs back to full items and sort by priority
    const fullRecommendations = result.recommendations
      .map((rec: any) => {
        const item = availableItems.find((i: any) => i.id === rec.itemId);
        return item ? { ...item, reasoning: rec.reasoning, priority: rec.priority } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.priority - a.priority);

    console.log(`Generated ${fullRecommendations.length} recommendations`);

    return new Response(
      JSON.stringify({ recommendations: fullRecommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recommend-items:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
