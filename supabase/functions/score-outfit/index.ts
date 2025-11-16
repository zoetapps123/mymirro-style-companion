/**
 * Edge Function: score-outfit
 * 
 * Role: Main style check analysis (API Calls #2 & #3 in Style Check flow)
 * 
 * Dependencies:
 * - Called by: StyleCheckHub.tsx (startStyleCheck)
 * - Uses: EXTRACTION_PROMPT, VisualSchema, SCORING_PROMPTS.SCORE_OUTFIT
 * - Model: google/gemini-2.5-flash via Lovable AI Gateway
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎯 PHASE 1 ENHANCEMENTS (Fashion Intelligence Upgrade)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. **Transient User Profile Inference** (in-memory only):
 *    - Extracts body_shape, skin_tone_band, perceived_age_band, etc. from image
 *    - Used for context-aware scoring (fit on body shape, color on skin tone)
 *    - NEVER stored in DB - purely in-memory for better analysis
 *    - Falls back to "unknown" when person not visible
 * 
 * 2. **Explicit missing_features Rules**:
 *    - Clear guidelines for what qualifies as "missing" (visibility issues only)
 *    - Prevents generic/unhelpful missing feature entries
 *    - Uses lowercase snake_case format (e.g., "footwear_not_visible")
 * 
 * 3. **Supportive Scoring Calibration**:
 *    - Non-anxiety-inducing feedback in score reasons
 *    - Solution-oriented language ("how to elevate" vs "what's wrong")
 *    - Context-aware evaluation using user profile data
 * 
 * 4. **Enhanced metadataContext**:
 *    - Now includes user profile section when available
 *    - Better context for SCORE_OUTFIT to generate personalized feedback
 *    - Maintains same final JSON response shape for DB/frontend compatibility
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🌟 PHASE 2 ENHANCEMENTS (Feedback Quality & Indian Context)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. **Warmer, Supportive Tone**:
 *    - SCORE_OUTFIT prompt rewritten for non-anxiety-inducing feedback
 *    - Positive framing: "try this for improvement" vs "this doesn't work"
 *    - Celebrates strengths before addressing opportunities
 *    - Avoids harsh words (bad, wrong, unflattering, poor)
 * 
 * 2. **Indian Fashion Context Awareness**:
 *    - Explicit support for Indian occasions (weddings: haldi/mehendi/sangeet/reception)
 *    - Festivals (Diwali, Navratri, Eid, Christmas/New Year)
 *    - Indian lifestyle scenarios (airport looks, hill stations, Goa travel, college fests)
 *    - Modern contexts (office casual, hybrid work, café hopping, clubbing, date nights)
 *    - Seasonal awareness (light winter, North India winter, monsoon)
 * 
 * 3. **Wearer Context Integration**:
 *    - Uses inferred user_profile (from Phase 1) when confidence is high
 *    - Provides personalized fit advice based on body_shape
 *    - Suggests colors that complement skin_tone_band (Indian-tuned values)
 *    - Ignores "unknown" values gracefully, never mentions them to user
 *    - NEVER makes personal/appearance-based comments
 * 
 * 4. **Visibility & Missing Features Handling**:
 *    - Conditional advice when elements not visible ("If footwear is X, then Y")
 *    - Focuses on visible elements only
 *    - Never hallucinates unseen details
 *    - Acknowledges limited visibility gracefully
 * 
 * 5. **Structured, Actionable Output**:
 *    - **outfit_name**: Stylish, non-generic (e.g., "Indigo Street Ease", "Monsoon Layered Chic")
 *    - **what_works**: At least 3 points, max 15 words, celebrates strengths with data
 *    - **what_doesnt_work**: 2-3 gentle points, opportunities not failures
 *    - **quick_fixes**: At least 3-6 specific fixes, 12-15 words, action-verb-led, includes WHY
 *    - **editorial**: 25-45 words, polished stylist note, references occasion/vibe/metadata/wearer
 * 
 * 6. **metadataContext as Ground Truth**:
 *    - All feedback must cite extracted data (no hallucination)
 *    - References user_profile fields when available and confident
 *    - Does not contradict or guess beyond provided metadata
 * 
 * ⚠️ BACKWARD COMPATIBILITY (PHASE 2):
 * - Output shape unchanged: { outfit_name, what_works, what_doesnt_work, quick_fixes, editorial }
 * - Field names preserved (not what_didnt_work → what_doesnt_work, not quick_fix → quick_fixes)
 * - DB insert unchanged (style_checks table)
 * - API response unchanged (frontend compatibility maintained)
 * - No new API calls (still 3 calls total)
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Two-Stage AI Analysis Process:
 * 
 * API Call #2 - Visual Extraction (EXTRACTION_PROMPT):
 * - Extracts structured outfit metadata using VisualSchema
 * - **NEW**: Infers transient user_profile when person visible
 * - **NEW**: Uses explicit missing_features rules
 * - Returns: fit, fabric, color, styling, aesthetics, user_profile, scores
 * - Validates response with Zod schema (VisualSchema.safeParse)
 * 
 * API Call #3 - Dynamic Feedback (SCORE_OUTFIT):
 * - Uses metadataContext string built from validated extraction data
 * - **NEW**: metadataContext includes user profile context for personalization
 * - Generates human-readable feedback: outfit_name, what_works, what_didnt_work, quick_fixes, editorial
 * - **NEW**: Feedback uses supportive, solution-oriented language
 * 
 * Input:
 * {
 *   imageData: string,    // Base64 data URL or public URL
 *   occasion?: string,    // e.g., "Date Night"
 *   style?: string,       // e.g., "Minimalist"
 *   vibe?: string,        // e.g., "Polished"
 *   wardrobeItems?: any[] // Phase 6: Optional wardrobe for micro-recommendations
 * }
 * 
 * Output:
 * {
 *   overall_score: number,          // 0-5 rounded to 0.25
 *   components: {                   // Individual scores from AI
 *     fit: number,
 *     color: number,
 *     styling: number,
 *     material: number
 *   },
 *   outfit_name: string,            // Creative outfit name
 *   what_works: string[],           // Positive feedback points
 *   what_didnt_work: string[],      // Areas for improvement
 *   quick_fix: string[],            // Actionable styling tips
 *   micro_recommendations: string[], // Phase 6: Immediately actionable tweaks (3-6 items, 7-14 words)
 *   editorial: string,              // Editorial quote/summary
 *   confidence: number,             // Lowest component confidence
 *   missing_features: string[]      // Features AI couldn't detect (Phase 1: clearer format)
 * }
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎁 PHASE 6 ENHANCEMENTS (Smart Micro-Recommendations)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. **Wardrobe-First But Not Limited Logic**:
 *    - Accepts optional wardrobeItems array in request
 *    - Builds concise wardrobe summary by category for SCORE_OUTFIT
 *    - If wardrobe has relevant items → suggests using them
 *    - If wardrobe is empty/weak → falls back to universal styling tweaks
 * 
 * 2. **Micro-Recommendations Output** (new field):
 *    - 3-6 immediately actionable improvements (7-14 words each)
 *    - Can execute right now without shopping
 *    - Examples: "Half-tuck the tee for cleaner proportions", "Roll sleeves for sharper detail"
 *    - NO shopping suggestions, NO festival/wedding refs, NO body criticism
 * 
 * 3. **Enhanced metadataContext Builder**:
 *    - Now includes WARDROBE_CONTEXT section with tops/bottoms/footwear/outerwear/accessories
 *    - Format: "tops: [white tee, black shirt]; bottoms: [blue denim]"
 *    - If no wardrobe: "WARDROBE_CONTEXT: none_available" triggers universal suggestions
 * 
 * 4. **Guardrails & Safety**:
 *    - ❌ No shopping ("buy X", "get Y")
 *    - ❌ No festivals (Diwali, haldi, Christmas)
 *    - ❌ No hallucinating wardrobe items not provided
 *    - ✅ Universal actions: tucking, rolling, cuffing, proportions
 *    - ✅ Conditional phrasing when visibility limited
 * 
 * Caching:
 * - Cache key: SHA-256 hash of { type: "outfit_score_v4", imageData, occasion, style, vibe }
 * - TTL: 1 hour (via setCachedResult in cache-utils.ts)
 * - Stored in: ai_cache table
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from "../_shared/ai-config.ts";
import { SCORING_PROMPTS } from "../_shared/prompts.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-utils.ts";
import { generateCacheKey, getCachedResult, setCachedResult } from "../_shared/cache-utils.ts";
import { EXTRACTION_PROMPT } from "../_shared/fashion/prompt/extractionPrompt.ts";
import { VisualSchema } from "../_shared/fashion/schema/visualSchema.ts";
import { retryWithBackoff } from "../_shared/retry-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Phase 4: JSON Recovery Helper
 * Phase 6: Enhanced to handle micro_recommendations
 * 
 * Attempts to recover malformed JSON from AI responses through multiple strategies:
 * 1. Strip markdown code fences and trailing text
 * 2. Normalize field name variations (what_didnt_work → what_doesnt_work)
 * 3. Convert strings to arrays where arrays are expected
 * 4. Ensure all required fields exist with proper types
 * 
 * Returns null if recovery is impossible
 */
