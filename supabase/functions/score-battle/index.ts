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
    const { participants } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!participants || participants.length < 2) {
      throw new Error('At least 2 participants required');
    }

    console.log(`Scoring battle with ${participants.length} participants...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a professional fashion judge with a competitive edge and witty personality. Score these ${participants.length} outfits in a battle format. For each participant:

1. Give them a competitive PERSONA NAME (2-3 words, fun and competitive, e.g., "Style Maverick", "Denim Destroyer", "Monochrome Master")
2. Overall score (1.0-5.0) - be honest and differentiate scores clearly
3. Rank (1 = best, 2 = second, etc.)
4. FUN BANTER/ROAST: Write a competitive, playful roast comparing them to other participants. Be cheeky, mention specific style elements, reference their outfit details and how they stack up. Make it entertaining but not mean-spirited. Like a friendly fashion roast battle.

Also provide:
- winner_verdict: A celebratory sentence about why the winner dominated the competition

Be detailed, competitive, entertaining, and reference specific outfit elements in your roasts. Return ONLY valid JSON.`
              },
              ...participants.map((p: any, idx: number) => [
                {
                  type: 'text',
                  text: `Participant ${idx + 1}: ${p.name}`
                },
                {
                  type: 'image_url',
                  image_url: { url: p.imageData }
                }
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
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error (score-battle):', response.status, errText);
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

    return new Response(
      JSON.stringify(battleResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in score-battle:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
