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
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an elite fashion stylist with deep expertise in haute couture, street style, and occasion-appropriate dressing. Analyze this outfit${occasion ? ` for ${occasion}` : ''} with precision and sophistication.

Provide:
1. A beautiful, memorable outfit name (2-4 words that capture the vibe, e.g., "Parisian Minimalist Chic", "Urban Power Player", "Sunset Soirée Elegance")

2. Detailed scoring (scale 1.0-5.0 with one decimal):
   - Color Harmony: palette coordination, contrast, seasonal appropriateness
   - Fit: tailoring, proportions, silhouette flattery
   - Texture/Fabric Mix: material cohesion, tactile appeal, quality perception
   - Style/Occasion Match: context appropriateness, trend awareness

3. Overall score (average of the four dimensions)

4. WHAT WORKS: Compliment 2-3 specific elements. Be technical about fabrics (cotton poplin, merino wool, silk charmeuse, etc.), cut, color theory, and styling choices. Brief but insightful.

5. WHAT COULD BE BETTER: Technical critique of 2-3 outfit elements. Discuss specific pieces, proportions, color mismatches, or fabric clashes. Be constructive and specific.

6. QUICK FIXES: 3-4 ACTIONABLE life-saver tips that dramatically elevate the look WITHOUT changing the outfit entirely. Include advice on: tucking/untucking, rolling sleeves/cuffs, belt additions, shoe swaps, jewelry/accessories, hairstyle adjustments, makeup tweaks, posture, or small styling hacks. Make it feel like a stylist's secret weapon.

Return ONLY valid JSON.`
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
                  what_works: { type: 'string', description: 'Technical compliments about fabrics, cut, colors' },
                  what_could_be_better: { type: 'string', description: 'Technical critique of specific elements' },
                  quick_fixes: { type: 'string', description: 'Actionable styling tips without changing outfit' }
                },
                required: ['outfit_name', 'color_score', 'fit_score', 'texture_score', 'occasion_score', 'overall_score', 'what_works', 'what_could_be_better', 'quick_fixes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'score_outfit' } }
      }),
    });

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
        try { scores = JSON.parse(content); } catch (_) {}
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});