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

    // Build the prompt with all images
    const content: any[] = [
      {
        type: 'text',
        text: `You are a sassy, witty fashion judge hosting an epic outfit battle! Compare these ${participants.length} outfits and rank them with ATTITUDE and FLAIR.

For each person, provide:
- A competitive, fun PERSONA NAME (2-4 words, e.g., "The Minimalist Maven", "Street Style Warrior", "Vintage Vixen", "Corporate Crusher")
- Style score (1.0-5.0)
- Rank (1 = winner)
- FUN BANTER: Roast OR compliment with personality! Be playful, competitive, and entertaining. Make comparisons between participants. Example: "While [Name] brought the heat with that layering game, [Other Name]'s color choices were giving 'played it too safe' energy."

Participants: ${participants.map((p: any) => p.name).join(', ')}

Return ONLY a JSON object:
{
  "results": [
    {
      "name": "participant_name",
      "persona": "Their Persona Name",
      "score": 4.5,
      "rank": 1,
      "reasoning": "Fun, competitive banter with roasts/compliments comparing to others"
    }
  ],
  "winner_verdict": "Explain why the winner dominated and what others could learn. Keep it spicy and fun!"
}`
      }
    ];

    // Add all participant images
    for (const participant of participants) {
      content.push({
        type: 'text',
        text: `Outfit for ${participant.name}:`
      });
      content.push({
        type: 'image_url',
        image_url: { url: participant.imageData }
      });
    }

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
            content
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'score_battle',
              description: 'Score and rank multiple outfits in a fashion battle',
              parameters: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        persona: { type: 'string', description: 'Competitive fun persona name' },
                        score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                        rank: { type: 'integer', minimum: 1 },
                        reasoning: { type: 'string', description: 'Fun banter with roasts/compliments' }
                      },
                      required: ['name', 'persona', 'score', 'rank', 'reasoning']
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