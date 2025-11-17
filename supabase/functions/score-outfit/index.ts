/**
 * Edge Function: score-outfit
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎯 PHASE 1 ARCHITECTURAL UPGRADE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * UNIFIED SINGLE-CALL STYLE CHECK ENGINE
 * 
 * Previously: Two separate Gemini calls
 *   - API Call #2: EXTRACTION_PROMPT (visual metadata)
 *   - API Call #3: SCORING_PROMPTS.SCORE_OUTFIT (feedback generation)
 * 
 * Now: ONE intelligent Gemini call
 *   - MASTER_UNIFIED_STYLECHECK_PROMPT (extraction + scoring in single response)
 *   - Faster, cheaper, more coherent
 *   - Constraint-aware from the start
 * 
 * Key Features:
 * - Comprehensive garment extraction with physical constraints (rollable, tuckable)
 * - Body visibility awareness for smart feedback filtering
 * - Wardrobe-grounded recommendations
 * - Constraint-aware quick fixes (no impossible suggestions)
 * - Indian fashion context integration
 * - Supportive, non-judgmental tone
 * 
 * Dependencies:
 * - Called by: StyleCheckHub.tsx (startStyleCheck)
 * - Uses: MASTER_UNIFIED_STYLECHECK_PROMPT, VisualSchema
 * - Model: google/gemini-2.5-flash via Lovable AI Gateway
 * 
 * Input:
 * {
 *   imageData: string,    // Base64 data URL or public URL
 *   occasion?: string,    // e.g., "Date Night"
 *   style?: string,       // e.g., "Minimalist"
 *   vibe?: string,        // e.g., "Polished"
 *   wardrobeItems?: any[] // Optional wardrobe for grounded recommendations
 * }
 * 
 * Output (DB-compatible format):
 * {
 *   overall_score: number,          // 0-5, one decimal
 *   fit_score: number,              // Component scores
 *   color_score: number,
 *   texture_score: number,
 *   occasion_score: number,
 *   outfit_name: string,            // Creative name
 *   verdict_positive: string,       // What works (joined)
 *   verdict_improvements: string,   // What doesn't work (joined)
 *   quick_fix: string,              // Quick fixes (joined, constraint-filtered)
 *   editorial: string,              // 25-45 word summary
 *   confidence: number,             // 0-1
 *   metadata: object                // Full extraction + scoring data
 * }
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiAPI } from "../_shared/ai-config.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-utils.ts";
import { generateCacheKey, getCachedResult, setCachedResult } from "../_shared/cache-utils.ts";
import { MASTER_UNIFIED_STYLECHECK_PROMPT } from "../_shared/fashion/prompt/masterUnifiedStyleCheckPrompt.ts";
import { VisualSchema } from "../_shared/fashion/schema/visualSchema.ts";
import { retryWithBackoff } from "../_shared/retry-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEBUG_MODE = Deno.env.get("DEBUG_STYLECHECK") === "true";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Safe field getter with nested path support
 * Prevents crashes when accessing undefined nested properties
 */
const safeGet = (obj: any, path: string, defaultValue: any = null): any => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result?.[key] !== undefined) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  return result;
};

/**
 * Extract value from {value, confidence, reason} field structure
 */
const extractFieldValue = (field: any, defaultValue: any = null): any => {
  if (!field) return defaultValue;
  if (typeof field === 'object' && 'value' in field) return field.value;
  return field;
};

/**
 * CONSTRAINT-AWARE FILTER: Remove impossible quick fixes
 * 
 * Enforces physical garment constraints:
 * - rollable: Can sleeves be rolled?
 * - tuckable: Can garment be tucked?
 * - watch_present_with_confidence: Is watch already worn?
 * - footwear_visible: Can we see footwear to comment on it?
 * - bottom_wash: Use exact wash level, not "lighter"
 */
