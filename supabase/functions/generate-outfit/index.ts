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
      if (cachedOutfits && Array.isArray(cachedOutfits) && cachedOutfits.length > 0) {
        console.log('✅ Cache hit with valid outfits - returning cached combinations');
        return new Response(
          JSON.stringify({ success: true, outfits: cachedOutfits }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (cachedOutfits) {
        console.log('⚠️ Cache hit but empty results - ignoring cache and regenerating');
      } else {
        console.log('❌ Cache miss - proceeding with AI generation');
      }
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
                    outfitId: { type: 'string' },
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
                    styleTag: { type: 'string' },
                    confidence: { type: 'number' },
                    estimated_formality: { type: 'string' },
                    warnings: { 
                      type: 'array',
                      items: { type: 'string' }
                    }
                  },
                  required: ['pieces', 'reasoning', 'styleTag']
                }
              },
              totalGenerated: { type: 'number' },
              missingCategories: {
                type: 'array',
                items: { type: 'string' }
              },
              requiresExternal: { type: 'boolean' },
              suggestedExternal: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    reason: { type: 'string' },
                    priority: { type: 'string' }
                  }
                }
              },
              notes: { type: 'string' }
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

    // Log additional metadata from new prompt
    if (result.missingCategories && result.missingCategories.length > 0) {
      console.log('Missing categories:', result.missingCategories);
    }
    if (result.requiresExternal) {
      console.log('Requires external items:', result.suggestedExternal);
    }
    if (result.notes) {
      console.log('Notes:', result.notes);
    }

    if (!result?.outfits || !Array.isArray(result.outfits) || result.outfits.length === 0) {
      console.warn('⚠️ AI returned no outfits - attempting deterministic fallback');

      // Deterministic fallback: build complete looks from user's wardrobe
      const norm = (s: any) => (s || '').toString().toLowerCase();
      const isTop = (c: string) => ['shirt','top','tee','t-shirt','blouse','polo','kurta'].some(k => c.includes(k));
      const isBottom = (c: string) => ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom'].some(k => c.includes(k));
      const isShoe = (c: string) => ['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper'].some(k => c.includes(k));
      const isLayer = (c: string) => ['jacket','blazer','coat','cardigan','sweater','hoodie','outerwear','layer'].some(k => c.includes(k));
      const isAccessory = (c: string) => [
        'accessor','accessory','accessories',
        'watch','belt','bag','handbag','purse','wallet',
        'sunglass','sunglasses','glass','glasses',
        'hat','cap','scarf',
        'jewelry','jewellery',
        'ring','bracelet','necklace',
        'earring','earrings','bangle','anklet'
      ].some(k => c.includes(k));

      const tops = (wardrobeItems || []).filter((i: any) => isTop(norm(i.category)));
      const bottoms = (wardrobeItems || []).filter((i: any) => isBottom(norm(i.category)));
      const shoes = (wardrobeItems || []).filter((i: any) => isShoe(norm(i.category)));
      const layers = (wardrobeItems || []).filter((i: any) => isLayer(norm(i.category)));
      const accessories = (wardrobeItems || []).filter((i: any) => isAccessory(norm(i.category)));

      if (tops.length && bottoms.length && shoes.length) {
        const want = Math.min(maxOutfits || 3, 3);
        const combos: any[] = [];
        for (let i = 0; i < want; i++) {
          const top = tops[i % tops.length];
          const bottom = bottoms[(i + 1) % bottoms.length];
          const shoe = shoes[(i + 2) % shoes.length];
          const layer = (userLocation && userLocation.temp !== undefined && userLocation.temp < 20 && layers.length)
            ? layers[i % layers.length]
            : undefined;
          const accessory = accessories.length ? accessories[i % accessories.length] : undefined;

          const pieces: any[] = [
            { wardrobeItemId: top.id, category: top.category, role: 'upperwear' },
            { wardrobeItemId: bottom.id, category: bottom.category, role: 'lowerwear' },
            { wardrobeItemId: shoe.id, category: shoe.category, role: 'footwear' },
          ];
          if (layer) pieces.push({ wardrobeItemId: layer.id, category: layer.category, role: 'layer' });
          if (accessory) pieces.push({ wardrobeItemId: accessory.id, category: accessory.category, role: 'accessory' });

          combos.push({
            pieces,
            reasoning: `Complete ${occasion || style || 'styled'} look using your wardrobe: balanced top, bottom, and footwear${layer ? ', plus a weather-appropriate layer' : ''}.`,
            styleTag: style || 'versatile'
          });
        }

        result = { outfits: combos, totalGenerated: combos.length };
        console.log(`Fallback generated ${combos.length} complete looks`);
      } else {
        console.warn('Fallback failed: missing essential categories (top/bottom/shoes). Returning empty.');
        return new Response(
          JSON.stringify({ 
            success: true, 
            outfits: [],
            message: 'Your wardrobe needs at least a top, a bottom, and footwear to create complete outfits. Try adding the missing categories!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 2: Map outfit items and preserve new metadata
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
        style_tag: outfit.styleTag,
        // New fields from prompt 2
        ...(outfit.outfitId && { outfitId: outfit.outfitId }),
        ...(outfit.confidence !== undefined && { confidence: outfit.confidence }),
        ...(outfit.estimated_formality && { estimated_formality: outfit.estimated_formality }),
        ...(outfit.warnings && { warnings: outfit.warnings })
      };
    });

    // Build response with new metadata
    const response: any = {
      success: true,
      outfits: outfitsWithItems
    };

    // Add new prompt 2 fields if present
    if (result.missingCategories && result.missingCategories.length > 0) {
      response.missingCategories = result.missingCategories;
    }
    if (result.requiresExternal !== undefined) {
      response.requiresExternal = result.requiresExternal;
    }
    if (result.suggestedExternal && result.suggestedExternal.length > 0) {
      response.suggestedExternal = result.suggestedExternal;
    }
    if (result.notes) {
      response.notes = result.notes;
    }

    // Cache the result
    await setCachedResult(cacheKey, outfitsWithItems);

    return new Response(
      JSON.stringify(response),
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
