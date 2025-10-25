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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!participants || participants.length < 2) {
      throw new Error('At least 2 participants required');
    }

    console.log(`Scoring battle with ${participants.length} participants...`);

    // Build the prompt with all images
    const content: any[] = [
      {
        type: 'text',
        text: `As a professional fashion judge, compare these ${participants.length} outfits and rank them. For each person, provide:
- A style score (1.0-5.0)
- A rank (1 being best)
- Brief reasoning (1-2 sentences)

Participants: ${participants.map((p: any) => p.name).join(', ')}

Return ONLY a JSON object with structure:
{
  "results": [
    {
      "name": "participant_name",
      "score": 4.5,
      "rank": 1,
      "reasoning": "Perfect color coordination and sharp fit create an unbeatable combo."
    }
  ],
  "winner_verdict": "Brief explanation of why the winner won and tips for others"
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
                        score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                        rank: { type: 'integer', minimum: 1 },
                        reasoning: { type: 'string' }
                      },
                      required: ['name', 'score', 'rank', 'reasoning']
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

    const data = await response.json();
    console.log('Battle scoring response:', data);

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const battleResults = toolCall ? JSON.parse(toolCall.function.arguments) : null;

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