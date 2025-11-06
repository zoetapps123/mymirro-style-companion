import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';
import { OUTFIT_GENERATION_PROMPTS } from '../_shared/prompts.ts';
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
    const { 
      generationType, 
      occasion, 
      style, 
      anchorItem, 
      wardrobeItems, 
      maxOutfits,
      userLocation
    } = await req.json();

    const apiKey = getAIApiKey();

    console.log('Generating outfits:', { generationType, occasion, style, anchorItem: anchorItem?.name });

    // Check cache first
    const itemIds = wardrobeItems?.map((i: any) => i.id).sort() || [];
    const cacheKey = await generateCacheKey({ 
      type: 'outfit_generation', 
      generationType, 
      occasion, 
      style, 
      anchorItemId: anchorItem?.id,
      itemIds 
    });
    
    const cachedOutfits = await getCachedResult(cacheKey);
    if (cachedOutfits) {
      console.log('Returning cached outfit combinations');
      return new Response(
        JSON.stringify({ success: true, outfits: cachedOutfits }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Generate outfit combinations
    const prompt = buildOutfitGenerationPrompt(generationType, occasion, style, anchorItem, wardrobeItems, maxOutfits, userLocation);

    console.log('Calling Gemini API for outfit generation...');
    
    const data = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fashion stylist creating fashionable outfit combinations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_outfit_combinations',
          description: 'Generate multiple distinct outfit combinations',
          parameters: {
            type: 'object',
            properties: {
              outfits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pieces: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          wardrobeItemId: { type: 'string' },
                          category: { type: 'string' },
                          role: { type: 'string' }
                        },
                        required: ['wardrobeItemId', 'category', 'role']
                      }
                    },
                    reasoning: { type: 'string' },
                    styleTag: { type: 'string' }
                  },
                  required: ['pieces', 'reasoning', 'styleTag']
                }
              },
              totalGenerated: { type: 'number' }
            },
            required: ['outfits', 'totalGenerated']
          }
        }
      }]
    });

    console.log('Gemini API response structure:', {
      hasChoices: !!data?.choices,
      choicesLength: data?.choices?.length,
      hasMessage: !!data?.choices?.[0]?.message,
      messageKeys: data?.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      hasToolCalls: !!data?.choices?.[0]?.message?.tool_calls,
      hasContent: !!data?.choices?.[0]?.message?.content
    });

    // Handle both tool calls and direct text responses
    let result;
    if (data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      console.log('Using tool call response');
      result = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    } else if (data?.choices?.[0]?.message?.content) {
      console.log('Parsing content as JSON fallback');
      // Try to extract JSON from content
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error('No valid JSON found in response:', content);
        throw new Error('AI did not return outfit data in expected format');
      }
    } else {
      console.error('Invalid API response structure:', JSON.stringify(data, null, 2));
      throw new Error('AI returned invalid response format');
    }

    console.log(`Generated ${result.totalGenerated} outfits`);

    // Step 2: Map outfit items (no image generation)
    const outfitsWithItems = result.outfits.map((outfit: any) => {
      const outfitItems = outfit.pieces.map((piece: any) => 
        wardrobeItems.find((item: any) => item.id === piece.wardrobeItemId)
      ).filter(Boolean);

      return {
        name: `${occasion || style || 'Styled'} Look`,
        styleTag: outfit.styleTag,
        reasoning: outfit.reasoning,
        items: outfitItems,
        occasion: occasion,
        style_tag: outfit.styleTag
      };
    });

    // Cache the result
    await setCachedResult(cacheKey, outfitsWithItems);

    return new Response(
      JSON.stringify({
        success: true,
        outfits: outfitsWithItems
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-outfit:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildOutfitGenerationPrompt(
  generationType: string,
  occasion?: string,
  style?: string,
  anchorItem?: any,
  wardrobeItems?: any[],
  maxOutfits?: number,
  userLocation?: { temp: number; weather: string; lat: number } | null
): string {
  return OUTFIT_GENERATION_PROMPTS.BUILD_PROMPT({
    generationType,
    occasion,
    style,
    anchorItem,
    wardrobeItems: wardrobeItems || [],
    maxOutfits,
    userLocation: userLocation ? { temp: userLocation.temp, weather: userLocation.weather } : undefined
  });
}