function recoverJSON(rawContent: string): any | null {
  try {
    // Phase 4 Guardrail: Strip markdown and trailing text
    let cleaned = rawContent.trim();
    
    // Remove markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\n?/g, "").replace(/```$/g, "");
    
    // Find the last complete JSON object by looking for final }
    const lastBraceIndex = cleaned.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      cleaned = cleaned.substring(0, lastBraceIndex + 1);
    }
    
    // Attempt primary parse
    let parsed = JSON.parse(cleaned);
    
    // Phase 4 Guardrail: Normalize field name variations
    if (parsed.what_didnt_work && !parsed.what_doesnt_work) {
      parsed.what_doesnt_work = parsed.what_didnt_work;
      delete parsed.what_didnt_work;
    }
    if (parsed.quick_fix && !parsed.quick_fixes) {
      parsed.quick_fixes = parsed.quick_fix;
      delete parsed.quick_fix;
    }
    
    // Phase 4 Guardrail: Convert strings to arrays where needed
    if (typeof parsed.what_works === "string") {
      parsed.what_works = [parsed.what_works];
    }
    if (typeof parsed.what_doesnt_work === "string") {
      parsed.what_doesnt_work = [parsed.what_doesnt_work];
    }
    if (typeof parsed.quick_fixes === "string") {
      parsed.quick_fixes = [parsed.quick_fixes];
    }
    // Phase 6: Handle micro_recommendations
    if (typeof parsed.micro_recommendations === "string") {
      parsed.micro_recommendations = [parsed.micro_recommendations];
    }
    
    // Phase 4 Guardrail: Ensure arrays are actually arrays
    if (parsed.what_works && !Array.isArray(parsed.what_works)) {
      parsed.what_works = [String(parsed.what_works)];
    }
    if (parsed.what_doesnt_work && !Array.isArray(parsed.what_doesnt_work)) {
      parsed.what_doesnt_work = [String(parsed.what_doesnt_work)];
    }
    if (parsed.quick_fixes && !Array.isArray(parsed.quick_fixes)) {
      parsed.quick_fixes = [String(parsed.quick_fixes)];
    }
    // Phase 6: Ensure micro_recommendations is array
    if (parsed.micro_recommendations && !Array.isArray(parsed.micro_recommendations)) {
      parsed.micro_recommendations = [String(parsed.micro_recommendations)];
    }
    
    console.log("✅ Phase 4+6: JSON recovery successful");
    return parsed;
  } catch (e) {
    console.error("❌ Phase 4: JSON recovery failed:", e);
    return null;
  }
}