const filterImpossibleFixes = (fixes: string[], metadata: any): string[] => {
  if (DEBUG_MODE) console.log("🔍 Filtering fixes against constraints...");
  
  return fixes.filter(fix => {
    const lower = fix.toLowerCase();
    
    // CONSTRAINT #1: Rollable sleeves
    const garments = metadata.garments || [];
    const topGarment = garments.find((g: any) => extractFieldValue(g.garment_type) === 'top');
    const rollable = extractFieldValue(topGarment?.rollable, true); // Default true for backward compat
    
    if (rollable === false && (lower.includes('roll') && lower.includes('sleeve'))) {
      if (DEBUG_MODE) console.log(`  🚫 Filtered (not rollable): ${fix}`);
      return false;
    }
    
    // CONSTRAINT #2: Tuckable garment
    const tuckable = extractFieldValue(topGarment?.tuckable, true);
    if (tuckable === false && lower.includes('tuck')) {
      if (DEBUG_MODE) console.log(`  🚫 Filtered (not tuckable): ${fix}`);
      return false;
    }
    
    // CONSTRAINT #3: Watch already present
    const watchConf = extractFieldValue(metadata.accessories_present?.watch_present_with_confidence, 0);
    if (watchConf > 0.6 && lower.includes('add') && lower.includes('watch')) {
      if (DEBUG_MODE) console.log(`  🚫 Filtered (watch already present, conf=${watchConf}): ${fix}`);
      return false;
    }
    
    // CONSTRAINT #4: Footwear visibility
    const footwearVisible = extractFieldValue(metadata.footwear?.footwear_visible, true);
    if (!footwearVisible && lower.includes('shoe') && !lower.includes('if')) {
      if (DEBUG_MODE) console.log(`  🚫 Filtered (footwear not visible): ${fix}`);
      return false;
    }
    
    // CONSTRAINT #5: Vague color suggestions
    if ((lower.includes('lighter') || lower.includes('darker')) && 
        (lower.includes('jean') || lower.includes('denim') || lower.includes('pant'))) {
      if (DEBUG_MODE) console.log(`  🚫 Filtered (vague color term): ${fix}`);
      return false;
    }
    
    if (DEBUG_MODE) console.log(`  ✅ Passed: ${fix}`);
    return true;
  });
};

/**
 * Enforce color specificity: Replace vague terms with exact wash levels
 */
const enforceColorSpecificity = (fixes: string[], metadata: any): string[] => {
  const bottomWash = extractFieldValue(metadata.garments?.find((g: any) => 
    extractFieldValue(g.garment_type) === 'bottom'
  )?.bottom_wash);
  
  if (!bottomWash) return fixes;
  
  return fixes.map(fix => {
    let updated = fix;
    if (fix.toLowerCase().includes('lighter')) {
      updated = updated.replace(/lighter/gi, bottomWash);
    }
    if (fix.toLowerCase().includes('darker')) {
      updated = updated.replace(/darker/gi, bottomWash);
    }
    return updated;
  });
};

/**
 * Deduplicate and cap quick fixes to reasonable count
 */
const deduplicateAndCapFixes = (fixes: string[], maxCount: number = 8): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const fix of fixes) {
    const normalized = fix.toLowerCase().trim();
    if (!seen.has(normalized) && unique.length < maxCount) {
      seen.add(normalized);
      unique.push(fix);
    }
  }
  
  return unique;
};

/**
 * Generate fallback result when AI response fails
 */
const generateFallbackResult = (style?: string, missingFeatures: string[] = []): any => {
  return {
    outfit_name: `${style || "Contemporary"} Look`,
    what_works: ["Well-composed outfit with thoughtful elements"],
    what_doesnt_work: missingFeatures.length > 0 
      ? [`Limited visibility: ${missingFeatures.join(", ")}`]
      : ["Minor refinements possible"],
    quick_fixes: [
      "Consider adjusting proportions for better balance",
      "Refine color harmony for cohesiveness",
      "Add subtle accessories to complete the look",
    ],
    editorial: "A refined outfit showing good style awareness. Focus on visible elements for best feedback.",
  };
};

