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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Scoring outfit...');

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
            role: 'user',
            content: [
              {
                type: 'text',
                text: `As a professional fashion stylist, analyze this outfit${occasion ? ` for ${occasion}` : ''} and score it across these dimensions (scale 1.0-5.0):

1. Color Harmony (how well the colors work together)
2. Fit (how well the clothes fit the body)
3. Texture/Fabric Mix (cohesiveness of materials)
4. Style/Occasion Match (appropriateness for the context)

Provide:
- Individual scores (decimal, e.g., 4.2)
- Overall average score
- What's working well (2-3 specific positive points)
- Quick fixes/improvements (2-3 actionable suggestions)

Return ONLY a JSON object with structure:
{
  "color_score": 4.5,
  "fit_score": 4.0,
  "texture_score": 4.3,
  "occasion_score": 4.2,
  "overall_score": 4.25,
  "verdict_positive": "Great color harmony—navy & white is classic. Fit looks sharp on shoulders.",
  "verdict_improvements": "• Roll sleeves for a relaxed vibe\n• Add a leather belt for structure\n• Swap sneakers for loafers"
}`
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
                  color_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  fit_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  texture_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  occasion_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  overall_score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                  verdict_positive: { type: 'string' },
                  verdict_improvements: { type: 'string' }
                },
                required: ['color_score', 'fit_score', 'texture_score', 'occasion_score', 'overall_score', 'verdict_positive', 'verdict_improvements']
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