import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';
import { OUTFIT_GENERATION_PROMPTS, OUTFIT_ENGINE_PROMPT, WARDROBE_ENGINE_PROMPT, WARDROBE_ENGINE_V3, OUTFIT_ENGINE_V3, ultraCompactItemForAI } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';
import { validateOutfitDiversity, enhanceOutfitDiversity } from './diversity-validator.ts';
import { generateDiverseFallbackOutfits, shuffleWardrobeInput } from './fallback-generator.ts';

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
      bypassCache,
      emotionalContext,
      tasteProfile,
      conversationMode,
      // User profile fields
      gender,
      ageRange,
      bodyShape,
      skinTone
    } = await req.json();

    const apiKey = getAIApiKey();

    console.log('Generating outfits:', { 
      generationType, 
      occasion, 
      style, 
      anchorItem: anchorItem?.name, 
      bypassCache,
      emotionalContext: emotionalContext?.emotional_tone,
      conversationMode,
      // User context
      gender,
      ageRange
    });

    // PHASE 2: Flexible wardrobe validation - allow generation unless impossible
    const validateWardrobe = (items: any[]) => {
      if (!items || items.length === 0) {
        return { 
          ok: false, 
          missingCategories: ['tops', 'bottoms', 'shoes'], 
          reason: 'Your wardrobe is empty. Upload at least 1 top, 1 bottom, and 1 pair of shoes to get outfit suggestions.',
          canGenerate: false
        };
      }

      const norm = (s: any) => (s || '').toString().toLowerCase();
      
      // Check for tops
      const tops = items.filter((i: any) => 
        ['shirt','top','tee','t-shirt','blouse','polo','kurta','kurti','tank'].some(k => norm(i.category).includes(k))
      );
      
      // Check for bottoms
      const bottoms = items.filter((i: any) => 
        ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom','legging','pajama','churidar','dhoti','lungi'].some(k => norm(i.category).includes(k))
      );
      
      // Check for footwear
      const shoes = items.filter((i: any) => 
        ['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper','jutti','mojari','kolhapuri'].some(k => norm(i.category).includes(k))
      );
      
      // Check for complete ethnic outfits (kurta sets, sarees, etc.)
      const ethnicComplete = items.filter((i: any) => 
        ['kurta set','saree','lehenga','sherwani','salwar kameez','suit'].some(k => norm(i.category).includes(k) || norm(i.name).includes(k))
      );
      
      // Check for dresses (complete outfits)
      const dresses = items.filter((i: any) => 
        ['dress','gown','jumpsuit','romper','one-piece','onepiece'].some(k => norm(i.category).includes(k))
      );
      
      const missing: string[] = [];
      
      // Can generate if:
      // 1. Has at least 1 top + 1 bottom + 1 footwear
      // 2. OR has ethnic complete outfit + footwear
      // 3. OR has dress + footwear
      // 4. OR has at least 3 items total (flexible generation)
      
      const hasBasicOutfit = tops.length > 0 && bottoms.length > 0 && shoes.length > 0;
      const hasEthnicOutfit = ethnicComplete.length > 0 && shoes.length > 0;
      const hasDressOutfit = dresses.length > 0 && shoes.length > 0;
      const hasMinimalItems = items.length >= 3;
      
      const canGenerate = hasBasicOutfit || hasEthnicOutfit || hasDressOutfit || hasMinimalItems;
      
      // Track what's missing for recommendations
      if (tops.length === 0) missing.push('tops');
      if (bottoms.length === 0) missing.push('bottoms');
      if (shoes.length === 0) missing.push('shoes');
      
      // If can generate but has gaps, suggest upgrades
      if (canGenerate && missing.length > 0) {
        return { 
          ok: true, 
          missingCategories: missing, 
          reason: `Good wardrobe! Consider adding ${missing.join(', ')} for more versatility.`,
          canGenerate: true,
          needsUpgrade: true
        };
      }
      
      // If cannot generate at all (only accessories, <3 items total)
      if (!canGenerate) {
        const onlyAccessories = items.every((i: any) => 
          ['accessory','bag','belt','watch','jewelry','hat','scarf'].some(k => norm(i.category).includes(k))
        );
        
        if (onlyAccessories) {
          return { 
            ok: false, 
            missingCategories: ['tops', 'bottoms', 'shoes'], 
            reason: 'You have only accessories. Upload clothing items (tops, bottoms, shoes) to create outfits.',
            canGenerate: false
          };
        }
        
        return { 
          ok: false, 
          missingCategories: missing.length > 0 ? missing : ['more items'], 
          reason: `Upload a few more items to create diverse outfits. You need: ${missing.join(', ') || 'more clothing pieces'}.`,
          canGenerate: false
        };
      }
      
      return { 
        ok: true, 
        missingCategories: [], 
        reason: 'Sufficient wardrobe',
        canGenerate: true
      };
    };

    const validation = validateWardrobe(wardrobeItems);
    
    // CRITICAL: Only block if literally cannot generate
    if (!validation.canGenerate) {
      console.warn('⚠️ Cannot generate outfits:', validation.reason);
      return new Response(
        JSON.stringify({ 
          success: false, 
          needsUpload: true, 
          missingCategories: validation.missingCategories,
          message: validation.reason 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log if wardrobe has gaps but can still generate
    if (validation.needsUpgrade) {
      console.log('✓ Generating with gaps:', validation.reason);
    }

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

    // Step 1: Generate outfit combinations with v4 enhancements
    const prompt = buildOutfitGenerationPrompt(
      generationType, 
      occasion, 
      style, 
      anchorItem, 
      wardrobeItems, 
      maxOutfits, 
      userLocation,
      emotionalContext,
      tasteProfile,
      conversationMode,
      // User profile
      { gender, ageRange, bodyShape, skinTone }
    );

    console.log('Calling Gemini API for outfit generation with Outfit Engine v4.0...');
    
    const data = await retryWithBackoff(() => callGeminiAPI({
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
                    boldness_level: { type: 'string', enum: ['safe', 'bold'] },
                    styling_opinion: { type: 'string' },
                    visual_description: { type: 'string' },
                    warnings: { 
                      type: 'array',
                      items: { type: 'string' }
                    }
                  },
                  required: ['pieces', 'reasoning', 'styleTag']
                }
              },
              totalGenerated: { type: 'number' },
              safe_outfit_index: { type: 'number' },
              bold_outfit_index: { type: 'number' },
              wardrobe_gaps: {
                type: 'array',
                items: { type: 'string' }
              },
              upgrade_suggestions: {
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
    }));

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
        const combos = generateDiverseFallbackOutfits(
          wardrobeItems,
          want,
          occasion,
          style,
          userLocation
        );

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

    // Step 2: Validate and enhance diversity
    const diversityReport = validateOutfitDiversity(result.outfits, wardrobeItems);
    console.log('📊 DIVERSITY METRICS:', {
      score: diversityReport.score,
      isValid: diversityReport.isValid,
      issues: diversityReport.issues.length > 0 ? diversityReport.issues : 'none'
    });

    if (!diversityReport.isValid && result.outfits.length > 1) {
      console.warn('⚠️ Low diversity detected, applying post-hoc fixes...');
      result.outfits = enhanceOutfitDiversity(result.outfits, wardrobeItems, diversityReport);
      console.log('✅ Diversity enhanced');
    }

    // Step 3: Map outfit items and preserve v4 metadata
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
        // v4 Enhanced fields
        ...(outfit.outfitId && { outfitId: outfit.outfitId }),
        ...(outfit.confidence !== undefined && { confidence: outfit.confidence }),
        ...(outfit.estimated_formality && { estimated_formality: outfit.estimated_formality }),
        ...(outfit.boldness_level && { boldness_level: outfit.boldness_level }),
        ...(outfit.styling_opinion && { styling_opinion: outfit.styling_opinion }),
        ...(outfit.visual_description && { visual_description: outfit.visual_description }),
        ...(outfit.warnings && { warnings: outfit.warnings })
      };
    });

    // Validate anchor item inclusion
    if (anchorItem) {
      console.log('[ANCHOR ITEM VALIDATION]', {
        anchorItemId: anchorItem.id,
        anchorItemName: anchorItem.name,
        totalOutfits: outfitsWithItems.length
      });
      
      outfitsWithItems.forEach((outfit: any, index: number) => {
        const hasAnchorItem = outfit.items.some((item: any) => item.id === anchorItem.id);
        console.log(`Outfit #${index + 1}: ${hasAnchorItem ? '✅' : '❌'} Contains anchor item`, {
          outfitItems: outfit.items.map((i: any) => `${i.name} (${i.id})`),
          anchorItemFound: hasAnchorItem
        });
        
        if (!hasAnchorItem) {
          console.error(`🚨 VALIDATION FAILED: Outfit #${index + 1} missing anchor item ${anchorItem.id}`);
        }
      });
    }


    // Build response with v4 metadata + diversity metrics
    const norm = (s: any) => (s || '').toString().toLowerCase();
    const isShoe = (c: string) => ['shoe','sneaker','boot','loafer','heel','sandal'].some(k => c.includes(k));
    const isBottom = (c: string) => ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom'].some(k => c.includes(k));
    const isTop = (c: string) => ['shirt','top','tee','blouse','kurta'].some(k => c.includes(k));
    
    const response: any = {
      success: true,
      outfits: outfitsWithItems,
      needsMoreItems: validation.needsUpgrade || false,
      missingCategories: validation.missingCategories || [],
      upgradeMessage: validation.needsUpgrade ? validation.reason : null,
      // v4 Enhanced fields
      ...(result.safe_outfit_index !== undefined && { safe_outfit_index: result.safe_outfit_index }),
      ...(result.bold_outfit_index !== undefined && { bold_outfit_index: result.bold_outfit_index }),
      ...(result.wardrobe_gaps && { wardrobe_gaps: result.wardrobe_gaps }),
      ...(result.upgrade_suggestions && { upgrade_suggestions: result.upgrade_suggestions }),
      // Diversity metadata
      diversity_metrics: {
        score: diversityReport.score,
        unique_shoes: new Set(outfitsWithItems.flatMap((o: any) => o.items.filter((i: any) => isShoe(norm(i.category))).map((i: any) => i.id))).size,
        unique_bottoms: new Set(outfitsWithItems.flatMap((o: any) => o.items.filter((i: any) => isBottom(norm(i.category))).map((i: any) => i.id))).size,
        unique_tops: new Set(outfitsWithItems.flatMap((o: any) => o.items.filter((i: any) => isTop(norm(i.category))).map((i: any) => i.id))).size,
        silhouette_variety: diversityReport.silhouetteVariety,
        color_variety: diversityReport.colorVariety,
        issues: diversityReport.issues,
        enhancement_applied: !diversityReport.isValid
      }
    };

    // Add legacy fields for backward compatibility
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

    console.log('[OUTFIT ENGINE v4.0 OUTPUT]', {
      total_outfits: outfitsWithItems.length,
      safe_index: result.safe_outfit_index,
      bold_index: result.bold_outfit_index,
      has_gaps: !!result.wardrobe_gaps?.length,
      has_opinions: outfitsWithItems.some((o: any) => o.styling_opinion),
      diversity_score: diversityReport.score,
      silhouette_variety: diversityReport.silhouetteVariety ? '✅' : '❌',
      color_variety: diversityReport.colorVariety ? '✅' : '❌'
    });

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

