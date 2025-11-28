import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-utils.ts";
import { generateCacheKey, getCachedResult, setCachedResult } from "../_shared/cache-utils.ts";
import { WARDROBE_PROMPTS, PRODUCT_IMAGE_PROMPTS } from "../_shared/prompts.ts";
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
  item_name: string; // Descriptive 3-5 word name with color and material if visible
  item_type: string; // Exact type (e.g., "Kurta", "Watch", "Sneakers")
  parent_category: "Clothing" | "Footwear" | "Accessories";
  visibility_score: number; // 0-100 percentage of item that is clearly visible
  visibility_notes?: string; // Optional visibility limitations
}

// Simplified interface for 15-field system
type DetectedItem = {
  name?: string; // Made optional since Phase 1 uses item_name
  category?: string;
  item_type?: string;
  
  // Core 15 styling fields
  color?: string;
  pattern_type?: string;
  pattern_description?: string;
  fabric_primary?: string;
  texture?: string;
  fit_type?: string;
  length?: string;
  formality_level?: string;
  suitable_occasions?: string[];
  style_aesthetic?: string[];
  season?: string[];
  weather_suitability?: string;
  style_notes_detailed?: string;
  
  // Images
  imageUrl?: string;
  processedImageUrl?: string;
  
  // Temporary fields for Phase 1 detection
  item_name?: string;
  parent_category?: string;
  bbox?: BoundingBox;
  visibility_score?: number;
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

    // Fetch user profile for enrichment context
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userProfile } = await supabaseClient
      .from("user_profiles")
      .select("gender, age_range")
      .eq("id", user.id)
      .single();

    const userContext = {
      gender: userProfile?.gender || null,
      age_range: userProfile?.age_range || null
    };

    console.log("User context for enrichment:", userContext);

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

    let detectedItems = validationAndDetection.items;

    // Filter items with low visibility score
    const filteredItems = detectedItems.filter(item => {
      if (item.visibility_score < 60) {
        console.log(`⚠️ Skipping ${item.item_name}: visibility too low (${item.visibility_score}%). Reason: ${item.visibility_notes || 'N/A'}`);
        return false;
      }
      return true;
    });

    if (!filteredItems || filteredItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: detectedItems.length > 0 
            ? "No items met visibility requirements (need 60%+ visibility)" 
            : "No clothing items detected in the image",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    detectedItems = filteredItems;
    console.log(`✅ Validated and detected ${detectedItems.length} items from image (passed visibility check)`);
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
          // Generate product image from original
          const imageData = await generateProductImage(item, imageUrl);

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
        await sleep(500); // Reduced from 2000ms to 500ms
      }
    }

    if (itemsWithProcessedImages.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate images for detected items", items: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Phase 1 complete: ${itemsWithProcessedImages.length} items with images`);

    // Helper to map item_type to legacy category for backwards compatibility
    const mapParentToLegacyCategory = (itemType: string): string => {
      const lowerType = itemType.toLowerCase();
      
      // Map common types to categories
      if (["kurta", "t-shirt", "shirt", "blouse", "crop top", "tank top", "tunic", "choli", "top"].includes(lowerType)) return "Tops";
      if (["jeans", "trousers", "pants", "salwar", "churidar", "palazzo", "dhoti", "shorts", "skirt", "leggings", "bottom"].includes(lowerType)) return "Bottoms";
      if (["jacket", "coat", "blazer", "cardigan", "hoodie", "sherwani", "nehru jacket", "sweater", "waistcoat"].includes(lowerType)) return "Outerwear";
      if (["dress", "gown", "jumpsuit", "lehenga", "saree", "kurti", "anarkali", "romper"].includes(lowerType)) return "Dresses";
      
      // Default to generic category based on parent
      return "Tops"; // fallback for unknown clothing types
    };

    // Prepare items to return immediately (with basic info, no enrichment yet)
    const itemsToReturn = itemsWithProcessedImages.map(item => ({
      name: item.item_name,
      category: item.parent_category === "Clothing" 
        ? mapParentToLegacyCategory(item.item_type || "")
        : item.parent_category === "Footwear" ? "Shoes" : "Accessories",
      imageUrl: item.processedImageUrl,
      processedImageUrl: item.processedImageUrl,
      parent_category: item.parent_category,
      item_type: item.item_type,
    }));

    const result = { items: itemsToReturn, enrichmentPending: true };

    // ========== BACKGROUND: PHASE 2 Enrichment ==========
    // Run metadata enrichment in the background without blocking response
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(backgroundEnrichment(itemsWithProcessedImages, imageUrl, userContext, user.id, supabase));
    }

    console.log(`✅ Returning ${itemsToReturn.length} items immediately (enrichment running in background)`);

    // Cache result (basic items, no enrichment yet)
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
 * Background enrichment function
 * Runs Phase 2 metadata extraction without blocking the main response
 */