/**
 * Format wardrobe items for AI consumption
 */
const formatWardrobeForAI = (items: any[]): string => {
  if (!items || items.length === 0) return '';
  
  return items.map(item => 
    `${item.name} [${item.category}] - ${item.primary_color_name || item.color || 'unknown color'}`
  ).join('\n');
};

/**
 * Extract unique wardrobe attributes
 */
const extractWardrobeAttributes = (items: any[]): { colors: string[], categories: string[] } => {
  if (!items || items.length === 0) return { colors: [], categories: [] };
  
  const colors = [...new Set(
    items.map(i => i.primary_color_name || i.color).filter(Boolean)
  )];
  
  const categories = [...new Set(
    items.map(i => i.category).filter(Boolean)
  )];
  
  return { colors, categories };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.user) {
      return unauthorizedResponse(corsHeaders);
    }

    // Parse request body
    const { imageData, occasion, style, vibe, wardrobeItems } = await req.json();

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: "imageData is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (DEBUG_MODE) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎯 UNIFIED STYLE CHECK REQUEST");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Occasion: ${occasion || 'none'}`);
      console.log(`Style: ${style || 'none'}`);
      console.log(`Vibe: ${vibe || 'none'}`);
      console.log(`Wardrobe items: ${wardrobeItems?.length || 0}`);
    }

    // Extract wardrobe attributes
    const { colors: wardrobeColors, categories: wardrobeCategories } = extractWardrobeAttributes(wardrobeItems);
    const wardrobeFormatted = formatWardrobeForAI(wardrobeItems || []);

    // Check cache
    const cacheKey = await generateCacheKey({
      type: 'unified_style_check_v1',
      imageData,
      occasion: occasion || '',
      style: style || '',
      vibe: vibe || '',
      wardrobeHash: JSON.stringify(wardrobeColors),
    });

    const cached = await getCachedResult(cacheKey);
    if (cached) {
      if (DEBUG_MODE) console.log("✅ Cache hit!");
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (DEBUG_MODE) console.log("🔄 Cache miss, calling AI...");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UNIFIED AI CALL (Phase 1 Upgrade)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log("🎨 Starting unified style check (extraction + scoring in ONE call)...");
    
    const unifiedPrompt = MASTER_UNIFIED_STYLECHECK_PROMPT({
      occasion,
      style,
      vibe,
      wardrobeColors,
      wardrobeCategories,
      wardrobeItems: wardrobeFormatted,
    });

    let aiResponse;
    try {
      aiResponse = await retryWithBackoff(() =>
        callGeminiAPI({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: unifiedPrompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          }],
          max_tokens: 4096,  // Prevent truncation
          temperature: 0.3,
        })
      );
    } catch (error: any) {
      if (error.message === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({ 
            error: "Rate limits exceeded. Our AI is experiencing high demand. Please try again in a few moments." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (error.message === "PAYMENT_REQUIRED") {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    // Parse AI response
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    if (DEBUG_MODE) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📦 RAW AI RESPONSE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(content.substring(0, 500) + "...");
    }

    let unifiedResult;
    try {
      // Strategy 1: Direct parse with markdown cleanup
      const cleaned = content.trim().replace(/^```json\n?|```$/g, "");
      unifiedResult = JSON.parse(cleaned);
      console.log("✅ JSON parse successful (direct)");
    } catch (parseError) {
      console.error("❌ JSON parse failed:", parseError);
      console.error("Response length:", content.length, "chars");
      
      // Strategy 2: Regex extraction for robust JSON recovery
      try {
        const jsonMatch = content.match(/{[\s\S]*}/);
        if (jsonMatch) {
          unifiedResult = JSON.parse(jsonMatch[0]);
          console.log("✅ JSON recovered via regex extraction");
        } else {
          throw new Error("No JSON structure found in response");
        }
      } catch (regexError) {
        console.error("❌ Regex extraction failed:", regexError);
        
        // Log diagnostic info
        console.error("First 1000 chars:", content.substring(0, 1000));
        console.error("Last 500 chars:", content.substring(Math.max(0, content.length - 500)));
        
        // Last resort: Use fallback with low confidence
        console.warn("⚠️ Using fallback result due to parse failure");
        const fallback = generateFallbackResult(style);
        unifiedResult = {
          ...fallback,
          overall_score: 3.5,
          components: {
            fit: { score: 3.5, confidence: 0.5 },
            color: { score: 3.5, confidence: 0.5 },
            styling: { score: 3.5, confidence: 0.5 },
            material: { score: 3.5, confidence: 0.5 },
          },
          confidence: 0.3,  // Low confidence for fallback
        };
      }
    }

    // Validate with schema
    if (DEBUG_MODE) console.log("🔍 Validating against VisualSchema...");
    const validation = VisualSchema.safeParse(unifiedResult);
    
    if (!validation.success) {
      console.warn("⚠️ Schema validation issues (continuing with partial data):");
      console.warn(JSON.stringify(validation.error.issues.slice(0, 5), null, 2));
      if (DEBUG_MODE) {
        console.warn("Full validation errors:", validation.error.issues);
      }
    } else {
      if (DEBUG_MODE) console.log("✅ Schema validation passed");
    }
    
    const validated = validation.success ? validation.data : unifiedResult;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONSTRAINT FILTERING (Phase 1 Enhancement)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (DEBUG_MODE) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🛡️ CONSTRAINT FILTERING");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    let quickFixes = validated.quick_fixes || ["Adjust proportions", "Refine styling", "Consider accessories"];
    const originalFixCount = quickFixes.length;
    
    // Apply constraint filters
    quickFixes = filterImpossibleFixes(quickFixes, validated);
    quickFixes = enforceColorSpecificity(quickFixes, validated);
    quickFixes = deduplicateAndCapFixes(quickFixes, 8);
    
    if (DEBUG_MODE) {
      console.log(`Fixes: ${originalFixCount} → ${quickFixes.length} (after filtering)`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BUILD FINAL RESPONSE (DB-compatible format)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const finalResult = {
      // DB fields (for style_checks table)
      overall_score: validated.overall_score || 3.5,
      fit_score: validated.components?.fit?.score || 3.5,
      color_score: validated.components?.color?.score || 3.5,
      texture_score: validated.components?.material?.score || 3.5,
      occasion_score: validated.components?.styling?.score || 3.5,
      outfit_name: validated.outfit_name || `${style || 'Contemporary'} Look`,
      verdict_positive: (validated.what_works || ["Well-composed outfit"]).join(' • '),
      verdict_improvements: (validated.what_doesnt_work || ["Minor refinements possible"]).join(' • '),
      quick_fix: quickFixes.join(' | '),
      editorial: validated.editorial || "A thoughtful outfit with good style awareness.",
      confidence: validated.confidence || 0.85,
      
      // Extended data (for frontend consumption)
      metadata: validated, // Full extraction + scoring data
      what_works: validated.what_works || ["Well-composed outfit"],
      what_doesnt_work: validated.what_doesnt_work || ["Minor refinements possible"],
      quick_fixes: quickFixes,
      micro_recommendations: validated.micro_recommendations || [],
      proportion_balance: validated.proportion_balance,
      silhouette_breakdown: validated.silhouette_breakdown,
      wardrobe_opportunities: validated.wardrobe_opportunities || [],
      reasoning: validated.reasoning || {},
      missing_features: validated.missing_features || [],
    };

    if (DEBUG_MODE) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 FINAL RESULT");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Overall Score: ${finalResult.overall_score}/5.0`);
      console.log(`Outfit Name: ${finalResult.outfit_name}`);
      console.log(`Quick Fixes: ${finalResult.quick_fixes.length}`);
      console.log(`Confidence: ${(finalResult.confidence * 100).toFixed(0)}%`);
    }

    // Cache result (1 hour TTL)
    await setCachedResult(cacheKey, finalResult);

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Score outfit error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: DEBUG_MODE ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
