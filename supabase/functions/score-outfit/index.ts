import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { SCORING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';

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
    const { imageData, occasion, style, vibe } = await req.json();

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

    // Check cache first
    const cacheKey = await generateCacheKey({ type: 'outfit_score', imageData, occasion, style, vibe });
    const cachedScore = await getCachedResult(cacheKey);
    if (cachedScore) {
      console.log('Returning cached outfit score');
      return new Response(
        JSON.stringify(cachedScore),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = await callGeminiAPI({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: SCORING_PROMPTS.SCORE_OUTFIT(occasion, style, vibe)
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
      });
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (error.message === 'PAYMENT_REQUIRED') {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
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

    // Cache the result
    await setCachedResult(cacheKey, scores);

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