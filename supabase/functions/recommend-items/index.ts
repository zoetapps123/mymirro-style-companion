import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentOutfit, availableItems, occasion, styleTag } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating recommendations for outfit...');

    const prompt = `You are a professional fashion stylist. Given this outfit, recommend items from the wardrobe that would pair well.

**CURRENT OUTFIT:**
${currentOutfit.map((item: any) => `- ${item.name} (${item.category}, ${item.color}, ${item.fabric || 'N/A'})`).join('\n')}

**OCCASION:** ${occasion || 'Any'}
**STYLE:** ${styleTag || 'Any'}

**AVAILABLE WARDROBE ITEMS:**
${availableItems.map((item: any) => `- ID: ${item.id}, Name: ${item.name}, Category: ${item.category}, Color: ${item.color}, Fabric: ${item.fabric || 'N/A'}, Pattern: ${item.pattern || 'solid'}`).join('\n')}

**RECOMMENDATION PRIORITIES:**
1. **Missing categories** - If no shoes, recommend shoes; if no layer, recommend layers
2. **Color compatibility** - Choose complementary or analogous colors
3. **Style consistency** - Match the occasion and style tag
4. **Fabric compatibility** - Don't mix overly casual with formal

**RULES:**
- DO NOT recommend items already in the current outfit
- Recommend items that fill gaps in the outfit
- Prioritize items that enhance the overall look
- Consider the occasion and style when recommending

Return the IDs of recommended items in order of best to worst fit (max 20 items).`;

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
      })
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in a moment.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ 
        error: 'AI credits depleted. Please add credits to continue.' 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to generate recommendations');
    }

    const data = await response.json();
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
