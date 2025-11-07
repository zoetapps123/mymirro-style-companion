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
      userLocation,
      bypassCache
    } = await req.json();

    const apiKey = getAIApiKey();

    console.log('Generating outfits:', { generationType, occasion, style, anchorItem: anchorItem?.name, bypassCache });

    // Check cache first (unless bypassed)
    const itemIds = wardrobeItems?.map((i: any) => i.id).sort() || [];
    const cacheKey = await generateCacheKey({ 
      type: 'outfit_generation', 
      generationType, 
      occasion, 
      style, 
      anchorItemId: anchorItem?.id,
      itemIds 
    });
    
    if (!bypassCache) {
      const cachedOutfits = await getCachedResult(cacheKey);
      if (cachedOutfits) {
        console.log('✅ Cache hit - returning cached outfit combinations');
        return new Response(
          JSON.stringify({ success: true, outfits: cachedOutfits }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('❌ Cache miss - proceeding with AI generation');
    } else {
      console.log('🔄 Cache bypassed - forcing fresh generation');
    }

    // Step 1: Generate outfit combinations
    const prompt = buildOutfitGenerationPrompt(generationType, occasion, style, anchorItem, wardrobeItems, maxOutfits, userLocation);

    console.log('Calling Gemini API for outfit generation...');
    
    const data = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fashion stylist. YOU MUST ONLY respond using the generate_outfit_combinations function tool. DO NOT write plain text responses. FUNCTION CALLING IS MANDATORY. Your response will be rejected if you do not use the provided function tool.'
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
      }],
      tool_choice: { type: 'function', function: { name: 'generate_outfit_combinations' } }
    });

    console.log('Gemini API response structure:', {
      hasChoices: !!data?.choices,
      choicesLength: data?.choices?.length,
      hasMessage: !!data?.choices?.[0]?.message,
      messageKeys: data?.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      hasToolCalls: !!data?.choices?.[0]?.message?.tool_calls,
      hasContent: !!data?.choices?.[0]?.message?.content,
      fullMessage: data?.choices?.[0]?.message ? JSON.stringify(data.choices[0].message).substring(0, 500) : 'No message'
    });

    // Handle both tool calls and direct text responses
    let result;
    if (data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      console.log('✅ SUCCESS: Using tool call response (expected behavior)');
      result = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    } else if (data?.choices?.[0]?.message?.content) {
      console.log('⚠️ WARNING: AI did not use function tool - attempting fallback JSON parsing');
      console.log('Raw content preview:', data.choices[0].message.content.substring(0, 1000));
      const content = data.choices[0].message.content as string;

      // Check if the AI is refusing to generate outfits
      const refusalKeywords = [
        'cannot fulfill',
        'cannot generate',
        'does not include',
        'lacks',
        'insufficient items',
        'not enough',
        'unable to create',
        'missing essential'
      ];
      
      const isRefusal = refusalKeywords.some(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isRefusal) {
        console.log('🚫 AI REFUSED: Insufficient wardrobe items for complete outfits');
        console.log('Refusal reason:', content.substring(0, 300));
        // DO NOT cache refusals - user might add items and retry
        return new Response(
          JSON.stringify({ 
            success: true, 
            outfits: [],
            message: 'Your wardrobe needs more items to create complete outfits. Try adding bottoms, shoes, or tops!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const extractJsonObject = (text: string): any | null => {
        // Prefer fenced code block ```json ... ```
        try {
          const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (block?.[1]) {
            console.log('Found JSON in code block');
            return JSON.parse(block[1].trim());
          }
        } catch (e) {
          console.error('Failed to parse JSON from code block:', e);
        }

        // Balanced brace scan for first complete JSON object
        const start = text.indexOf('{');
        if (start === -1) {
          console.error('No opening brace found in response');
          return null;
        }
        let depth = 0;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = text.slice(start, i + 1);
              try { 
                console.log('Found balanced JSON object');
                return JSON.parse(candidate); 
              } catch (e) { 
                console.error('Failed to parse balanced JSON:', e);
              }
            }
          }
        }
        console.error('No complete JSON object found');
        return null;
      };

      const parsed = extractJsonObject(content);
      if (parsed) {
        console.log('✅ Fallback JSON parsing successful');
        result = parsed;
      } else {
        console.error('❌ CRITICAL: No valid JSON found in response');
        console.error('Full content:', content);
        console.error('This indicates the AI is not following function calling instructions');
        // Graceful fallback: treat as zero outfits to avoid 500s in UI
        result = { outfits: [], totalGenerated: 0 };
      }
    } else {
      console.error('❌ CRITICAL: Invalid API response structure - no tool_calls or content');
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error('AI returned invalid response format - neither function call nor text content');
    }

    console.log(`Generated ${result.totalGenerated ?? (result.outfits?.length ?? 0)} outfits`);

    if (!result?.outfits || !Array.isArray(result.outfits) || result.outfits.length === 0) {
      console.warn('⚠️ AI returned no outfits - NOT caching this result');
      console.warn('Reason: Empty results should not be cached to allow retries');
      // DO NOT cache empty results - return immediately without caching
      return new Response(
        JSON.stringify({ 
          success: true, 
          outfits: [],
          message: 'Could not generate outfits with current wardrobe items. Try adding more variety!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
