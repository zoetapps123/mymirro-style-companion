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
 * ⚠️ BACKWARD COMPATIBILITY:
 * - DB schema unchanged (style_checks table)
 * - API response shape unchanged (frontend expects same fields)
 * - user_profile is optional in VisualSchema (tolerates old cache entries)
 * - No new API calls added (still 3 calls total)
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
 *   vibe?: string         // e.g., "Polished"
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
 *   editorial: string,              // Editorial quote/summary
 *   confidence: number,             // Lowest component confidence
 *   missing_features: string[]      // Features AI couldn't detect (Phase 1: clearer format)
 * }
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
 * 
 * Input: Validated VisualSchema data from API Call #2
 * 
 * Process:
 * 1. Filters meaningful values using isMeaningful helper
 * 2. Formats into sections: USER PROFILE (new), FIT, FABRIC, COLOR, STYLING, AESTHETIC, SCORES
 * 3. Adds low-confidence warnings for unreliable detections
 * 4. Returns formatted markdown string
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
function buildMetadataContext(metadata: any): string {
  const parts: string[] = ["**EXTRACTED OUTFIT METADATA:**\n"];

  // Phase 1 Addition: User Profile (transient, in-memory only)
  // Include this section ONLY if person is visible and profile data exists
  if (metadata.user_profile) {
    const profile = metadata.user_profile;
    const profileDetails: string[] = [];
    const CONFIDENCE_THRESHOLD = 0.40; // Only include fields with reasonable confidence
    
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
    
    if (profileDetails.length > 0) {
      parts.push(`👤 **WEARER CONTEXT:** ${profileDetails.join(", ")}`);
      parts.push(`   (Inferred from image; used only to judge outfit fit/color, not the person)\n`);
    }
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
    const { imageData, occasion, style, vibe } = await req.json();

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
    const metadataContext = buildMetadataContext(validatedMetadata);
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
      overall_score: Math.round(aiScores.overall.value * 4) / 4, // Round to nearest 0.25
      components: {
        fit: aiScores.fit.value,
        color: aiScores.color.value,
        styling: aiScores.styling.value,
        material: aiScores.material.value,
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

    // DEBUG LOG: Raw SCORE_OUTFIT response for debugging
    // Safe to parse: contains outfit_name, what_works, what_doesnt_work, quick_fixes, editorial
    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      console.log("Raw SCORE_OUTFIT response:", content);
    }

    /**
     * Parse SCORE_OUTFIT Response
     * 
     * Extracts human-readable feedback from API Call #3.
     * Falls back to sensible defaults if parsing fails or fields are missing.
     * 
     * Expected JSON structure:
     * {
     *   outfit_name: string,
     *   what_works: string[],
     *   what_doesnt_work: string[],  // Note: can also be "what_didnt_work"
     *   quick_fixes: string[],        // Note: can also be "quick_fix"
     *   editorial: string
     * }
     */
    let outfitName = `${style || "Contemporary"} Ensemble`;
    let whatWorks = ["Good foundation"];
    let whatDidntWork =
      scoreResults.missing_features.length > 0
        ? [`Limited visibility: ${scoreResults.missing_features.join(", ")}`]
        : ["Minor refinements possible"];
    let quickFix = [
      "Adjust proportions for better balance",
      "Consider accessory additions",
      "Review color harmony",
      "Check hemline placement",
    ];
    let editorial = "A refined outfit with careful attention to fit and proportion.";

    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.trim().replace(/^```json\n?|```$/g, "");
          const parsed = JSON.parse(cleaned);

          if (parsed.outfit_name) outfitName = parsed.outfit_name;
          if (Array.isArray(parsed.what_works) && parsed.what_works.length > 0) {
            whatWorks = parsed.what_works;
          }
          if (Array.isArray(parsed.what_doesnt_work) && parsed.what_doesnt_work.length > 0) {
            whatDidntWork = parsed.what_doesnt_work;
          }
          if (Array.isArray(parsed.quick_fixes) && parsed.quick_fixes.length > 0) {
            quickFix = parsed.quick_fixes;
          }
          // Use first what_works item as editorial fallback if no editorial field
          if (parsed.editorial) {
            editorial = parsed.editorial;
          } else if (whatWorks.length > 0) {
            editorial = whatWorks.join(". ") + ".";
          }
        } catch (e) {
          console.error("Failed to parse SCORE_OUTFIT response, using defaults:", e);
        }
      }
    }

    /**
     * Final Result Combination
     * 
     * Merges scores from API Call #2 with feedback from API Call #3
     * into the final response format expected by StyleCheckHub.tsx
     */
    const finalResult = {
      overall_score: scoreResults.overall_score,
      components: scoreResults.components,
      confidence: scoreResults.confidence,
      editorial,
      missing_features: scoreResults.missing_features,
      // Dynamic fields from SCORE_OUTFIT
      outfit_name: outfitName,
      color_score: scoreResults.components.color,
      fit_score: scoreResults.components.fit,
      texture_score: scoreResults.components.material,
      occasion_score: scoreResults.overall_score,
      what_works: whatWorks,
      what_didnt_work: whatDidntWork,
      quick_fix: quickFix,
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
