import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-utils.ts";
import { generateCacheKey, getCachedResult, setCachedResult } from "../_shared/cache-utils.ts";
import { WARDROBE_PROMPTS } from "../_shared/prompts.ts";
import { callGeminiAPI } from "../_shared/ai-config.ts";
import { retryWithBackoff } from "../_shared/retry-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WardrobeDetectionItem {
  bbox: BoundingBox;
  
  // Core identity
  item_name: string;
  category: "Tops" | "Bottoms" | "Outerwear" | "Dresses" | "Shoes" | "Accessories";
  
  // Color & pattern (spatial, visually grounded)
  color_palette: string[];
  color_distribution: number[];
  primary_color_hex: string;
  primary_color_name: string;
  pattern_type: string;
  pattern_geometry: string;
  pattern_coverage: string;
  pattern_scale: string;
  color_blocking_layout: string;
  
  // Graphics
  graphic_type: string;
  graphic_location: string;
  graphic_size: string;
  
  // Shape & structure
  fit_type: string;
  silhouette: string;
  length: string;
  
  // Construction & details (category-specific optional)
  sleeve_type?: string;
  neckline?: string;
  collar_type?: string;
  closure_type?: string;
  hem_style?: string;
  pocket_details?: string;
  shoulder_style?: string;
  
  // Layering context
  layers_detected: "single_layer" | "double_layer" | "multi_layer";
  
  // Visual summary
  visual_summary: string;
}

