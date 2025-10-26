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

    // Validate input
    if (!imageData || typeof imageData !== 'string') {
      return new Response(
        JSON.stringify({ error: 'imageData is required and must be a base64 data URL or http(s) URL' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const isDataUrl = imageData.startsWith('data:image/');
    const isHttpUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
    if (!isDataUrl && !isHttpUrl) {
      return new Response(
        JSON.stringify({ error: 'Invalid imageData format. Provide data:image/* base64 or a public URL.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (isDataUrl && imageData.length > 15_000_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Please upload a smaller image (<10MB).' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scoring outfit...');

    // Timeout + abort for robustness
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  text: `As a professional fashion stylist with deep expertise in fabrics, cuts, and styling, analyze this outfit${occasion ? ` for ${occasion}` : ''} and provide:

1. A creative, context-aware outfit name (2-4 words, e.g., "Neo-Classic Finisher", "Sunset Boardwalk Vibes")
2. Scores across these dimensions (scale 1.0-5.0):
   - Color Harmony (how well the colors work together)
   - Fit (how well the clothes fit the body)
   - Texture/Fabric Mix (cohesiveness of materials)
   - Style/Occasion Match (appropriateness for the context)
3. Overall average score
4. WHAT WORKS: Compliment the good parts - be technical about fabrics, textures, color theory, and silhouette. Keep it brief but sophisticated.
5. WHAT COULD BE BETTER: Technical feedback on how different parts of the outfit could improve - cut, proportion, styling choices.
6. QUICK FIXES: Life-saving accessible changes that dramatically elevate the look WITHOUT changing the outfit much - could include hair styling, accessories, makeup, shoes, tucking, cuffing, layering, etc.

Be precise, constructive, and technically detailed like a professional stylist. Return ONLY valid JSON.`
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
                    what_works: { type: 'string', description: 'Technical compliments about fabrics, textures, colors' },
                    what_could_be_better: { type: 'string', description: 'Technical feedback on improvements' },
                    quick_fixes: { type: 'string', description: 'Accessible quick changes to elevate the look' }
                  },
                  required: ['outfit_name', 'color_score', 'fit_score', 'texture_score', 'occasion_score', 'overall_score', 'what_works', 'what_could_be_better', 'quick_fixes']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'score_outfit' } }
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error (score-outfit):', response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI error', details: errText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Scoring response:', data);

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let scores = null as any;
    if (toolCall?.function?.arguments) {
      try { scores = JSON.parse(toolCall.function.arguments); } catch (_) {}
    }
    if (!scores) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        const cleaned = content.trim().replace(/^```json\n?|```$/g, '');
        try { scores = JSON.parse(cleaned); } catch (_) {}
      }
    }

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
    const isAbort = (error as any)?.name === 'AbortError' || (error as any)?.message?.includes('aborted');
    const status = isAbort ? 504 : 500;
    const msg = isAbort ? 'AI service timeout. Please try again.' : (error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});