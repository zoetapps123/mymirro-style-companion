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
                  text: `As a professional fashion stylist, analyze this outfit${occasion ? ` for ${occasion}` : ''} and provide:

1. A creative outfit name (2-4 words)
2. Scores across these dimensions (scale 1.0-5.0): Color Harmony, Fit, Texture/Fabric Mix, Style/Occasion Match
3. Overall average score
4. What Works: 2-3 short, factual observations (max 12-15 words each) on what's strong about the outfit.
5. What Doesn't Work: 2-3 short, factual critiques (max 12-15 words each). Be direct, no soft language.
6. Quick Fixes (Under 1 Minute): 4-6 actionable styling tips (max 12-15 words each) that can be done in under 60 seconds. Focus on:
   - Immediate adjustments (tuck shirt, roll sleeves, unbutton collar, adjust hem)
   - Quick additions (add watch, swap shoes, add belt, layer jacket)
   - Styling tweaks (fix hair, adjust accessories, straighten posture)
   Use strong action verbs and be very specific.

Keep language direct, professional, and under 15 words per point.`
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
                    what_works: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '2-3 short observations (max 15 words each)',
                      minItems: 2,
                      maxItems: 3
                    },
                    what_didnt_work: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '2-3 short critiques (max 15 words each)',
                      minItems: 2,
                      maxItems: 3
                    },
                    quick_fix: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '4-6 quick under-60-second actions with specific verbs (max 15 words each)',
                      minItems: 4,
                      maxItems: 6
                    }
                  },
                  required: ['outfit_name', 'color_score', 'fit_score', 'texture_score', 'occasion_score', 'overall_score', 'what_works', 'what_didnt_work', 'quick_fix']
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