/**
 * Phase 4: Fallback Result Generator
 * Phase 6: Enhanced with micro_recommendations
 * 
 * Generates a minimal valid result when all parsing attempts fail.
 * Ensures Style Check never crashes on malformed AI output.
 * Uses supportive tone and safe defaults.
 */
function generateFallbackResult(style?: string, missingFeatures: string[] = []): any {
  console.log("⚠️ Phase 4+6: Using fallback result due to parse failure");
  return {
    outfit_name: style ? `${style} Casual Style` : "Clean Casual Style",
    what_works: [
      "The outfit has good foundational elements",
      "Color coordination shows thoughtful planning",
    ],
    what_doesnt_work:
      missingFeatures.length > 0
        ? [`Limited visibility: ${missingFeatures.join(", ")}`]
        : ["Small refinements could elevate the overall look"],
    quick_fixes: [
      "Consider adjusting proportions for better balance",
      "Add intentional accessories to complete the look",
    ],
    micro_recommendations: [
      "Try a half-tuck for defined proportions",
      "Roll sleeves for sharper silhouette detail",
    ],
    editorial: "A solid foundation with room to refine proportions and styling details for extra polish.",
  };
}

/**
 * Helper: isMeaningful
 * Filters out placeholder/unknown values from metadata
 * Used by buildMetadataContext to include only valid extracted data
 */
function isMeaningful(val: any): boolean {
  if (!val || val === null || val === undefined) return false;
  const str = String(val).toLowerCase().trim();
  return !["n/a", "unknown", "none", "not applicable", ""].includes(str);
}

/**
 * Helper: buildMetadataContext
 * 
 * Constructs formatted string of extracted metadata for SCORE_OUTFIT prompt.
 * 
 * Phase 1 Enhancement: Now includes transient user profile (when person is visible)
 * Phase 6 Enhancement: Now includes wardrobe summary for micro-recommendations
 * 
 * Input: Validated VisualSchema data from API Call #2, optional wardrobe items
 * 
 * Process:
 * 1. Filters meaningful values using isMeaningful helper
 * 2. Formats into sections: USER PROFILE (new), FIT, FABRIC, COLOR, STYLING, AESTHETIC, SCORES
 * 3. Adds low-confidence warnings for unreliable detections
 * 4. Phase 6: Adds wardrobe summary by category for micro-recommendations
 * 5. Returns formatted markdown string
 * 
 * Output Example:
 * ```
 * **EXTRACTED OUTFIT METADATA:**
 * 
 * 👤 **WEARER CONTEXT:** rectangle body shape, medium build, wheatish skin tone, 20s, feminine presentation
 *    (Inferred from image; used only to judge outfit, not the person)
 * 
 * 📏 **FIT:** boxy silhouette, mid-hip hemline, forearm sleeves
 * 🧵 **FABRIC:** cotton, mid weight, matte texture
 * 🎨 **COLOR:** monochrome harmony, low contrast
 * ✨ **STYLING:** partial tuck, 1 layer(s)
 * 
 * 👕 **WARDROBE_CONTEXT:** tops: [white tee, black shirt]; bottoms: [blue denim]; footwear: [white sneakers]
 * 
 * 📊 **INITIAL AI SCORES:**
 *    - Fit: 4.2/5.0 (85% confidence) — Well-balanced proportions
 *    - Color: 4.5/5.0 (90% confidence) — Strong monochrome palette
 * 
 * **USE THIS DATA:** Reference specific parameters in your analysis...
 * ```
 * 
 * This context is passed to SCORE_OUTFIT (API Call #3) to generate
 * data-driven feedback that references specific detected parameters.
 */
