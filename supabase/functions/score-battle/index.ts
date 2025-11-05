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
    const { participants } = await req.json();

    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 participants required' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (participants.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Too many participants. Max 5 allowed.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    for (const p of participants) {
      if (!p?.name || typeof p.name !== 'string' || !p?.imageData || typeof p.imageData !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Each participant must include name and imageData' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (p.imageData.startsWith('data:image/') && p.imageData.length > 15_000_000) {
        return new Response(
          JSON.stringify({ error: `Image too large for ${p.name}. Please use a smaller image (<10MB).` }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Scoring battle with ${participants.length} participants...`);

    // Generate cache key based on participant images
    const cacheKey = await generateCacheKey({ participants: participants.map(p => ({ name: p.name, imageData: p.imageData })) });
    
    // Check cache first
    const cachedResult = await getCachedResult<any>(cacheKey);
    if (cachedResult) {
      console.log('Battle result found in cache');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Gemini API
    let data;
    try {
      data = await callGeminiAPI({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: SCORING_PROMPTS.SCORE_BATTLE(participants.length)
              },
              ...participants.map((p: any, idx: number) => [
                { type: 'text', text: `Participant ${idx + 1}: ${p.name}` },
                { type: 'image_url', image_url: { url: p.imageData } }
              ]).flat()
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'score_battle',
              description: 'Score and rank multiple outfits in a fashion battle with fun competitive banter',
              parameters: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Original participant name' },
                        persona_name: { type: 'string', description: 'Competitive persona name (2-3 words)' },
                        score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                        rank: { type: 'integer', minimum: 1 },
                        roast: { type: 'string', description: 'Fun competitive banter comparing to others' }
                      },
                      required: ['name', 'persona_name', 'score', 'rank', 'roast']
                    }
                  },
                  winner_verdict: { type: 'string' }
                },
                required: ['results', 'winner_verdict']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'score_battle' } }
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
    console.log('Battle scoring response:', data);

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let battleResults = null as any;
    if (toolCall?.function?.arguments) {
      try { battleResults = JSON.parse(toolCall.function.arguments); } catch (_) {}
    }
    if (!battleResults) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        try { battleResults = JSON.parse(content); } catch (_) {}
      }
    }

    if (!battleResults) {
      throw new Error('Failed to score battle');
    }

    // Sort by rank to ensure proper ordering
    battleResults.results.sort((a: any, b: any) => a.rank - b.rank);

    // Cache the result for 24 hours
    await setCachedResult(cacheKey, battleResults);

    return new Response(
      JSON.stringify(battleResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in score-battle:', error);
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