// ============================================
// PHASE 8: Token estimation for monitoring
// ============================================
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

// ============================================
// PHASE 5: Smart sampling for large wardrobes
// ============================================
function countNonNullFields(item: any): number {
  const importantFields = ['color', 'fabric_primary', 'formality_level', 'suitable_occasions', 'style_aesthetic'];
  return importantFields.filter(f => item[f] && item[f] !== null).length;
}

function sampleWardrobe(items: any[], maxItems: number = 35) {
  // If small wardrobe, use all
  if (items.length <= maxItems) return items;
  
  const norm = (s: any) => (s || '').toString().toLowerCase();
  
  // Group by category
  const grouped: Record<string, any[]> = {
    tops: items.filter(i => ['shirt','top','tee','t-shirt','blouse','polo','kurta'].some(k => norm(i.category).includes(k))),
    bottoms: items.filter(i => ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom'].some(k => norm(i.category).includes(k))),
    shoes: items.filter(i => ['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper'].some(k => norm(i.category).includes(k))),
    outerwear: items.filter(i => ['jacket','blazer','coat','cardigan','sweater','hoodie','outerwear'].some(k => norm(i.category).includes(k))),
    dresses: items.filter(i => ['dress','gown','jumpsuit','romper'].some(k => norm(i.category).includes(k))),
    ethnic: items.filter(i => ['kurta set','saree','lehenga','sherwani','salwar kameez'].some(k => norm(i.category).includes(k) || norm(i.name).includes(k))),
    accessories: items.filter(i => ['accessory','watch','belt','bag','handbag','sunglass','hat','scarf','jewelry'].some(k => norm(i.category).includes(k)))
  };
  
  const result: any[] = [];
  
  // Ensure minimum per category
  const minPerCategory: Record<string, number> = {
    tops: 8,
    bottoms: 6,
    shoes: 5,
    outerwear: 4,
    dresses: 3,
    ethnic: 4,
    accessories: 3,
  };
  
  // First pass: ensure minimums
  for (const [category, min] of Object.entries(minPerCategory)) {
    const categoryItems = grouped[category] || [];
    // Prioritize items with richer metadata
    const sorted = categoryItems.sort((a, b) => 
      countNonNullFields(b) - countNonNullFields(a)
    );
    result.push(...sorted.slice(0, Math.min(min, categoryItems.length)));
  }
  
  // Second pass: fill remaining slots with best items
  const remaining = maxItems - result.length;
  if (remaining > 0) {
    const usedIds = new Set(result.map(i => i.id));
    const unused = items
      .filter(i => !usedIds.has(i.id))
      .sort((a, b) => countNonNullFields(b) - countNonNullFields(a));
    result.push(...unused.slice(0, remaining));
  }
  
  return result;
}

// ============================================
// PHASE 4: Pre-filter by relevance
// ============================================
function filterRelevantItems(items: any[], occasion?: string, style?: string) {
  // If no filters, return sampled
  if (!occasion && !style) {
    return sampleWardrobe(items, 40); // Hard max for safety
  }
  
  // Score items by relevance
  const scored = items.map(item => {
    let score = 1; // Base score
    
    // Occasion match
    if (occasion && item.suitable_occasions?.includes(occasion)) {
      score += 3;
    }
    
    // Formality match
    if (occasion === 'formal' && ['formal', 'business_casual'].includes(item.formality_level)) {
      score += 2;
    }
    if (occasion === 'casual' && ['casual', 'smart_casual'].includes(item.formality_level)) {
      score += 2;
    }
    
    // Style match
    if (style && item.style_aesthetic?.includes(style)) {
      score += 2;
    }
    
    return { item, score };
  });
  
  // Sort by relevance, keep top items
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 30) // Top 30 most relevant
    .map(s => s.item);
}