async function backgroundEnrichment(
  items: Array<DetectedItem & { processedImageUrl: string }>,
  originalImageUrl: string,
  userContext: { gender: string | null; age_range: string | null },
  userId: string,
  supabase: any
) {
  console.log(`🔄 Background enrichment starting for ${items.length} items...`);

  const mapParentToLegacyCategory = (itemType: string): string => {
    const lowerType = itemType.toLowerCase();
    if (["kurta", "t-shirt", "shirt", "blouse", "crop top", "tank top", "tunic", "choli", "top"].includes(lowerType)) return "Tops";
    if (["jeans", "trousers", "pants", "salwar", "churidar", "palazzo", "dhoti", "shorts", "skirt", "leggings", "bottom"].includes(lowerType)) return "Bottoms";
    if (["jacket", "coat", "blazer", "cardigan", "hoodie", "sherwani", "nehru jacket", "sweater", "waistcoat"].includes(lowerType)) return "Outerwear";
    if (["dress", "gown", "jumpsuit", "lehenga", "saree", "kurti", "anarkali", "romper"].includes(lowerType)) return "Dresses";
    return "Tops";
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      console.log(`📊 Enriching ${i + 1}/${items.length}: ${item.item_name}`);

      const { data: enrichmentData, error: enrichmentError } = await supabase.functions.invoke(
        "enrich-wardrobe-item",
        {
          body: {
            originalImageUrl,
            category: item.parent_category === "Clothing" 
              ? mapParentToLegacyCategory(item.item_type || "")
              : item.parent_category === "Footwear" ? "Shoes" : "Accessories",
            itemName: item.item_name || "Unknown Item",
            userContext
          },
        },
      );

      if (enrichmentError) {
        console.error(`❌ Background enrichment error for ${item.item_name}:`, enrichmentError);
        continue;
      }

      if (enrichmentData?.enrichedMetadata) {
        const metadata = enrichmentData.enrichedMetadata;
        console.log(`✅ Enriched ${item.item_name}, updating DB...`);

        // Update the wardrobe_items record with enriched metadata
        const { error: updateError } = await supabase
          .from("wardrobe_items")
          .update({
            color: metadata.color,
            pattern_type: metadata.pattern_type,
            pattern_description: metadata.pattern_description,
            fabric_primary: metadata.fabric_primary,
            texture: metadata.texture,
            fit_type: metadata.fit_type,
            length: metadata.length,
            formality_level: metadata.formality_level,
            suitable_occasions: metadata.suitable_occasions,
            style_aesthetic: metadata.style_aesthetic,
            season: metadata.season,
            weather_suitability: metadata.weather_suitability,
            style_notes_detailed: metadata.style_notes_detailed,
            item_type: metadata.item_type,
            primary_color: metadata.color,
          })
          .eq("user_id", userId)
          .eq("processed_image_url", item.processedImageUrl);

        if (updateError) {
          console.error(`❌ DB update failed for ${item.item_name}:`, updateError);
        } else {
          console.log(`✅ DB updated with enriched data for ${item.item_name}`);
        }
      }
    } catch (err) {
      console.error(`❌ Background enrichment exception for ${item.item_name}:`, err);
    }
  }

  console.log(`✅ Background enrichment complete for ${items.length} items`);
}

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

