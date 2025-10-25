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
    const { imageData, occasion } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Scoring outfit...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `As a professional fashion stylist, analyze this outfit${occasion ? ` for ${occasion}` : ''} and provide:

1. A creative, context-aware outfit name (2-4 words, e.g., "Neo-Classic Finisher", "Sunset Boardwalk Vibes")
2. Scores across these dimensions (scale 1.0-5.0):
   - Color Harmony (how well the colors work together)
   - Fit (how well the clothes fit the body)
   - Texture/Fabric Mix (cohesiveness of materials)
   - Style/Occasion Match (appropriateness for the context)
3. Overall average score
4. What's working well (2-3 specific positive points about fabric/texture interplay, palette harmony)
5. Quick fixes/improvements (2-3 actionable suggestions: tuck, cuff, swap shoes, add layer, accessory, hair/makeup tip)

Be precise, constructive, and technically detailed. Return ONLY valid JSON.`
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'score_outfit',
              description: 'Score an outfit across multiple fashion dimensions',
              parameters: {
                type: 'object',
                properties: {
                  outfit_name: { type: 'string', description: 'Creative 2-4 word outfit name' },
                  color_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  fit_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  texture_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  occasion_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  overall_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  verdict_positive: { type: 'string' },
                  verdict_improvements: { type: 'string' }
                },
                required: ['outfit_name', 'color_score', 'fit_score', 'texture_score', 'occasion_score', 'overall_score', 'verdict_positive', 'verdict_improvements']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'score_outfit' } }
      }),
    });

    const data = await response.json();
    console.log('Scoring response:', data);

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const scores = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!scores) {
      throw new Error('Failed to score outfit');
    }

    return new Response(
      JSON.stringify(scores),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in score-outfit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});