function buildMetadataContext(metadata: any, wardrobeItems?: any[]): string {
  const parts: string[] = ["**EXTRACTED OUTFIT METADATA:**\n"];

  // Phase 1 Addition + Phase 4 Guardrails: User Profile (transient, in-memory only)
  // Include this section ONLY if person is visible and profile data exists
  // Phase 4: Enhanced confidence threshold and safety checks
  if (metadata.user_profile) {
    const profile = metadata.user_profile;
    const profileDetails: string[] = [];
    const CONFIDENCE_THRESHOLD = 0.40; // Phase 4: Increased from 0.35 to 0.40 for safety
    
    // Phase 4 Guardrail: Only include fields that are meaningful AND above confidence threshold
    if (isMeaningful(profile.body_shape?.value) && profile.body_shape.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.body_shape.value} body shape`);
    }
    if (isMeaningful(profile.build?.value) && profile.build.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.build.value} build`);
    }
    if (isMeaningful(profile.skin_tone_band?.value) && profile.skin_tone_band.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.skin_tone_band.value} skin tone`);
    }
    if (isMeaningful(profile.height_band?.value) && profile.height_band.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.height_band.value} height`);
    }
    if (isMeaningful(profile.perceived_age_band?.value) && profile.perceived_age_band.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.perceived_age_band.value}`);
    }
    if (isMeaningful(profile.gender_expression?.value) && profile.gender_expression.confidence >= CONFIDENCE_THRESHOLD) {
      profileDetails.push(`${profile.gender_expression.value} presentation`);
    }
    
  // Phase 4 Guardrail: Only add profile section if we have actual meaningful data
  if (profileDetails.length > 0) {
    parts.push(`👤 **WEARER CONTEXT:** ${profileDetails.join(", ")}`);
    // Phase 4: Enhanced safety prefix explaining inferred data context
    parts.push(`   ⚠️ NOTE: These are extracted features from the current image, not stored user data. Used only to judge outfit fit/color, not the person.\n`);
  }
}

// Phase 5: Stateless Outfit Fingerprinting (Consistency Memory Layer)
// Compute a style fingerprint from extracted metadata for consistent evaluation
// This fingerprint is NOT stored - purely for single-request consistency
const fingerprintParts: string[] = [];
if (isMeaningful(metadata.fit?.silhouette?.value)) {
  fingerprintParts.push(`silhouette=${metadata.fit.silhouette.value}`);
}
if (isMeaningful(metadata.fit?.fit_type?.value)) {
  fingerprintParts.push(`fit=${metadata.fit.fit_type.value}`);
}
if (isMeaningful(metadata.color?.primary_top_color?.value)) {
  fingerprintParts.push(`top_color=${metadata.color.primary_top_color.value}`);
}
if (isMeaningful(metadata.color?.primary_bottom_color?.value)) {
  fingerprintParts.push(`bottom_color=${metadata.color.primary_bottom_color.value}`);
}
if (isMeaningful(metadata.styling?.footwear_type?.value)) {
  fingerprintParts.push(`footwear=${metadata.styling.footwear_type.value}`);
}
if (isMeaningful(metadata.styling?.layering_pieces?.value)) {
  fingerprintParts.push(`layers=${metadata.styling.layering_pieces.value}`);
}
if (isMeaningful(metadata.fabric?.pattern_type?.value) && metadata.fabric.pattern_type.value !== "solid") {
  fingerprintParts.push(`pattern=${metadata.fabric.pattern_type.value}`);
}

if (fingerprintParts.length > 0) {
  parts.push(`\n🔖 **STYLE FINGERPRINT:** ${fingerprintParts.join("; ")}`);
  parts.push(`   (Use this fingerprint to ensure consistent evaluations. Similar fingerprints should receive similar scoring characteristics.)\n`);
}

  // Fit parameters
  if (metadata.fit) {
    const fit = metadata.fit;
    const fitDetails: string[] = [];
    if (isMeaningful(fit.silhouette?.value)) fitDetails.push(`${fit.silhouette.value} silhouette`);
    if (isMeaningful(fit.hemline?.value)) fitDetails.push(`${fit.hemline.value} hemline`);
    if (isMeaningful(fit.sleeve_length?.value)) fitDetails.push(`${fit.sleeve_length.value} sleeves`);
    if (isMeaningful(fit.shoulder_structure?.value)) fitDetails.push(`${fit.shoulder_structure.value} shoulders`);
    if (isMeaningful(fit.pant_stacking?.value)) fitDetails.push(`${fit.pant_stacking.value} pant stacking`);
    if (fitDetails.length > 0) parts.push(`📏 **FIT:** ${fitDetails.join(", ")}`);
  }

  // Fabric details
  if (metadata.fabric) {
    const fabric = metadata.fabric;
    const fabricDetails: string[] = [];
    if (isMeaningful(fabric.material?.value)) fabricDetails.push(fabric.material.value);
    if (isMeaningful(fabric.texture?.value)) fabricDetails.push(`${fabric.texture.value} texture`);
    if (isMeaningful(fabric.finish?.value)) fabricDetails.push(`${fabric.finish.value} finish`);
    if (isMeaningful(fabric.weight?.value)) fabricDetails.push(`${fabric.weight.value} weight`);
    if (fabricDetails.length > 0) parts.push(`🧵 **FABRIC:** ${fabricDetails.join(", ")}`);
  }

  // Color harmony
  if (metadata.color) {
    const color = metadata.color;
    const colorDetails: string[] = [];
    if (isMeaningful(color.harmony?.value)) colorDetails.push(`${color.harmony.value} harmony`);
    if (isMeaningful(color.contrast?.value)) colorDetails.push(`${color.contrast.value} contrast`);
    if (colorDetails.length > 0) parts.push(`🎨 **COLOR:** ${colorDetails.join(", ")}`);
  }

  // Styling details
  if (metadata.styling) {
    const styling = metadata.styling;
    const details: string[] = [];
    if (isMeaningful(styling.tuck_status?.value)) details.push(`${styling.tuck_status.value} tuck`);
    if (isMeaningful(styling.sleeve_treatment?.value)) details.push(`${styling.sleeve_treatment.value} sleeves`);
    if (isMeaningful(styling.layering_pieces?.value)) details.push(`${styling.layering_pieces.value} layer(s)`);
    if (details.length > 0) parts.push(`✨ **STYLING:** ${details.join(", ")}`);
  }

  // Aesthetics
  if (metadata.aesthetics) {
    const aes = metadata.aesthetics;
    const aesDetails: string[] = [];
    if (isMeaningful(aes.cultural_aesthetic?.value)) aesDetails.push(aes.cultural_aesthetic.value);
    if (isMeaningful(aes.price_tier?.value)) aesDetails.push(`${aes.price_tier.value} tier`);
    if (isMeaningful(aes.polish_level?.value)) aesDetails.push(`polish level ${aes.polish_level.value}/5`);
    if (aesDetails.length > 0) parts.push(`🌟 **AESTHETIC:** ${aesDetails.join(", ")}`);
  }

  // AI Scores from extraction (only show if values exist)
  if (metadata.scores) {
    const scores = metadata.scores;
    const scoreLines: string[] = [];
    if (scores.fit?.value != null)
      scoreLines.push(
        `   - Fit: ${scores.fit.value.toFixed(1)}/5.0 (${scores.fit.confidence?.toFixed(0) || 0}% confidence)${scores.fit.reason ? " — " + scores.fit.reason : ""}`,
      );
    if (scores.color?.value != null)
      scoreLines.push(
        `   - Color: ${scores.color.value.toFixed(1)}/5.0 (${scores.color.confidence?.toFixed(0) || 0}% confidence)${scores.color.reason ? " — " + scores.color.reason : ""}`,
      );
    if (scores.styling?.value != null)
      scoreLines.push(
        `   - Styling: ${scores.styling.value.toFixed(1)}/5.0 (${scores.styling.confidence?.toFixed(0) || 0}% confidence)${scores.styling.reason ? " — " + scores.styling.reason : ""}`,
      );
    if (scores.material?.value != null)
      scoreLines.push(
        `   - Material: ${scores.material.value.toFixed(1)}/5.0 (${scores.material.confidence?.toFixed(0) || 0}% confidence)${scores.material.reason ? " — " + scores.material.reason : ""}`,
      );
    if (scoreLines.length > 0) {
      parts.push(`\n📊 **INITIAL AI SCORES:**`);
      parts.push(...scoreLines);
    }
  }

  // Low confidence warnings (only for meaningful fields with low confidence)
  const lowConfidenceFields: string[] = [];
  if (isMeaningful(metadata.fit?.silhouette?.value) && metadata.fit?.silhouette?.confidence < 0.5)
    lowConfidenceFields.push("silhouette");
  if (isMeaningful(metadata.color?.harmony?.value) && metadata.color?.harmony?.confidence < 0.5)
    lowConfidenceFields.push("color harmony");
  if (isMeaningful(metadata.aesthetics?.polish_level?.value) && metadata.aesthetics?.polish_level?.confidence < 0.5)
    lowConfidenceFields.push("polish level");
  if (lowConfidenceFields.length > 0) {
    parts.push(`\n⚠️ **LOW CONFIDENCE AREAS:** ${lowConfidenceFields.join(", ")} — may need better image visibility`);
  }

  parts.push(
    `\n**USE THIS DATA:** Reference specific parameters (e.g., "oversized silhouette," "monochrome harmony," "partial tuck") in your analysis to make feedback data-driven and precise.\n`,
  );

  // Phase 6: Wardrobe-first but not wardrobe-limited micro-recommendations
  // Add wardrobe summary for intelligent suggestions without forcing wardrobe-only logic
  if (wardrobeItems && Array.isArray(wardrobeItems) && wardrobeItems.length > 0) {
    const wardrobeByCategory: Record<string, string[]> = {};
    
    // Group items by category
    for (const item of wardrobeItems) {
      if (item.category && item.name) {
        const category = item.category.toLowerCase();
        if (!wardrobeByCategory[category]) {
          wardrobeByCategory[category] = [];
        }
        wardrobeByCategory[category].push(item.name);
      }
    }
    
    // Build concise wardrobe summary
    const wardrobeSummary: string[] = [];
    if (wardrobeByCategory.tops) {
      wardrobeSummary.push(`tops: [${wardrobeByCategory.tops.slice(0, 5).join(", ")}]`);
    }
    if (wardrobeByCategory.bottoms) {
      wardrobeSummary.push(`bottoms: [${wardrobeByCategory.bottoms.slice(0, 5).join(", ")}]`);
    }
    if (wardrobeByCategory.shoes) {
      wardrobeSummary.push(`footwear: [${wardrobeByCategory.shoes.slice(0, 5).join(", ")}]`);
    }
    if (wardrobeByCategory.outerwear) {
      wardrobeSummary.push(`outerwear: [${wardrobeByCategory.outerwear.slice(0, 3).join(", ")}]`);
    }
    if (wardrobeByCategory.accessories) {
      wardrobeSummary.push(`accessories: [${wardrobeByCategory.accessories.slice(0, 3).join(", ")}]`);
    }
    
    if (wardrobeSummary.length > 0) {
      parts.push(`\n👕 **WARDROBE_CONTEXT:** ${wardrobeSummary.join("; ")}`);
      parts.push(`   (Use wardrobe items when meaningful, but also suggest universal styling tweaks)`);
    }
  } else {
    // No wardrobe available
    parts.push(`\n👕 **WARDROBE_CONTEXT:** none_available`);
    parts.push(`   (Focus on universal styling actions: tucking, rolling, cuffing, proportion adjustments)`);
  }

  // Phase 5: Consistency Memory Layer Added
  // Stateless fingerprinting + enhanced metadataContext for consistent evaluations
  // Phase 6: Wardrobe-first but not wardrobe-limited micro-recommendations added
  // No shopping, no festivals, no DB changes
  return parts.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    console.error("Auth failed:", authError);
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { imageData, occasion, style, vibe, wardrobeItems } = await req.json();

    // Phase 6: Accept optional wardrobe items for micro-recommendations
    // wardrobeItems format: array of {id, name, category, ...} or undefined

    // Validate input
    if (!imageData || typeof imageData !== "string") {
      return new Response(
        JSON.stringify({ error: "imageData is required and must be a base64 data URL or http(s) URL" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const isDataUrl = imageData.startsWith("data:image/");
    const isHttpUrl = imageData.startsWith("http://") || imageData.startsWith("https://");
    if (!isDataUrl && !isHttpUrl) {
      return new Response(
        JSON.stringify({ error: "Invalid imageData format. Provide data:image/* base64 or a public URL." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (isDataUrl && imageData.length > 15_000_000) {
      return new Response(JSON.stringify({ error: "Image too large. Please upload a smaller image (<10MB)." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Scoring outfit with enhanced fashion analysis...");

    // Caching Layer
    // Check if identical request was made within last hour
    // Cache key is SHA-256 hash of input parameters
    const cacheKey = await generateCacheKey({ type: "outfit_score_v4", imageData, occasion, style, vibe });
    const cachedScore = await getCachedResult(cacheKey);
    if (cachedScore) {
      console.log("Returning cached outfit score");
      return new Response(JSON.stringify(cachedScore), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * API Call #2: Visual Metadata Extraction
     * 
     * Uses EXTRACTION_PROMPT to get structured outfit data:
     * - Fit: silhouette, hemline, sleeve_length, shoulder_structure, etc.
     * - Fabric: material, texture, finish, weight
     * - Color: harmony, contrast, top_color, bottom_color
     * - Styling: footwear_type, accessory_presence, layering, polish_level
     * - Aesthetics: cultural_aesthetic, brand_guess, price_tier
     * - Scores: fit, color, styling, material, overall (with confidence & reason)
     * 
     * Response validated against VisualSchema (Zod) for type safety
     */
    let extractionData;
    try {
      console.log("Step 1: Extracting visual metadata and AI scores...");
      const contextPrompt = EXTRACTION_PROMPT(occasion, style, vibe);

      extractionData = await retryWithBackoff(() =>
        callGeminiAPI({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: contextPrompt,
                },
                {
                  type: "image_url",
                  image_url: { url: imageData },
                },
              ],
            },
          ],
          temperature: 0,
        }),
      );
    } catch (error: any) {
      if (error.message === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({
            error: "Rate limits exceeded. Our AI is experiencing high demand. Please try again in a few moments.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (error.message === "PAYMENT_REQUIRED") {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    // Parse extraction response
    // AI returns JSON, possibly wrapped in ```json markdown blocks
    const extractionContent = extractionData.choices?.[0]?.message?.content;
    if (!extractionContent) {
      throw new Error("Failed to extract visual metadata");
    }

    // DEBUG LOG: Raw AI response for troubleshooting
    console.log("Raw AI extraction response:", extractionContent);

    let metadata;
    try {
      const cleaned = extractionContent.trim().replace(/^```json\n?|```$/g, "");
      metadata = JSON.parse(cleaned);
      console.log(
        "Parsed metadata sample:",
        JSON.stringify({
          fit_sleeve: metadata?.fit?.sleeve_length,
          color_top: metadata?.color?.top_color,
        }),
      );
    } catch (e) {
      console.error("Failed to parse extraction JSON:", e);
      console.error("Raw content:", extractionContent);
      throw new Error("Invalid extraction response format");
    }

    /**
     * Zod Validation
     * 
     * Validates extracted metadata against VisualSchema to ensure:
     * - All required fields are present
     * - Field values match expected enums/types
     * - Confidence scores are 0-1
     * - Each field has {value, confidence, reason?} structure
     * 
     * If validation fails, the error is logged and thrown.
     * This ensures downstream code receives type-safe, structured data.
     */
    console.log("Step 2: Validating metadata...");
    const validationResult = VisualSchema.safeParse(metadata);
    if (!validationResult.success) {
      console.error("Schema validation failed:", validationResult.error);
      throw new Error("Extracted metadata does not match expected schema");
    }

    const validatedMetadata = validationResult.data;

    // Build metadata context string for API Call #3
    // This converts structured data into formatted markdown string
    // that SCORE_OUTFIT prompt can reference for data-driven feedback
    // Phase 6: Enhanced with wardrobe summary for micro-recommendations
    const metadataContext = buildMetadataContext(validatedMetadata, wardrobeItems);
    console.log("Built metadata context:", metadataContext.substring(0, 200) + "...");

    /**
     * Score Combination
     * 
     * Uses AI-generated scores directly from EXTRACTION_PROMPT (API Call #2).
     * No deterministic computation - scores are purely from AI analysis.
     * 
     * Components:
     * - overall_score: Rounded to nearest 0.25 for UI display
     * - components: Individual scores (fit, color, styling, material)
     * - confidence: Minimum confidence across all components
     * - missing_features: Array of features AI couldn't detect
     * - reasoning: AI's explanation for each score
     */
    console.log("Step 2: Using AI-generated scores...");
    const aiScores = validatedMetadata.scores;
    const scoreResults = {
      overall_score: Number(aiScores.overall.value.toFixed(1)), // 1-decimal precision
      components: {
        fit: Number(aiScores.fit.value.toFixed(1)),
        color: Number(aiScores.color.value.toFixed(1)),
        styling: Number(aiScores.styling.value.toFixed(1)),
        material: Number(aiScores.material.value.toFixed(1)),
      },
      confidence: Math.min(
        aiScores.fit.confidence,
        aiScores.color.confidence,
        aiScores.styling.confidence,
        aiScores.material.confidence,
      ),
      missing_features: validatedMetadata.missing_features,
      reasoning: {
        fit: aiScores.fit.reason || "",
        color: aiScores.color.reason || "",
        styling: aiScores.styling.reason || "",
        material: aiScores.material.reason || "",
        overall: aiScores.overall.reason || "",
      },
    };

    /**
     * API Call #3: Dynamic Feedback Generation
     * 
     * Uses SCORE_OUTFIT prompt with metadataContext to generate:
     * - outfit_name: Creative name for the outfit
     * - what_works: Array of positive feedback points
     * - what_doesnt_work: Array of areas for improvement
     * - quick_fixes: Array of actionable styling tips
     * - editorial: Quote/summary for sharing
     * 
     * The metadataContext ensures feedback references specific detected
     * parameters (e.g., "oversized silhouette", "monochrome harmony")
     * rather than generic observations.
     * 
     * Error handling: If this call fails, defaults are used (no critical failure)
     */
    console.log("Step 3: Generating outfit analysis with SCORE_OUTFIT and metadata...");
    let scoreOutfitData;
    try {
      const scorePrompt = SCORING_PROMPTS.SCORE_OUTFIT(occasion, style, vibe, metadataContext);
      scoreOutfitData = await retryWithBackoff(() =>
        callGeminiAPI({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: scorePrompt,
                },
                {
                  type: "image_url",
                  image_url: { url: imageData },
                },
              ],
            },
          ],
          temperature: 0,
        }),
      );
    } catch (error: any) {
      console.error("SCORE_OUTFIT generation failed, will use defaults:", error);
      scoreOutfitData = null;
    }

    // DEBUG LOG: Raw SCORE_OUTFIT response for debugging (Phase 4 enhanced)
    // Safe to parse: contains outfit_name, what_works, what_doesnt_work, quick_fixes, editorial
    // Phase 4: Never logs sensitive image data, only text responses
    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      console.log("📋 Phase 4: Raw SCORE_OUTFIT response (first 200 chars):", content?.substring(0, 200));
    }

    /**
     * Phase 4: Enhanced SCORE_OUTFIT Response Parsing with Auto-Recovery
     * Phase 6: Now includes micro_recommendations parsing
     * 
     * Multi-stage parsing strategy:
     * 1. Primary Parse: Direct JSON parsing with basic cleanup
     * 2. Recovery Pass: Use recoverJSON helper for malformed responses
     * 3. Fallback Mode: Use generateFallbackResult if all parsing fails
     * 
     * Ensures Style Check NEVER crashes on AI output issues.
     * 
     * Expected JSON structure:
     * {
     *   outfit_name: string (2-4 words, stylish),
     *   what_works: string[] (min 3, max 15 words each),
     *   what_doesnt_work: string[] (2-3 items, max 15 words each),
     *   quick_fixes: string[] (min 3, max 12-15 words each),
     *   micro_recommendations: string[] (3-6 items, 7-14 words each) [Phase 6],
     *   editorial: string (25-45 words)
     * }
     */
    
    // Phase 4 Guardrail: Safe defaults (supportive tone)
    // Phase 6: Added micro_recommendations default
    let outfitName = `${style || "Contemporary"} Ensemble`;
    let whatWorks = ["Good foundation with thoughtful elements"];
    let whatDidntWork =
      scoreResults.missing_features.length > 0
        ? [`Limited visibility: ${scoreResults.missing_features.join(", ")}`]
        : ["Minor refinements possible"];
    let quickFix = [
      "Adjust proportions for better balance",
      "Consider accessory additions to complete the look",
      "Review color harmony for cohesiveness",
    ];
    let microRecommendations = [
      "Try a half-tuck for cleaner proportions",
      "Roll sleeves slightly for intentional detail",
    ];
    let editorial = "A refined outfit with careful attention to fit and proportion, showing good style awareness.";

    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      if (content) {
        let parsed = null;
        
        // Phase 4: Primary parse attempt
        try {
          const cleaned = content.trim().replace(/^```json\n?|```$/g, "");
          parsed = JSON.parse(cleaned);
          console.log("✅ Phase 4: Primary JSON parse successful");
        } catch (primaryError) {
          console.log("⚠️ Phase 4: Primary parse failed, attempting recovery...");
          
          // Phase 4: Recovery pass
          parsed = recoverJSON(content);
          
          if (!parsed) {
            console.log("❌ Phase 4: Recovery failed, using fallback mode");
            // Phase 4: Fallback mode
            const fallback = generateFallbackResult(style, scoreResults.missing_features);
            outfitName = fallback.outfit_name;
            whatWorks = fallback.what_works;
            whatDidntWork = fallback.what_doesnt_work;
            quickFix = fallback.quick_fixes;
            editorial = fallback.editorial;
          }
        }
        
        // Phase 4: Extract fields from successfully parsed result
        // Phase 6: Added micro_recommendations extraction
        if (parsed) {
          if (parsed.outfit_name && typeof parsed.outfit_name === "string") {
            outfitName = parsed.outfit_name;
          }
          if (Array.isArray(parsed.what_works) && parsed.what_works.length > 0) {
            whatWorks = parsed.what_works.filter((item: any) => typeof item === "string" && item.trim());
          }
          if (Array.isArray(parsed.what_doesnt_work) && parsed.what_doesnt_work.length > 0) {
            whatDidntWork = parsed.what_doesnt_work.filter((item: any) => typeof item === "string" && item.trim());
          }
          if (Array.isArray(parsed.quick_fixes) && parsed.quick_fixes.length > 0) {
            quickFix = parsed.quick_fixes.filter((item: any) => typeof item === "string" && item.trim());
          }
          // Phase 6: Parse micro_recommendations with fallback
          if (Array.isArray(parsed.micro_recommendations) && parsed.micro_recommendations.length > 0) {
            microRecommendations = parsed.micro_recommendations.filter((item: any) => typeof item === "string" && item.trim());
          }
          if (parsed.editorial && typeof parsed.editorial === "string") {
            editorial = parsed.editorial;
          } else if (whatWorks.length > 0) {
            // Phase 4 Guardrail: Generate editorial from what_works if missing
            editorial = whatWorks.slice(0, 2).join(". ") + ".";
          }
          
          console.log("✅ Phase 4+6: Final parsed output validated and sanitized");
        }
      }
    }

    /**
     * Final Result Combination
     * 
     * Merges scores from API Call #2 with feedback from API Call #3
     * into the final response format expected by StyleCheckHub.tsx
     * Phase 6: Now includes micro_recommendations
     */
    const finalResult = {
      overall_score: scoreResults.overall_score,
      components: scoreResults.components,
      confidence: scoreResults.confidence,
      editorial,
      missing_features: scoreResults.missing_features,
      // Dynamic fields from SCORE_OUTFIT
      outfit_name: outfitName,
      color_score: Number(scoreResults.components.color.toFixed(1)),
      fit_score: Number(scoreResults.components.fit.toFixed(1)),
      texture_score: Number(scoreResults.components.material.toFixed(1)),
      occasion_score: Number(scoreResults.overall_score.toFixed(1)),
      what_works: whatWorks,
      what_didnt_work: whatDidntWork,
      quick_fix: quickFix,
      // Phase 6: Micro-recommendations (wardrobe-first but not limited)
      micro_recommendations: microRecommendations,
    };

    // Cache the result for 1 hour
    // Future identical requests will return cached response instantly
    await setCachedResult(cacheKey, finalResult);

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in score-outfit:", error);
    const isAbort = (error as any)?.name === "AbortError" || (error as any)?.message?.includes("aborted");
    const status = isAbort ? 504 : 500;
    const msg = isAbort
      ? "AI service timeout. Please try again."
      : error instanceof Error
        ? error.message
        : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