const VISUAL_DETECTION_PROMPT = `You are a fashion item detector. Analyze this image and extract MINIMAL information for each visible item.

═══════════════════════════════════════════════════════════════════════
⚠️ VISIBILITY REQUIREMENTS (CRITICAL)
═══════════════════════════════════════════════════════════════════════

Before extracting ANY item, verify:
✓ At least 60% of the item's surface area is visible
✓ Overall shape/silhouette is clearly identifiable
✓ You can confidently describe what the full item looks like

❌ DO NOT EXTRACT items where:
- Only straps/handles/fragments are visible
- Item is mostly hidden behind another person or object
- Item is too blurry, dark, or overexposed to identify
- You would need to guess what the rest looks like

═══════════════════════════════════════════════════════════════════════
STEP 1: VALIDATE IMAGE
═══════════════════════════════════════════════════════════════════════

✅ VALID: Humans wearing clothes, standalone clothing items, flat-lay arrangements
❌ INVALID: Empty/blank images, non-clothing objects only, blurry/unidentifiable content

If INVALID: Set isValid=false with reason and return empty items array.

═══════════════════════════════════════════════════════════════════════
STEP 2: DETECT ITEMS (MINIMAL EXTRACTION)
═══════════════════════════════════════════════════════════════════════

If VALID: Detect up to 8 distinct items that meet visibility requirements:
- Clothing: tops, bottoms, dresses, outerwear (including kurtas, salwars, lehengas, sarees, sherwanis)
- Footwear: shoes, sandals, boots, heels, sneakers, juttis, kolhapuris
- Accessories: watches, bags, hats, belts, jewelry, sunglasses, scarves, dupattas

For each item, extract ONLY these 5 fields:

1. **bbox**: {x, y, width, height} as percentages (0-100) of image dimensions
   - x,y = top-left corner; width,height = size

2. **item_name**: Descriptive 3-5 word name with color and material if visible
   Examples: "Black Cotton T-Shirt", "White Canvas Sneakers", "Gold Analog Watch", "Navy Denim Jeans"

3. **item_type**: Exact type - be specific and culturally accurate
   Examples: "Kurta", "T-Shirt", "Lehenga", "Jeans", "Blazer", "Sneakers", "Juttis", "Watch"
   DO NOT generalize - if it's a Kurta, say "Kurta" not "Top"

4. **parent_category**: One of:
   • "Clothing" - All garments (tops, bottoms, dresses, outerwear, traditional wear)
   • "Footwear" - All shoes, sandals, boots
   • "Accessories" - Watches, bags, belts, jewelry, hats, sunglasses, scarves

5. **visibility_score**: 0-100 rating (must be >= 60 to extract)
   • 100 = Entire item perfectly visible
   • 80-99 = Most visible, minor parts hidden
   • 60-79 = Majority visible but some features obscured
   • Below 60 = DO NOT EXTRACT

6. **visibility_notes** (optional): Brief note on limitations if any
   Examples: "back not visible", "bottom hem cropped out", "partially hidden by arm"
   Leave empty if fully visible.

DO NOT extract: colors, patterns, fabrics, fit details, or any styling metadata.
That will be extracted in a separate phase from the original image.

═══════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════

Use the return_visual_detection function to return structured JSON with ONLY the 5-6 fields above per item.
`;

  console.log("Calling Gemini API for Phase 1 visual detection...");

  // Minimal schema for Phase 0 detection (only 5 essential fields)
  const tools = [
    {
      type: "function",
      function: {
        name: "return_visual_detection",
        description: "Return validation result and detected items with MINIMAL fields for image generation",
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
              description: "Array of detected items with minimal metadata (just 5 fields needed for image generation)",
              items: {
                type: "object",
                properties: {
                  bbox: {
                    type: "object",
                    description: "Bounding box coordinates as percentages",
                    properties: {
                      x: { type: "number", description: "X coordinate (0-100)" },
                      y: { type: "number", description: "Y coordinate (0-100)" },
                      width: { type: "number", description: "Width (0-100)" },
                      height: { type: "number", description: "Height (0-100)" },
                    },
                    required: ["x", "y", "width", "height"],
                  },
                  item_name: { 
                    type: "string", 
                    description: "Descriptive 3-5 word name with color and material (e.g., 'Black Cotton T-Shirt')" 
                  },
                  item_type: { 
                    type: "string", 
                    description: "Exact item type - be specific (e.g., 'Kurta' not 'Top', 'Sneakers' not 'Shoes')" 
                  },
                  parent_category: {
                    type: "string",
                    enum: ["Clothing", "Footwear", "Accessories"],
                    description: "High-level category: Clothing (all garments), Footwear (shoes), or Accessories (watches, bags, jewelry)"
                  },
                  visibility_score: {
                    type: "number",
                    description: "0-100 rating of how clearly visible the item is. Must be >= 60 to include."
                  },
                  visibility_notes: {
                    type: "string",
                    description: "Brief note on any visibility limitations (e.g., 'back not visible'). Empty if fully visible."
                  },
                },
                required: [
                  "bbox",
                  "item_name",
                  "item_type",
                  "parent_category",
                  "visibility_score",
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
        args.items.every((item: any) => item.item_name && item.item_type && item.parent_category && item.bbox && typeof item.visibility_score === 'number');

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

  // Simplified deduplication: match on item_name similarity and item_type
  for (const newItem of detectedItems) {
    let isDuplicate = false;
    let skipReason = "";

    // Find items with matching item_type in same parent_category
    const similarItems = existingItems.filter((existing) => {
      // Map existing item's category to parent_category for comparison
      let existingParent = "Clothing";
      if (existing.category === "Shoes") existingParent = "Footwear";
      else if (existing.category === "Accessories") existingParent = "Accessories";

      return existingParent === newItem.parent_category;
    });

    // Check for name similarity (using simple string matching)
    const nameMatch = similarItems.find((existing) => {
      const newName = newItem.item_name.toLowerCase();
      const existingName = existing.name.toLowerCase();
      
      // Check if item_type matches (if we have it in existing item)
      const typeMatch = existing.item_type && newItem.item_type && 
        existing.item_type.toLowerCase() === newItem.item_type.toLowerCase();
      
      // Check if names are very similar (contain same words)
      const newWords = new Set(newName.split(/\s+/));
      const existingWords = new Set(existingName.split(/\s+/));
      
      // Calculate word overlap
      const commonWords = [...newWords].filter(word => existingWords.has(word));
      const overlapRatio = commonWords.length / Math.min(newWords.size, existingWords.size);
      
      // Consider duplicate if type matches AND high name overlap
      const isMatch = typeMatch && overlapRatio > 0.6;
      
      if (isMatch) {
        console.log(`🔍 Name+type match for "${newItem.item_name}":`, {
          existing: existing.name,
          overlapRatio: Math.round(overlapRatio * 100) + "%",
        });
      }
      
      return isMatch;
    });

    if (nameMatch) {
      isDuplicate = true;
      skipReason = `Similar item exists: "${newItem.item_name}" ~ "${nameMatch.name}"`;
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


async function generateProductImage(item: WardrobeDetectionItem, originalImageUrl: string): Promise<Uint8Array> {
  // Validate item has required fields
  if (!item.item_name || !item.parent_category) {
    console.error("generateProductImage called with invalid item:", item);
    throw new Error(`Invalid item: missing item_name or parent_category`);
  }
  
  const transformPrompt = `${PRODUCT_IMAGE_PROMPTS.UNIVERSAL}

🎯 EXTRACT THIS SPECIFIC ITEM:
The image contains multiple items. Extract ONLY the item at:
- Bounding Box: ${item.bbox.x.toFixed(1)}%, ${item.bbox.y.toFixed(1)}%, ${item.bbox.width.toFixed(1)}% × ${item.bbox.height.toFixed(1)}%
- Item: ${item.item_name}
- Type: ${item.item_type || 'Unknown'}

STEPS:
1. Locate item within bounding box
2. Extract ONLY that item
3. Apply professional e-commerce transformation

✅ PRESERVE: Exact colors, textures, patterns, details
🚫 REMOVE: Background, body parts, other items

DO NOT include any other items from the image.`;

  console.log(`Generating professional product image for: ${item.item_name} (${item.item_type})`);

  const data = await callGeminiAPI({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: transformPrompt,
          },
          {
            type: "image_url",
            image_url: { url: originalImageUrl },
          },
        ],
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