// Legacy interface for compatibility during migration
type DetectedItem = WardrobeDetectionItem & {
  name?: string;
  primary_color?: string;
  fabric_primary?: string;
  // Semantic fields (will be added in Phase 2)
  style_aesthetic?: string[];
  formality_level?: string;
  suitable_occasions?: string[];
  season?: string[];
  weather_suitability?: string;
  brand?: string;
  condition?: string;
  fabric_weight?: string;
  material_finish?: string;
  texture?: string;
  secondary_colors?: string[];
  special_features?: string[];
  style_notes_detailed?: string;
  rise?: string;
  waist_style?: string;
  heel_type?: string;
  toe_style?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    console.error("Auth failed:", authError);
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing image with Gemini-only pipeline...");

    // Check cache (updated version for visual-semantic split)
    const cacheKey = await generateCacheKey({ type: "wardrobe_gemini_v5_visual_semantic", imageUrl });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log("Returning cached result");
      return new Response(JSON.stringify({ success: true, ...cachedResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OPTIMIZED: Single API call to validate AND detect items (with stronger retry/backoff + model fallback)
    console.log("Step 1: Validating and detecting items in one call...");

    let validationAndDetection: { isValid: boolean; reason?: string; items: WardrobeDetectionItem[] } | null = null;
    {
      let attempts = 0;
      const maxAttempts = 5;
      let model = "google/gemini-2.5-flash";
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      while (attempts < maxAttempts) {
        try {
          validationAndDetection = await validateAndDetectItems(imageUrl, model);
          break;
        } catch (err) {
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          const isRate = msg.includes("rate") || msg.includes("429") || msg.includes("resource exhausted");

          if (!isRate) throw err;

          attempts++;
          if (attempts >= maxAttempts) break;

          // Switch to a lighter model after a couple retries
          if (attempts === 2 && model !== "google/gemini-2.5-flash-lite") {
            model = "google/gemini-2.5-flash-lite";
            console.warn("Switching to lighter model for validation/detection due to rate limiting...");
          }

          // Exponential backoff with jitter
          const base = [2000, 4000, 8000, 12000][attempts - 1] || 15000;
          const jitter = Math.floor(Math.random() * 500);
          const wait = base + jitter;
          console.warn(`Rate limited on validation+detection, retrying in ${Math.round(wait / 1000)}s...`);
          await sleep(wait);
        }
      }
    }

    if (!validationAndDetection || !validationAndDetection.isValid) {
      console.log("Image validation failed:", validationAndDetection?.reason);
      return new Response(
        JSON.stringify({
          error: validationAndDetection?.reason || "Image does not contain suitable content for wardrobe extraction",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const detectedItems = validationAndDetection.items;

    if (!detectedItems || detectedItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No clothing items detected in the image",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`✅ Validated and detected ${detectedItems.length} items from image`);
    console.log("📊 Sample item metadata:", JSON.stringify(detectedItems[0], null, 2));

    // Step 1.5: Enhanced Smart Deduplication
    console.log("Step 1.5: Running enhanced smart deduplication...");
    const dedupeResult = await enhancedSmartDeduplication(detectedItems, user.id);

    if (dedupeResult.uniqueItems.length === 0) {
      console.log("⚠️ All items were duplicates:", dedupeResult.skipReasons);
      return new Response(
        JSON.stringify({
          error: "All detected items already exist in your wardrobe",
          items: [],
          duplicatesSkipped: dedupeResult.duplicatesSkipped,
          skipReasons: dedupeResult.skipReasons,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `✅ ${dedupeResult.uniqueItems.length} unique items to process (${dedupeResult.duplicatesSkipped} duplicates skipped)`,
    );
    console.log(`⏭️  ${dedupeResult.duplicatesSkipped} duplicates skipped`);

    const uniqueDetectedItems = dedupeResult.uniqueItems;

    // ========== PHASE 1.5: Generate Product Images ==========
    console.log("Phase 1.5: Generating product images for all unique items...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const itemsWithProcessedImages: Array<DetectedItem & { processedImageUrl: string }> = [];

    // Helper sleep
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < uniqueDetectedItems.length; i++) {
      const item = uniqueDetectedItems[i];
      console.log(`Generating image ${i + 1}/${uniqueDetectedItems.length}: ${item.item_name}`);

      let attempts = 0;
      const maxAttempts = 3; // 1 try + 2 retries

      while (attempts < maxAttempts) {
        try {
          // Generate product image
          const imageData = await generateProductImage(item);

          // Upload to Storage
          const fileName = `${user.id}/wardrobe_gen_${Date.now()}_${i}_${item.item_name.replace(/\s+/g, "-")}.png`;
          const { error: uploadError } = await supabase.storage.from("outfits").upload(fileName, imageData, {
            contentType: "image/png",
            upsert: false,
          });

          if (uploadError) {
            console.error(`Upload error for ${item.item_name}:`, uploadError);
            break; // don't retry on storage errors
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("outfits").getPublicUrl(fileName);

          console.log(`✅ Image generated for ${item.item_name}`);
          itemsWithProcessedImages.push({ ...item, processedImageUrl: publicUrl });
          break; // success
        } catch (err) {
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          const isRate = msg.includes("rate") || msg.includes("429") || msg.includes("resource exhausted");

          if (isRate && attempts < maxAttempts - 1) {
            const wait = (attempts + 1) * 3000; // 3s, 6s
            console.warn(`Rate limited while generating '${item.item_name}', retrying in ${wait / 1000}s...`);
            await sleep(wait);
            attempts++;
            continue;
          }

          console.error(`Failed to generate image for ${item.item_name}:`, err);
          break; // non-retryable or maxed out
        }
      }

      // Small pacing delay between items to reduce rate limiting
      if (i < uniqueDetectedItems.length - 1) {
        await sleep(2000);
      }
    }

    if (itemsWithProcessedImages.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate images for detected items", items: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Phase 1 complete: ${itemsWithProcessedImages.length} items with images`);

    // ========== PHASE 2: Enrich Metadata Only ==========
    console.log("Phase 2: Enriching metadata for all items...");

    const itemsWithImages: Array<DetectedItem & { imageUrl: string }> = [];

    for (let i = 0; i < itemsWithProcessedImages.length; i++) {
      const item = itemsWithProcessedImages[i];
      console.log(`Enriching item ${i + 1}/${itemsWithProcessedImages.length}: ${item.name}`);

      let enrichedItem = { ...item };

      try {
        const { data: enrichmentData, error: enrichmentError } = await supabase.functions.invoke(
          "enrich-wardrobe-item",
          {
            body: {
              originalImageUrl: imageUrl, // CRITICAL: Use original uploaded image, not generated
              category: item.category,
              visualMetadata: {
                item_name: item.item_name,
                bbox: item.bbox,
                primary_color_hex: item.primary_color_hex,
                primary_color_name: item.primary_color_name,
                color_palette: item.color_palette,
                color_distribution: item.color_distribution,
                pattern_type: item.pattern_type,
                pattern_geometry: item.pattern_geometry,
                pattern_coverage: item.pattern_coverage,
                fit_type: item.fit_type,
                silhouette: item.silhouette,
                length: item.length,
                neckline: item.neckline,
                sleeve_type: item.sleeve_type,
                closure_type: item.closure_type,
                visual_summary: item.visual_summary,
              },
            },
          },
        );

        if (enrichmentError) {
          console.error(`Enrichment error for ${item.name} (non-fatal):`, enrichmentError);
        } else if (enrichmentData?.detailedMetadata) {
          console.log(`✅ Enriched ${item.name}: merged ${Object.keys(enrichmentData.detailedMetadata).length} fields`);
          enrichedItem = { ...item, ...enrichmentData.detailedMetadata };
        }
      } catch (enrichErr) {
        console.error(`Enrichment exception for ${item.name} (non-fatal):`, enrichErr);
      }

      // Use the processed image URL from Phase 1 for final storage
      // Map WardrobeDetectionItem + Phase 2 semantic to DetectedItem format for DB
      itemsWithImages.push({
        ...enrichedItem,
        name: item.item_name, // Legacy field
        imageUrl: item.processedImageUrl,
      });

      // Small delay between enrichment calls
      if (i < itemsWithProcessedImages.length - 1) {
        await sleep(1000);
      }
    }

    console.log(`✅ Phase 2 complete: ${itemsWithImages.length} fully enriched items`);

    // Normalize categories using the same logic as the database trigger (as fallback)
    const normalizeCategory = (category: string): string => {
      if (!category) return category;

      const lowerCat = category.toLowerCase();

      // Footwear → Shoes
      if (["footwear", "foot wear", "foot-wear"].includes(lowerCat)) return "Shoes";

      // Various top variations → Tops
      if (
        ["upper wear", "upperwear", "upper-wear", "top", "shirt", "tshirt", "t-shirt", "blouse", "tee"].includes(
          lowerCat,
        )
      )
        return "Tops";

      // Various bottom variations → Bottoms
      if (
        [
          "lower wear",
          "lowerwear",
          "lower-wear",
          "bottom",
          "pants",
          "trouser",
          "trousers",
          "jean",
          "chinos",
          "shorts",
        ].includes(lowerCat)
      )
        return "Bottoms";

      // Various outer wear variations → Outerwear
      if (
        ["outer wear", "outerwear", "outer-wear", "jacket", "coat", "blazer", "cardigan", "sweater", "hoodie"].includes(
          lowerCat,
        )
      )
        return "Outerwear";

      // Accessories variations → Accessories
      if (["accessory", "accessorie"].includes(lowerCat)) return "Accessories";

      // Dresses variations → Dresses
      if (["dress", "gown"].includes(lowerCat)) return "Dresses";

      // Keep as-is if already standard or unknown
      return category;
    };

    const normalizedItems = itemsWithImages.map((item) => ({
      ...item,
      category: normalizeCategory(item.category),
    }));

    const result = { items: normalizedItems };

    // Cache result
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(setCachedResult(cacheKey, result));
    } else {
      await setCachedResult(cacheKey, result);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in process-wardrobe:", error);

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    const errorLower = errorMessage.toLowerCase();

    // Check for rate limiting
    const isRateLimit =
      errorLower.includes("rate") ||
      errorLower.includes("429") ||
      errorMessage.includes("RATE_LIMIT") ||
      errorLower.includes("resource exhausted");

    // Check for credit/payment issues
    const isCredits = errorLower.includes("credits") || errorLower.includes("402") || errorLower.includes("billing");

    // User-friendly error messages
    let userMessage = errorMessage;
    if (isRateLimit) {
      userMessage = "The AI service is temporarily busy. Please wait a moment and try again.";
    } else if (isCredits) {
      userMessage = "AI service credits depleted. Please contact support.";
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
        code: isRateLimit ? "RATE_LIMIT" : isCredits ? "NO_CREDITS" : "INTERNAL_ERROR",
        retryable: isRateLimit,
      }),
      {
        status: isRateLimit ? 429 : isCredits ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * OPTIMIZED: Single API call that validates AND detects items
 * Reduces API calls from 2→1 per image
 */
async function validateAndDetectItems(
  imageUrl: string,
  model: string = "google/gemini-2.5-flash",
): Promise<{
  isValid: boolean;
  reason?: string;
  items: WardrobeDetectionItem[];
}> {
  console.log("PHASE 1: Starting visual detection with model:", model);

  const VISUAL_DETECTION_PROMPT = `You are a precise visual clothing analyzer. Analyze this image in TWO STEPS within a single response.

═══════════════════════════════════════════════════════════════════════
STEP 1A: DETECTION & BOUNDING BOXES
═══════════════════════════════════════════════════════════════════════

First, determine if the image is VALID for wardrobe extraction:

✅ VALID:
- Humans wearing clothes (full body or partial)
- Standalone clothing items clearly visible
- Multiple clothing items in a flat-lay or hanging arrangement

❌ INVALID:
- Empty/blank images
- Non-clothing objects only
- Blurry/low-light/unidentifiable content
- Inappropriate content

If INVALID: Set isValid=false with reason and return empty items array.

If VALID: Detect up to 5 distinct clothing items. For each item:
- Determine a bounding box: {x, y, width, height} as percentages (0-100) of image dimensions
- x,y = top-left corner; width,height = size

═══════════════════════════════════════════════════════════════════════
STEP 1B: VISUAL METADATA PER ITEM (STRICTLY VISUAL)
═══════════════════════════════════════════════════════════════════════

For each detected item, analyze ONLY the pixels within its bounding box.
Extract ONLY visually grounded facts. DO NOT infer:
- Formality level
- Suitable occasions  
- Style aesthetics (streetwear, minimalist, etc.)
- Season/weather suitability
- Brand (unless visibly printed)
- Personality/vibe

If something is not clearly visible, use "unknown" or "none".

For each item, extract:

**IDENTITY:**
- item_name: Simple 3-5 word name (e.g., "Black Crew Neck T-Shirt", "Blue Slim Jeans")
- category: One of [Tops, Bottoms, Outerwear, Dresses, Shoes, Accessories]

**COLOR ANALYSIS (SPATIAL):**
- primary_color_hex: Dominant visible color as hex (#RRGGBB)
- primary_color_name: Human-readable name ("Black", "Navy Blue", "Cream")
- color_palette: Array of 2-4 hex codes for all visible colors, ordered by coverage
- color_distribution: Array of percentages matching color_palette (must sum to 100)
- color_blocking_layout: "none" | "sleeve_contrast" | "top_bottom_split" | "left_right_split" | "shoulder_yoke" | "panel_sides" | "hem_contrast"

**PATTERN ANALYSIS:**
- pattern_type: "solid" | "striped" | "checkered" | "plaid" | "floral" | "geometric" | "abstract" | "animal_print" | "polka_dot" | "graphic" | "camo" | "tie_dye"
- pattern_geometry: For stripes: "horizontal" | "vertical" | "diagonal". For florals: "ditsy" | "large_bloom" | "tropical". For graphics: "logo_center" | "all_over_print". Use "none" if solid.
- pattern_coverage: "all_over" | "chest_center" | "front_full" | "back_full" | "sleeves_only" | "hem_band" | "none"
- pattern_scale: "micro" | "small" | "medium" | "large" | "oversized" | "none"

**GRAPHICS (if present):**
- graphic_type: "none" | "logo" | "illustration" | "text_graphic" | "photo_print" | "brand_logo"
- graphic_location: "none" | "center_chest" | "left_chest" | "right_chest" | "front_full" | "back_full" | "sleeve_left" | "sleeve_right"
- graphic_size: "none" | "small" | "medium" | "large" | "oversized"

**SHAPE & STRUCTURE:**
- fit_type: "slim" | "regular" | "relaxed" | "oversized" | "tailored" | "skinny" | "loose"
- silhouette: "straight" | "tapered" | "boxy" | "a_line" | "fitted" | "flared" | "bodycon"
- length: 
  - Tops: "crop" | "waist" | "hip" | "below_hip" | "tunic"
  - Bottoms: "micro" | "short" | "knee" | "midi" | "ankle" | "floor"
  - Outerwear: "waist" | "hip" | "thigh" | "knee" | "ankle"
  - Dresses: "mini" | "knee" | "midi" | "maxi"

**CONSTRUCTION DETAILS:**
- sleeve_type: "sleeveless" | "cap" | "short" | "elbow" | "three_quarter" | "long" | "bell" | "bishop" | "puff" (for Tops/Outerwear/Dresses)
- neckline: "crew" | "v_neck" | "scoop" | "boat" | "square" | "off_shoulder" | "halter" | "turtleneck" | "mock_neck" | "collar" | "hooded"
- collar_type: "none" | "standard" | "mandarin" | "peter_pan" | "shawl" | "notched" | "spread" | "button_down"
- closure_type: "none" | "pullover" | "button_front" | "button_half" | "zipper_front" | "zipper_side" | "zipper_back" | "tie" | "snap" | "velcro" | "lace_up"
- hem_style: "straight" | "curved" | "ribbed" | "cuffed" | "raw" | "asymmetric" | "split"
- pocket_details: "none" | "side_seam" | "patch" | "welt" | "cargo" | "kangaroo" | "hidden"
- shoulder_style: "regular" | "drop_shoulder" | "raglan" | "puff" | "structured" | "cut_out"

**LAYERING:**
- layers_detected: "single_layer" | "double_layer" | "multi_layer"

**VISUAL SUMMARY:**
- visual_summary: A concise 15-25 word description of ONLY what is visible (e.g., "Oversized black cotton t-shirt with white screen-printed graphic on center chest, drop shoulders, crew neck, relaxed fit")

═══════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

Use the return_visual_detection function to return structured JSON.
Be precise. Only describe what you SEE. Unknown details = "unknown".
`;

  console.log("Calling Gemini API for Phase 1 visual detection...");

  // Visual-only schema for Phase 1
  const tools = [
    {
      type: "function",
      function: {
        name: "return_visual_detection",
        description: "Return validation result and detected items with VISUAL fields only",
        parameters: {
          type: "object",
          properties: {
            isValid: {
              type: "boolean",
              description: "Whether the image is suitable for wardrobe extraction",
            },
            reason: {
              type: "string",
              description: "Reason if image is rejected (only if isValid is false)",
            },
            items: {
              type: "array",
              description: "Array of detected clothing items with visual metadata",
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  bbox: {
                    type: "object",
                    description: "Bounding box coordinates",
                    properties: {
                      x: { type: "number", description: "X coordinate (0-100)" },
                      y: { type: "number", description: "Y coordinate (0-100)" },
                      width: { type: "number", description: "Width (0-100)" },
                      height: { type: "number", description: "Height (0-100)" },
                    },
                    required: ["x", "y", "width", "height"],
                  },
                  item_name: { type: "string", description: "Descriptive 3-5 word name" },
                  category: {
                    type: "string",
                    enum: ["Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories"],
                    description: "Item category",
                  },
                  color_palette: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of hex codes",
                  },
                  color_distribution: {
                    type: "array",
                    items: { type: "number" },
                    description: "Percentages matching palette",
                  },
                  primary_color_hex: { type: "string", description: "Primary color hex" },
                  primary_color_name: { type: "string", description: "Human-readable color" },
                  pattern_type: { type: "string", description: "Pattern type" },
                  pattern_geometry: { type: "string", description: "Pattern direction/layout" },
                  pattern_coverage: { type: "string", description: "Where pattern appears" },
                  pattern_scale: { type: "string", description: "Pattern scale" },
                  color_blocking_layout: { type: "string", description: "Color blocking style" },
                  graphic_type: { type: "string", description: "Graphic type if present" },
                  graphic_location: { type: "string", description: "Graphic location" },
                  graphic_size: { type: "string", description: "Graphic size" },
                  fit_type: { type: "string", description: "Fit style" },
                  silhouette: { type: "string", description: "Silhouette shape" },
                  length: { type: "string", description: "Length description" },
                  sleeve_type: { type: "string", description: "Sleeve type" },
                  neckline: { type: "string", description: "Neckline style" },
                  collar_type: { type: "string", description: "Collar style" },
                  closure_type: { type: "string", description: "Closure type" },
                  hem_style: { type: "string", description: "Hem style" },
                  pocket_details: { type: "string", description: "Pocket details" },
                  shoulder_style: { type: "string", description: "Shoulder construction" },
                  layers_detected: {
                    type: "string",
                    enum: ["single_layer", "double_layer", "multi_layer"],
                    description: "Layering context",
                  },
                  visual_summary: { type: "string", description: "Visual description 15-25 words" },
                },
                required: [
                  "bbox",
                  "item_name",
                  "category",
                  "color_palette",
                  "color_distribution",
                  "primary_color_hex",
                  "primary_color_name",
                  "pattern_type",
                  "pattern_geometry",
                  "pattern_coverage",
                  "pattern_scale",
                  "color_blocking_layout",
                  "graphic_type",
                  "graphic_location",
                  "graphic_size",
                  "fit_type",
                  "silhouette",
                  "length",
                  "layers_detected",
                  "visual_summary",
                ],
              },
            },
          },
          required: ["isValid", "items"],
        },
      },
    },
  ];

  const data = await callGeminiAPI({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISUAL_DETECTION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "return_visual_detection" } },
  });

  // If function call is returned, use it
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.type === "function" && toolCall.function?.name === "return_visual_detection") {
    try {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      console.log("Parsed via function call:", {
        isValid: args.isValid,
        itemCount: Array.isArray(args.items) ? args.items.length : 0,
      });
      console.log("Function call arguments sample:", JSON.stringify(args).substring(0, 500));

      // Validate that items have required visual fields
      const hasValidItems =
        Array.isArray(args.items) &&
        args.items.length > 0 &&
        args.items.every((item: any) => item.item_name && item.category && item.bbox);

      if (hasValidItems) {
        return {
          isValid: !!args.isValid,
          reason: args.reason,
          items: args.items,
        };
      } else {
        console.warn("Function call returned items without required fields, falling back to text parsing");
        // fall through to text parsing below
      }
    } catch (e: any) {
      console.error("Failed to parse function-call arguments:", e.message);
      // fall through to text parsing below
    }
  }

  const content = data.choices?.[0]?.message?.content || "";
  console.log("Gemini response length:", content.length);
  console.log("Gemini response preview (first 300 chars):", content.substring(0, 300));

  // Clean the response - remove markdown code blocks
  let cleanedContent = content.trim();

  // Remove markdown code fences from start and end
  if (cleanedContent.startsWith("```json")) {
    cleanedContent = cleanedContent.replace(/^```json\n?/, "");
  }
  if (cleanedContent.startsWith("```")) {
    cleanedContent = cleanedContent.replace(/^```\n?/, "");
  }
  if (cleanedContent.endsWith("```")) {
    cleanedContent = cleanedContent.replace(/```$/, "");
  }
  cleanedContent = cleanedContent.trim();

  console.log("After markdown removal (first 300 chars):", cleanedContent.substring(0, 300));

  // Extract JSON from response
  const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Failed to extract JSON from response. Full content:", content);
    throw new Error("Failed to extract validation+detection result from Gemini response");
  }

  let jsonString = jsonMatch[0];

  // Fix common JSON issues
  // 1. Remove trailing commas before closing brackets/braces
  jsonString = jsonString.replace(/,(\s*[\]}])/g, "$1");

  console.log("After JSON fixes (first 300 chars):", jsonString.substring(0, 300));

  // Parse JSON with error handling (with repair attempts)
  let result;
  try {
    result = JSON.parse(jsonString);
  } catch (firstErr: any) {
    console.error("First JSON parse failed:", firstErr.message);
    console.error("Failed JSON string (first 2000 chars):", jsonString.substring(0, 2000));

    // Attempt repairs
    let repaired = jsonString;
    // 1) Remove trailing commas before ] or }
    repaired = repaired.replace(/,(\s*[\]}])/g, "$1");
    // 2) Insert missing commas between objects: `}{` -> `},{`
    repaired = repaired.replace(/}\s*{/g, "},{");
    // 3) Collapse accidental double commas
    repaired = repaired.replace(/,\s*,/g, ",");
    // 4) Remove stray trailing commas at line ends
    repaired = repaired.replace(/,\s*\n\s*([\]}])/g, "\n$1");

    console.log("Applied JSON repair heuristics. Retrying parse...");

    try {
      result = JSON.parse(repaired);
      console.log("Second parse attempt succeeded.");
      jsonString = repaired; // keep repaired version for further logs if needed
    } catch (secondErr: any) {
      console.error("Second JSON parse failed:", secondErr.message);
      console.error("Repaired JSON (first 2000 chars):", repaired.substring(0, 2000));
      console.error("Repaired JSON length:", repaired.length);
      // Graceful fallback: mark as invalid instead of throwing 500
      result = { isValid: false, reason: "Malformed AI response (JSON parse failed after repair)", items: [] };
    }
  }

  console.log("Successfully parsed wardrobe detection:", {
    isValid: result.isValid,
    itemCount: result.items?.length || 0,
    firstItemName: result.items?.[0]?.item_name || "N/A",
    hasReason: !!result.reason,
  });

  // Validate response structure
  if (typeof result.isValid !== "boolean") {
    console.error("Invalid response structure - missing or invalid isValid field:", result);
    throw new Error('Response missing required "isValid" field');
  }

  if (result.isValid && !Array.isArray(result.items)) {
    console.error("Invalid response structure - items is not an array:", result);
    throw new Error('Response missing required "items" array for valid detection');
  }

  return {
    isValid: result.isValid,
    reason: result.reason,
    items: result.items || [],
  };
}

interface DuplicateCheckResult {
  uniqueItems: WardrobeDetectionItem[];
  duplicatesSkipped: number;
  skipReasons: string[];
}

async function enhancedSmartDeduplication(
  detectedItems: WardrobeDetectionItem[],
  userId: string,
): Promise<DuplicateCheckResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existingItems, error } = await supabase.from("wardrobe_items").select("*").eq("user_id", userId);

  if (error || !existingItems || existingItems.length === 0) {
    console.log("No existing items, all detected items are unique");
    return {
      uniqueItems: detectedItems,
      duplicatesSkipped: 0,
      skipReasons: [],
    };
  }

  const uniqueItems: WardrobeDetectionItem[] = [];
  const skipReasons: string[] = [];

  for (const newItem of detectedItems) {
    let isDuplicate = false;
    let skipReason = "";

    // LEVEL 1: Enhanced Visual Fingerprint Match (using new visual metadata)
    const bothExistAndMatch = (a: any, b: any) => {
      return a != null && a !== "" && a !== "none" && a !== "unknown" && 
             b != null && b !== "" && b !== "none" && b !== "unknown" && a === b;
    };

    const fingerprintMatch = existingItems.find((existing) => {
      const sameCategory = bothExistAndMatch(existing.category, newItem.category);
      if (!sameCategory) return false;

      const samePatternType = bothExistAndMatch(existing.pattern_type, newItem.pattern_type);
      const samePatternGeometry = bothExistAndMatch(existing.pattern_geometry, newItem.pattern_geometry);
      const samePatternCoverage = bothExistAndMatch(existing.pattern_coverage, newItem.pattern_coverage);
      const sameFit = bothExistAndMatch(existing.fit_type, newItem.fit_type);
      const sameSilhouette = bothExistAndMatch(existing.silhouette, newItem.silhouette);
      const sameLength = bothExistAndMatch(existing.length, newItem.length);
      const sameClosure = bothExistAndMatch(existing.closure_type, newItem.closure_type);
      const sameNeckline = bothExistAndMatch(existing.neckline, newItem.neckline);
      const sameColorBlocking = bothExistAndMatch(existing.color_blocking_layout, newItem.color_blocking_layout);
      const sameGraphicType = bothExistAndMatch(existing.graphic_type, newItem.graphic_type);

      const matchingFields = [
        samePatternType,
        samePatternGeometry,
        samePatternCoverage,
        sameFit,
        sameSilhouette,
        sameLength,
        sameClosure,
        sameNeckline,
        sameColorBlocking,
        sameGraphicType,
      ].filter(Boolean);

      const hasEnoughMatches = matchingFields.length >= 5; // 5+ visual attributes match

      if (hasEnoughMatches) {
        console.log(`🔍 Visual fingerprint match for "${newItem.item_name}":`, {
          existing: existing.name,
          matchingFieldsCount: matchingFields.length,
        });
      }

      return hasEnoughMatches;
    });

    if (fingerprintMatch) {
      isDuplicate = true;
      skipReason = `Visual fingerprint: "${newItem.item_name}" = "${fingerprintMatch.name}"`;
    }

    // LEVEL 2: Color Similarity + Pattern + Silhouette
    if (!isDuplicate) {
      const colorSimilarMatch = existingItems.find((existing) => {
        if (existing.category !== newItem.category) return false;

        const existingColor = existing.primary_color_hex || existing.primary_color || existing.color;
        const newColor = newItem.primary_color_hex;

        if (!existingColor || !newColor) return false;

        const distance = calculateColorDistance(existingColor, newColor);
        const colorMatch = distance < 30;

        // Require color + pattern + silhouette/fit match
        const patternMatch = existing.pattern_type && 
          newItem.pattern_type && 
          existing.pattern_type === newItem.pattern_type;
        const silhouetteMatch = existing.silhouette && 
          newItem.silhouette && 
          existing.silhouette === newItem.silhouette;
        const fitMatch = existing.fit_type && 
          newItem.fit_type && 
          existing.fit_type === newItem.fit_type;

        const extraMatches = [patternMatch, silhouetteMatch, fitMatch]
          .filter(Boolean).length;

        const isMatch = colorMatch && extraMatches >= 2;

        if (isMatch) {
          console.log(`🎨 Color+visual match for "${newItem.item_name}":`, {
            existing: existing.name,
            colorDistance: Math.round(distance),
          });
        }

        return isMatch;
      });

      if (colorSimilarMatch) {
        isDuplicate = true;
        skipReason = `Color+visual similarity: "${newItem.item_name}" ~ "${colorSimilarMatch.name}"`;
      }
    }

    if (isDuplicate) {
      console.log(`⏭️  Skipping: ${skipReason}`);
      skipReasons.push(skipReason);
    } else {
      uniqueItems.push(newItem);
    }
  }

  return {
    uniqueItems,
    duplicatesSkipped: detectedItems.length - uniqueItems.length,
    skipReasons,
  };
}

function calculateColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return 999;

  return Math.sqrt(Math.pow(rgb1.r - rgb2.r, 2) + Math.pow(rgb1.g - rgb2.g, 2) + Math.pow(rgb1.b - rgb2.b, 2));
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

async function generateProductImage(item: WardrobeDetectionItem): Promise<Uint8Array> {
  // Validate item has required fields
  if (!item.item_name || !item.category) {
    console.error("generateProductImage called with invalid item:", item);
    throw new Error(`Invalid item: missing item_name or category`);
  }

  const visualPrompt = `Create a professional e-commerce product photo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEM: ${item.item_name}
CATEGORY: ${item.category}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**EXACT COLOR SPECIFICATION:**
- Primary Color: ${item.primary_color_name} (${item.primary_color_hex})
- Full Palette: ${item.color_palette.map((c, i) => `${c} (${item.color_distribution[i]}%)`).join(", ")}
${item.color_blocking_layout !== "none" ? `- Color Blocking: ${item.color_blocking_layout}` : ""}

**PATTERN:**
- Type: ${item.pattern_type}
${item.pattern_geometry !== "none" ? `- Geometry: ${item.pattern_geometry}` : ""}
${item.pattern_coverage !== "none" ? `- Coverage: ${item.pattern_coverage}` : ""}
${item.pattern_scale !== "none" ? `- Scale: ${item.pattern_scale}` : ""}

${item.graphic_type !== "none" ? `**GRAPHICS:**
- Type: ${item.graphic_type}
- Location: ${item.graphic_location}
- Size: ${item.graphic_size}` : ""}

**SHAPE & STRUCTURE:**
- Fit: ${item.fit_type}
- Silhouette: ${item.silhouette}
- Length: ${item.length}

**CONSTRUCTION:**
${item.sleeve_type ? `- Sleeves: ${item.sleeve_type}` : ""}
${item.neckline ? `- Neckline: ${item.neckline}` : ""}
${item.collar_type && item.collar_type !== "none" ? `- Collar: ${item.collar_type}` : ""}
${item.closure_type && item.closure_type !== "none" ? `- Closure: ${item.closure_type}` : ""}
${item.hem_style ? `- Hem: ${item.hem_style}` : ""}
${item.pocket_details && item.pocket_details !== "none" ? `- Pockets: ${item.pocket_details}` : ""}
${item.shoulder_style ? `- Shoulders: ${item.shoulder_style}` : ""}

**VISUAL REFERENCE:**
${item.visual_summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATION REQUIREMENTS (STRICT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Pure white background (#FFFFFF)
2. Front-facing, centered, full garment visible
3. Item laid flat or on invisible mannequin (NO human body parts)
4. Professional lighting, no shadows
5. Follow EXACT colors, patterns, and construction details above
6. Do NOT invent details not specified
7. Ultra-sharp, e-commerce quality

Generate this exact item with precision.`;

  console.log(`Generating image with prompt: ${visualPrompt.substring(0, 100)}...`);

  const data = await callGeminiAPI({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [
      {
        role: "user",
        content: visualPrompt,
      },
    ],
    modalities: ["image", "text"],
  });

  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    throw new Error("No image URL in Gemini response");
  }

  // Extract base64 data from data URL
  const base64Match = imageUrl.match(/^data:image\/[a-z]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }

  // Decode base64 to binary
  const base64Data = base64Match[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