// ============================================
// PHASE 6: Anchor item prioritization
// ============================================
function prepareWardrobeWithAnchor(items: any[], anchorItem?: any, maxItems: number = 35) {
  if (!anchorItem) return filterRelevantItems(items);
  
  // Always include anchor first
  const result = [anchorItem];
  
  // Sample complementary items (items that pair well with anchor)
  const complementary = items
    .filter(i => i.id !== anchorItem.id)
    .filter(i => i.category !== anchorItem.category); // Different categories
  
  // Score by complementary potential
  const scored = complementary.map(item => {
    let score = countNonNullFields(item);
    
    // Bonus for items that work with anchor's formality
    if (item.formality_level === anchorItem.formality_level) score += 2;
    
    // Bonus for complementary style
    if (item.style_aesthetic?.some((s: string) => anchorItem.style_aesthetic?.includes(s))) score += 2;
    
    return { item, score };
  });
  
  const sorted = scored.sort((a, b) => b.score - a.score);
  result.push(...sorted.slice(0, maxItems - 1).map(s => s.item));
  
  return result;
}

function buildOutfitGenerationPrompt(
  generationType: string,
  occasion?: string,
  style?: string,
  anchorItem?: any,
  wardrobeItems?: any[],
  maxOutfits?: number,
  userLocation?: { temp: number; weather: string; lat: number } | null,
  emotionalContext?: { emotional_tone: string; soft_mode_required: boolean; confidence: number },
  tasteProfile?: { color_palette: string; dominant_colors: string[]; style_aesthetic: string[]; wardrobe_size: number },
  conversationMode?: string,
  userProfile?: { gender?: string; ageRange?: string; bodyShape?: string; skinTone?: string }
): string {
  // PHASE 4, 5, 6: Pre-filter, sample, and prioritize wardrobe
  const originalCount = wardrobeItems?.length || 0;
  let optimizedWardrobe = wardrobeItems || [];
  
  if (anchorItem) {
    optimizedWardrobe = prepareWardrobeWithAnchor(optimizedWardrobe, anchorItem, 35);
  } else {
    optimizedWardrobe = filterRelevantItems(optimizedWardrobe, occasion, style);
  }
  
  // Shuffle within categories to prevent positional bias
  optimizedWardrobe = shuffleWardrobeInput(optimizedWardrobe);
  
  console.log(`📊 Wardrobe optimization: ${originalCount} → ${optimizedWardrobe.length} items`);
  if (optimizedWardrobe.length < originalCount) {
    console.log(`✂️ Filtered ${originalCount - optimizedWardrobe.length} items for relevance`);
  }
  // Build enhanced v4.0 prompt with emotional context and taste profile
  const contextualEnhancements = `
<OUTFIT_GENERATION_CONTEXT>
  ${emotionalContext ? `
  <EMOTIONAL_CONTEXT>
    <TONE>${emotionalContext.emotional_tone}</TONE>
    <SOFT_MODE_REQUIRED>${emotionalContext.soft_mode_required}</SOFT_MODE_REQUIRED>
    <CONFIDENCE>${emotionalContext.confidence}%</CONFIDENCE>
    
    STYLING BEHAVIOR:
    ${emotionalContext.soft_mode_required ? `
    - Use reassuring, confidence-building language
    - Suggest safe, comfortable outfit options first
    - Avoid experimental or bold suggestions unless user explicitly wants them
    - Focus on making user feel good about their choices
    ` : emotionalContext.emotional_tone === 'excitement' ? `
    - Match the excitement with bold, statement-making outfits
    - Suggest trend-forward combinations
    - Use enthusiastic, hype language in styling_opinion
    ` : `
    - Balanced approach: provide both safe and bold options
    - Let outfit speak for itself with clear reasoning
    `}
  </EMOTIONAL_CONTEXT>
  ` : ''}
  
  ${tasteProfile ? `
  <TASTE_PROFILE>
    <WARDROBE_SIZE>${tasteProfile.wardrobe_size}</WARDROBE_SIZE>
    <COLOR_PALETTE>${tasteProfile.color_palette}</COLOR_PALETTE>
    <DOMINANT_COLORS>${tasteProfile.dominant_colors.join(', ')}</DOMINANT_COLORS>
    <STYLE_AESTHETICS>${tasteProfile.style_aesthetic.join(', ')}</STYLE_AESTHETICS>
    
    STYLING LOGIC:
    - Prioritize colors from user's palette: ${tasteProfile.dominant_colors.join(', ')}
    - Match aesthetic preferences: ${tasteProfile.style_aesthetic.join(', ')}
    - ${tasteProfile.wardrobe_size < 10 ? 'Create versatile combinations that maximize outfit variety' : 'Explore diverse styling options'}
  </TASTE_PROFILE>
  ` : ''}
  
  ${conversationMode ? `
  <CONVERSATION_MODE>${conversationMode}</CONVERSATION_MODE>
  ` : ''}
  
  ${userProfile?.gender || userProfile?.ageRange ? `
  <USER_PROFILE>
    ${userProfile.gender ? `<GENDER>${userProfile.gender}</GENDER>` : ''}
    ${userProfile.ageRange ? `<AGE_RANGE>${userProfile.ageRange}</AGE_RANGE>` : ''}
    ${userProfile.bodyShape ? `<BODY_SHAPE>${userProfile.bodyShape}</BODY_SHAPE>` : ''}
    ${userProfile.skinTone ? `<SKIN_TONE>${userProfile.skinTone}</SKIN_TONE>` : ''}
    
    GENDER-AWARE STYLING RULES:
    ${userProfile.gender === 'female' ? `
    - Prioritize feminine silhouettes when available (A-line, fit-and-flare)
    - Include options for dresses, skirts, ethnic wear (kurtis, sarees)
    - Consider jewelry and accessory pairings
    - For formal: saree, lehenga, formal dresses, tailored suits
    ` : userProfile.gender === 'male' ? `
    - Prioritize masculine silhouettes (structured, relaxed, athletic fits)
    - Include options for kurtas, sherwanis for ethnic occasions
    - Consider watch, belt, pocket square pairings
    - For formal: suits, formal kurta sets, blazer combinations
    ` : `
    - Use gender-neutral styling approach
    - Focus on silhouette and color rather than gendered categories
    - Mix traditionally masculine and feminine pieces freely
    `}
    
    AGE-APPROPRIATE STYLING:
    ${userProfile.ageRange === '<18' ? `
    - Fun, expressive, trend-forward styles
    - Avoid overly formal or mature looks
    - Embrace bold colors and patterns
    ` : userProfile.ageRange === '18-21' ? `
    - Gen-Z trends: oversized, streetwear, Y2K influences
    - Balance trendy with practical
    - Statement pieces welcome
    ` : userProfile.ageRange === '22-26' ? `
    - Young professional vibes
    - Mix casual and smart-casual
    - Versatile pieces that work day-to-night
    ` : userProfile.ageRange === '27-30' ? `
    - Elevated basics, quality over quantity
    - Sophisticated casual and business looks
    - Timeless pieces with modern touches
    ` : userProfile.ageRange === '>30' ? `
    - Classic, refined aesthetics
    - Focus on fit and quality
    - Elegant and polished combinations
    ` : ''}
  </USER_PROFILE>
  ` : ''}
</OUTFIT_GENERATION_CONTEXT>

<OUTFIT_ENGINE_v4_INSTRUCTIONS>
  
  1. SAFE + BOLD DUAL OUTPUT LOGIC:
     ${!occasion || occasion === 'casual' || !style ? `
     Since occasion/style is ambiguous or casual:
     - Generate at LEAST 2 outfits
     - Mark one as "safe" (classic, proven, comfortable)
     - Mark one as "bold" (experimental, statement, confident)
     - Set safe_outfit_index and bold_outfit_index in response
     - User can choose based on mood
     ` : `
     Since occasion/style is specific (${occasion || style}):
     - Generate outfits optimized for the occasion
     - Still vary boldness levels across outfits
     - Mark boldness_level: 'safe' or 'bold' for each outfit
     `}
  
  2. INDIAN CULTURAL STYLING RULES (from Module 10):
     - For ethnic occasions: Kurta sets, sarees, lehengas are PRIMARY
     - For fusion: Mix ethnic pieces with western (kurta + jeans, palazzo + crop top)
     - For casual Indian context: Kurtis, ethnic tops work with jeans/trousers
     - Festivals/weddings: Prioritize traditional silhouettes with modern touches
     - Office/formal: Shirts, trousers, blazers OR formal ethnic (formal kurta, dress pants)
  
  3. WARDROBE GAP ANALYSIS:
     After generating outfits, analyze wardrobe and identify:
     - Missing categories that would unlock 5+ new outfit combinations
     - Items that would elevate existing outfits (blazer, statement accessory)
     - Return as wardrobe_gaps: ["category: reason", ...]
     - Return upgrade_suggestions with priority (high/medium/low)
  
  4. STYLING OPINION (from Stylist Opinion Engine):
     For EACH outfit, include styling_opinion field:
     - Give honest, fashion-smart opinion
     - Use warm, opinionated language
     - Example: "This combo is clean—oversized tee balances the fitted jeans perfectly. Very Gen-Z minimalist."
     - Example: "Bold move with this pattern mix, but the neutral base grounds it. You'll stand out."
  
  5. VISUAL DESCRIPTION (from Visual Simulation Engine):
     For EACH outfit, include visual_description field:
     - Use imagination-based language
     - Example: "Picturing this... the rust-brown kurta against your skin tone? Actually fire."
     - Example: "Visualizing it—black on black with the white sneakers as the pop. Very editorial."
  
  6. POST-OUTFIT RECOMMENDATIONS:
     Always suggest 1-2 items user could add to multiply outfit possibilities:
     - Focus on high-impact pieces (blazer, statement shoe, versatile bottom)
     - Explain how it unlocks X more outfit combinations
</OUTFIT_ENGINE_v4_INSTRUCTIONS>
`;

  // Build the base prompt with optimized wardrobe
  const basePrompt = OUTFIT_GENERATION_PROMPTS.BUILD_PROMPT({
    generationType,
    occasion,
    style,
    anchorItem,
    wardrobeItems: optimizedWardrobe, // Use filtered/sampled wardrobe
    maxOutfits,
    userLocation: userLocation ? { temp: userLocation.temp, weather: userLocation.weather } : undefined,
    gender: userProfile?.gender,
    ageRange: userProfile?.ageRange
  });

  // PHASE 7: v3.0 ULTRA-COMPACT PROMPT STRUCTURE (68% token reduction)
  const finalPrompt = `${WARDROBE_ENGINE_V3}

${OUTFIT_ENGINE_V3}

<TASK>
Generate ${maxOutfits || 3} outfits from wardrobe.
${anchorItem ? `🔒 ANCHOR: ID=${anchorItem.id} "${anchorItem.name}" MUST be in EVERY outfit.` : ''}
${!occasion || occasion === 'casual' || !style ? 'Include 1 safe + 1 bold outfit with meaningful difference.' : ''}
</TASK>

${basePrompt}

CALL generate_outfit_combinations ONLY. Include styling_opinion + visual_description for EVERY outfit.`;

  // PHASE 8: Token estimation logging (v3.0 metrics with detailed breakdown)
  const wardrobeEngineTokens = estimateTokens(WARDROBE_ENGINE_V3);
  const outfitEngineTokens = estimateTokens(OUTFIT_ENGINE_V3);
  const buildPromptTokens = estimateTokens(basePrompt);
  const estimatedTokens = estimateTokens(finalPrompt);
  
  console.log('📊 v3.0 Token Breakdown:', {
    wardrobeEngineV3: `${wardrobeEngineTokens} tokens`,
    outfitEngineV3: `${outfitEngineTokens} tokens`,
    buildPrompt: `${buildPromptTokens} tokens`,
    total: `${estimatedTokens} tokens`,
    target: '≤3500 tokens',
    targetMet: estimatedTokens <= 3500 ? '✅ YES' : '❌ NO',
    itemFormat: 'ultraCompact (~40 tokens/item)',
    wardrobeItems: optimizedWardrobe.length,
    estimatedItemTokens: `~${optimizedWardrobe.length * 40}`,
    reduction: originalCount > optimizedWardrobe.length 
      ? `${Math.round((1 - optimizedWardrobe.length / originalCount) * 100)}% items filtered`
      : 'no filtering',
    anchorEnforced: anchorItem ? '🔒 YES' : 'N/A'
  });

  return finalPrompt;
}
