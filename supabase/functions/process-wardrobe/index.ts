import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-utils.ts";
import { generateCacheKey, getCachedResult, setCachedResult } from "../_shared/cache-utils.ts";
import { callGeminiAPI } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ============================================================================
// NEW 12-FIELD VISUAL METADATA SYSTEM
// ============================================================================

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Phase 1: Visual detection with exactly 12 metadata fields
 */
interface Phase1Item {
  bbox: BoundingBox;
  visible_area_ratio: number; // 0-1
  confidence: number; // 0-1
  
  // The 12 visual fields
  category: string;
  item_type: string;
  fit_silhouette: string;
  length: string;
  primary_color_hex: string;
  secondary_palette: string[];
  pattern_type: string;
  pattern_geometry: string;
  graphic_summary: string;
  sleeve_neck_summary: string;
  fabric_family: string;
  fabric_behavior: string;
}

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

    console.log("Processing image with 12-field visual system...");

    // Check cache
    const cacheKey = await generateCacheKey({ type: "wardrobe_visual_v3_12fields", imageUrl });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log("Cached result for key:", cacheKey.substring(0, 16) + "...");
      return new Response(JSON.stringify({ success: true, ...cachedResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PHASE 1: Validate and detect items
    console.log("Phase 1: Validating and detecting items...");
    const validation = await validateAndDetectItems(imageUrl);

    if (!validation.isValid) {
      console.log("Image validation failed:", validation.reason);
      return new Response(
        JSON.stringify({
          error: validation.reason || "Image unsuitable for wardrobe extraction",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const detectedItems = validation.items;

    if (!detectedItems || detectedItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No clothing items detected",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`✅ Detected ${detectedItems.length} items`);

    // Filter by visibility thresholds
    const visibleItems = filterByVisibility(detectedItems);
    console.log(`✅ ${visibleItems.length} items passed visibility filter`);

    if (visibleItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No items met visibility requirements",
          items: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Deduplication
    console.log("Step 1.5: Deduplication...");
    const dedupeResult = await deduplicateItems(visibleItems, user.id);

    if (dedupeResult.uniqueItems.length === 0) {
      console.log("⚠️ All items were duplicates");
      return new Response(
        JSON.stringify({
          error: "All detected items already exist in your wardrobe",
          items: [],
          duplicatesSkipped: dedupeResult.duplicatesSkipped,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `✅ ${dedupeResult.uniqueItems.length} unique items (${dedupeResult.duplicatesSkipped} duplicates skipped)`
    );

    const uniqueItems = dedupeResult.uniqueItems;

    // Phase 1.5B: Generate product images
    console.log("Phase 1: Generating product images for all items...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const itemsWithImages: Array<Phase1Item & { processedImageUrl: string }> = [];

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < uniqueItems.length; i++) {
      const item = uniqueItems[i];
      console.log(`Generating image ${i + 1}/${uniqueItems.length}: ${item.item_type}`);

      try {
        const imageData = await generateProductImage(item);
        const fileName = `${user.id}/wardrobe_gen_${Date.now()}_${i}_${item.item_type.replace(/\s+/g, "-")}.png`;
        
        const { error: uploadError } = await supabase.storage.from("outfits").upload(fileName, imageData, {
          contentType: "image/png",
          upsert: false,
        });

        if (uploadError) {
          console.error(`Upload error for ${item.item_type}:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage.from("outfits").getPublicUrl(fileName);
        console.log(`✅ Image generated for ${item.item_type}`);
        itemsWithImages.push({ ...item, processedImageUrl: publicUrl });
      } catch (err) {
        console.error(`Failed to generate image for ${item.item_type}:`, err);
      }

      if (i < uniqueItems.length - 1) {
        await sleep(2000);
      }
    }

    console.log(`✅ Phase 1 complete: ${itemsWithImages.length} items with images`);

    // Phase 2: Enrichment
    console.log("Phase 2: Enriching metadata for all items...");
    const finalItems = [];

    for (let i = 0; i < itemsWithImages.length; i++) {
      const item = itemsWithImages[i];
      console.log(`Enriching item ${i + 1}/${itemsWithImages.length}: ${item.item_type}`);

      let enrichedItem = { ...item };

      try {
        const { data: enrichmentData, error: enrichmentError } = await supabase.functions.invoke(
          "enrich-wardrobe-item",
          {
            body: {
              originalImageUrl: imageUrl,
              visualMetadata: {
                category: item.category,
                item_type: item.item_type,
                fit_silhouette: item.fit_silhouette,
                length: item.length,
                primary_color_hex: item.primary_color_hex,
                secondary_palette: item.secondary_palette,
                pattern_type: item.pattern_type,
                pattern_geometry: item.pattern_geometry,
                graphic_summary: item.graphic_summary,
                sleeve_neck_summary: item.sleeve_neck_summary,
                fabric_family: item.fabric_family,
                fabric_behavior: item.fabric_behavior,
              },
            },
          }
        );

        if (enrichmentError) {
          console.error(`Enrichment error for ${item.item_type} (non-fatal):`, enrichmentError);
        } else if (enrichmentData?.detailedMetadata) {
          console.log(`✅ Enriched ${item.item_type}: merged ${Object.keys(enrichmentData.detailedMetadata).length} fields`);
          enrichedItem = { ...item, ...enrichmentData.detailedMetadata };
        }
      } catch (enrichErr) {
        console.error(`Enrichment exception for ${item.item_type} (non-fatal):`, enrichErr);
      }

      finalItems.push({
        ...enrichedItem,
        imageUrl: item.processedImageUrl,
      });

      if (i < itemsWithImages.length - 1) {
        await sleep(1000);
      }
    }

    console.log(`✅ Phase 2 complete: ${finalItems.length} fully enriched items`);

    const result = { items: finalItems };

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

    const isRateLimit = errorLower.includes("rate") || errorLower.includes("429") || errorLower.includes("resource exhausted");
    const isCredits = errorLower.includes("credits") || errorLower.includes("402");

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
      }
    );
  }
});

/**
 * Validate image and detect items with 12-field metadata
 */
async function validateAndDetectItems(
  imageUrl: string
): Promise<{
  isValid: boolean;
  reason?: string;
  items: Phase1Item[];
}> {
  const PROMPT = `You are a precise visual clothing analyzer. Analyze this image and determine if it's suitable for wardrobe extraction.

✅ VALID: Humans wearing clothes, standalone clothing items, flat-lay arrangements
❌ INVALID: Empty images, non-clothing objects only, blurry/unidentifiable content

**VISIBILITY RULES:**
- Garments: Only extract if visible_area_ratio ≥ 0.80
- Bags: Only extract if visible_area_ratio ≥ 0.60  
- Watches: Only extract if visible_area_ratio ≥ 0.50

**STRICT ACCESSORY RULES:**
ONLY detect: Bags (tote, shoulder, crossbody, handbag, backpack, clutch, satchel), Watches
DO NOT detect: Rings, Necklaces, Glasses, Belts, Earrings, Beads, Scarves, any other accessories

**NO INFERENCE:** Do NOT infer items from straps, shadows, reflections, partial silhouettes, or mirrored angles.

**For each detected item (max 5), extract EXACTLY these 12 fields:**

1. category: Tops | Bottoms | Outerwear | Dresses | Shoes | Bags | Watches
2. item_type: Specific type (e.g., "t-shirt", "jeans", "sneakers", "tote bag")
3. fit_silhouette: Combined fit+silhouette (e.g., "slim-straight", "relaxed-boxy", "fitted-tapered")
4. length: Category-specific (e.g., "hip", "ankle", "mini", "knee")
5. primary_color_hex: Dominant color as #RRGGBB
6. secondary_palette: Array of 0-3 additional hex colors
7. pattern_type: solid | striped | checkered | floral | graphic | etc.
8. pattern_geometry: horizontal | vertical | ditsy | all-over | none
9. graphic_summary: "none" OR brief description (e.g., "center-chest logo small")
10. sleeve_neck_summary: Combined (e.g., "short-sleeve crew-neck") OR "n/a" for non-tops
11. fabric_family: cotton | denim | wool | leather | knit | synthetic | etc.
12. fabric_behavior: structured | flowing | stretchy | stiff | soft | etc.

Also provide:
- bbox: {x, y, width, height} as 0-100 percentages
- visible_area_ratio: 0-1 (portion of item visible)
- confidence: 0-1 (detection confidence)

Use return_visual_detection function to return structured output.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "return_visual_detection",
        description: "Return validation result and detected items with 12-field metadata",
        parameters: {
          type: "object",
          properties: {
            isValid: { type: "boolean" },
            reason: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  bbox: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      width: { type: "number" },
                      height: { type: "number" },
                    },
                    required: ["x", "y", "width", "height"],
                  },
                  visible_area_ratio: { type: "number" },
                  confidence: { type: "number" },
                  category: { type: "string" },
                  item_type: { type: "string" },
                  fit_silhouette: { type: "string" },
                  length: { type: "string" },
                  primary_color_hex: { type: "string" },
                  secondary_palette: { type: "array", items: { type: "string" } },
                  pattern_type: { type: "string" },
                  pattern_geometry: { type: "string" },
                  graphic_summary: { type: "string" },
                  sleeve_neck_summary: { type: "string" },
                  fabric_family: { type: "string" },
                  fabric_behavior: { type: "string" },
                },
                required: [
                  "bbox", "visible_area_ratio", "confidence",
                  "category", "item_type", "fit_silhouette", "length",
                  "primary_color_hex", "secondary_palette", "pattern_type", "pattern_geometry",
                  "graphic_summary", "sleeve_neck_summary", "fabric_family", "fabric_behavior"
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
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "return_visual_detection" } },
  });

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.type === "function") {
    const args = JSON.parse(toolCall.function.arguments || "{}");
    return {
      isValid: !!args.isValid,
      reason: args.reason,
      items: args.items || [],
    };
  }

  return { isValid: false, reason: "Failed to parse AI response", items: [] };
}

/**
 * Filter items by visibility thresholds
 */
function filterByVisibility(items: Phase1Item[]): Phase1Item[] {
  return items.filter(item => {
    if (item.category === "Bags") return item.visible_area_ratio >= 0.60;
    if (item.category === "Watches") return item.visible_area_ratio >= 0.50;
    return item.visible_area_ratio >= 0.80; // Garments
  });
}

/**
 * Deduplicate items using 12-field matching
 */
async function deduplicateItems(
  items: Phase1Item[],
  userId: string
): Promise<{
  uniqueItems: Phase1Item[];
  duplicatesSkipped: number;
  skipReasons: string[];
}> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: existingItems, error } = await supabase.from("wardrobe_items").select("*").eq("user_id", userId);

  if (error || !existingItems || existingItems.length === 0) {
    return { uniqueItems: items, duplicatesSkipped: 0, skipReasons: [] };
  }

  const uniqueItems: Phase1Item[] = [];
  const skipReasons: string[] = [];

  for (const item of items) {
    let isDuplicate = false;

    for (const existing of existingItems) {
      if (existing.category !== item.category) continue;

      const matchingFields = [
        existing.item_type === item.item_type,
        existing.fit_silhouette === item.fit_silhouette,
        existing.length === item.length,
        existing.pattern_type === item.pattern_type,
        existing.pattern_geometry === item.pattern_geometry,
        existing.fabric_family === item.fabric_family,
        existing.fabric_behavior === item.fabric_behavior,
        calculateColorDistance(existing.primary_color_hex, item.primary_color_hex) < 30,
      ].filter(Boolean);

      if (matchingFields.length >= 5) {
        isDuplicate = true;
        skipReasons.push(`Duplicate: ${item.item_type} (${matchingFields.length}/8 matches)`);
        break;
      }
    }

    if (!isDuplicate) {
      uniqueItems.push(item);
    }
  }

  return {
    uniqueItems,
    duplicatesSkipped: items.length - uniqueItems.length,
    skipReasons,
  };
}

/**
 * Calculate color distance
 */
function calculateColorDistance(hex1: string | null | undefined, hex2: string | null | undefined): number {
  if (!hex1 || !hex2) return 999;
  
  const h1 = hex1.replace('#', '');
  const h2 = hex2.replace('#', '');
  
  const r1 = parseInt(h1.slice(0, 2), 16);
  const g1 = parseInt(h1.slice(2, 4), 16);
  const b1 = parseInt(h1.slice(4, 6), 16);
  
  const r2 = parseInt(h2.slice(0, 2), 16);
  const g2 = parseInt(h2.slice(2, 4), 16);
  const b2 = parseInt(h2.slice(4, 6), 16);
  
  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Generate product image using ONLY 12 visual fields
 */
async function generateProductImage(item: Phase1Item): Promise<Uint8Array> {
  const prompt = `Create a professional e-commerce product photo.

ITEM: ${item.item_type} (${item.category})

**COLOR:**
- Primary: ${item.primary_color_hex}
${item.secondary_palette.length > 0 ? `- Secondary: ${item.secondary_palette.join(', ')}` : ''}

**PATTERN:**
- Type: ${item.pattern_type}
- Geometry: ${item.pattern_geometry}
${item.graphic_summary !== 'none' ? `- Graphic: ${item.graphic_summary}` : ''}

**SHAPE:**
- Fit/Silhouette: ${item.fit_silhouette}
- Length: ${item.length}
${item.sleeve_neck_summary !== 'n/a' ? `- Details: ${item.sleeve_neck_summary}` : ''}

**FABRIC:**
- Type: ${item.fabric_family}
- Behavior: ${item.fabric_behavior}

REQUIREMENTS:
- Pure white background (#FFFFFF)
- Front-facing, centered, full garment visible
- Invisible mannequin or clean flat lay
- True-to-material rendering
- Do NOT hallucinate features
- Match exact specifications above`;

  const data = await callGeminiAPI({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
    modalities: ["image", "text"],
  });

  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error("No image generated");

  // Convert base64 to Uint8Array
  const base64Data = imageUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
