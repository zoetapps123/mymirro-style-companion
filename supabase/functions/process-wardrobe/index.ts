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

interface DetectedItem {
  name: string;
  category: string;
  // Enhanced color fields
  primary_color: string;
  primary_color_name: string;
  color_family: string;
  secondary_colors?: string[];
  color_distribution?: number[];
  // Fabric & material
  fabric_primary: string;
  fabric_weight: string;
  material_finish: string;
  texture: string;
  // Pattern
  pattern_type: string;
  pattern_scale: string;
  pattern_colors?: string[];
  // Cut & fit
  fit_type: string;
  silhouette: string;
  length: string;
  // Design elements
  neckline?: string;
  sleeve_type?: string;
  closure_type: string;
  pocket_details: string;
  hardware_details: string;
  embellishments: string;
  special_features: string[];
  // Style & aesthetic
  style_aesthetic: string[];
  formality_level: string;
  style_notes_detailed: string;
  // Occasion & use
  suitable_occasions: string[];
  season: string[];
  weather_suitability: string;
  // Category-specific
  rise?: string;
  waist_style?: string;
  heel_type?: string;
  toe_style?: string;
  collar_type?: string;
  // K-fashion / J-fashion enhanced fit attributes
  t_shirt_sleeve_length?: string;
  body_volume_ratio?: string;
  hemline_placement?: string;
  pant_stacking?: string;
  waist_visibility?: string;
  shoulder_structure?: string;
  // Enhanced fabric attributes
  t_shirt_material?: string;
  denim_type?: string;
  // Optional
  brand?: string;
  condition?: string;
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

    console.log("Processing image with Gemini-only pipeline...");

    // Check cache
    const cacheKey = await generateCacheKey({ type: "wardrobe_gemini_v4", imageUrl });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log("Returning cached result");
      return new Response(JSON.stringify({ success: true, ...cachedResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OPTIMIZED: Single API call to validate AND detect items (with stronger retry/backoff + model fallback)
    console.log("Step 1: Validating and detecting items in one call...");

    let validationAndDetection: { isValid: boolean; reason?: string; items: DetectedItem[] } | null = null;
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

    // Step 2: Generate individual product images for each item using Gemini (sequential with backoff)
    console.log("Step 2: Generating product images with Gemini sequentially...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const itemsWithImages: Array<DetectedItem & { imageUrl: string }> = [];

    // Helper sleep
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < uniqueDetectedItems.length; i++) {
      const item = uniqueDetectedItems[i];
      console.log(`Starting generation for item ${i + 1}/${uniqueDetectedItems.length}: ${item.name}`);

      let attempts = 0;
      const maxAttempts = 3; // 1 try + 2 retries

      while (attempts < maxAttempts) {
        try {
          const imageData = await generateProductImage(item);

          // Upload to Storage
          const fileName = `${user.id}/wardrobe_gen_${Date.now()}_${i}_${item.name.replace(/\s+/g, "-")}.png`;
          const { error: uploadError } = await supabase.storage.from("outfits").upload(fileName, imageData, {
            contentType: "image/png",
            upsert: false,
          });

          if (uploadError) {
            console.error(`Upload error for ${item.name}:`, uploadError);
            break; // don't retry on storage errors
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("outfits").getPublicUrl(fileName);

          console.log(`Generated image for ${item.name}`);
          itemsWithImages.push({ ...item, imageUrl: publicUrl });
          break; // success
        } catch (err) {
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          const isRate = msg.includes("rate") || msg.includes("429") || msg.includes("resource exhausted");

          if (isRate && attempts < maxAttempts - 1) {
            const wait = (attempts + 1) * 3000; // 3s, 6s
            console.warn(`Rate limited while generating '${item.name}', retrying in ${wait / 1000}s...`);
            await sleep(wait);
            attempts++;
            continue;
          }

          console.error(`Failed to generate image for ${item.name}:`, err);
          break; // non-retryable or maxed out
        }
      }

      // small pacing delay between items to reduce burstiness
      await sleep(500);
    }

    if (itemsWithImages.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate images for detected items", items: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
  items: DetectedItem[];
}> {
  const combinedPrompt = `You are analyzing a clothing image. Your task is TWO-FOLD:

STEP 1 - VALIDATION: First determine if this image is suitable for wardrobe extraction.
✅ VALID: Images showing humans wearing clothes OR standalone clothing items on clean backgrounds
❌ INVALID: Empty images, non-clothing objects, unclear/blurry images, inappropriate content

STEP 2 - DETECTION: If valid, extract ALL visible clothing items with comprehensive metadata.

${WARDROBE_PROMPTS.DETECT_ITEMS}

RESPONSE FORMAT - Return a JSON object with this EXACT structure:
{
  "isValid": true/false,
  "reason": "rejection reason if invalid, otherwise omit",
  "items": [
    {
      "name": "Blue Denim Jacket",
      "category": "Outerwear",
      "primary_color": "#4A90E2",
      "primary_color_name": "Blue",
      "color_family": "blue",
      "secondary_colors": ["#2C3E50", "#ECF0F1"],
      "color_distribution": [70, 20, 10],
      "pattern_colors": [],
      "fabric_primary": "denim",
      "fabric_weight": "medium",
      "material_finish": "washed",
      "texture": "textured",
      "pattern_type": "solid",
      "pattern_scale": "none",
      "fit_type": "regular",
      "silhouette": "classic",
      "length": "hip",
      "neckline": null,
      "sleeve_type": "long",
      "collar_type": "shirt collar",
      "closure_type": "button",
      "pocket_details": "front chest pockets and side pockets",
      "hardware_details": "metal buttons and rivets",
      "embellishments": "none",
      "special_features": ["distressed details"],
      "style_aesthetic": ["casual", "americana"],
      "formality_level": "casual",
      "style_notes_detailed": "Classic fit denim jacket with button closure and distressed accents. Features traditional western-style yoke and shirt collar.",
      "suitable_occasions": ["casual", "everyday"],
      "season": ["spring", "fall"],
      "weather_suitability": "cool",
      "rise": null,
      "waist_style": null,
      "heel_type": null,
      "toe_style": null,
      "brand": null,
      "condition": "good"
    }
  ]
}

IMPORTANT: Include ALL fields shown above for every item. Use null for fields that don't apply to the category (e.g., neckline for jackets, heel_type for non-shoes). Always provide:
- secondary_colors and color_distribution arrays (even if empty)
- pattern_colors array
- All category-specific fields (neckline, sleeve_type, collar_type for tops/outerwear; rise, waist_style for bottoms; heel_type, toe_style for shoes)
- brand and condition (use null if unknown)

Return ONLY the JSON object, no other text.`;

  console.log('Calling Gemini for wardrobe validation and detection...');

  // Prefer structured output via function-calling to avoid JSON parsing issues
  const tools = [
    {
      type: 'function',
      function: {
        name: 'return_detection',
        description: 'Return validation result and detected wardrobe items.',
        parameters: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            reason: { type: 'string' },
            items: {
              type: 'array',
              items: { type: 'object' },
            },
          },
          required: ['isValid', 'items'],
        },
      },
    },
  ];

  const data = await callGeminiAPI({
    model,
    messages: [
      {
        role: 'system',
        content: 'You MUST call the function return_detection with strictly valid JSON. Do not output prose.',
      },
      {
        role: "user",
        content: [
          { type: "text", text: combinedPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    tools,
    tool_choice: { type: 'function', function: { name: 'return_detection' } },
  });

  // If function call is returned, use it
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.type === 'function' && toolCall.function?.name === 'return_detection') {
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      console.log('Parsed via function call:', {
        isValid: args.isValid,
        itemCount: Array.isArray(args.items) ? args.items.length : 0,
      });
      return {
        isValid: !!args.isValid,
        reason: args.reason,
        items: Array.isArray(args.items) ? args.items : [],
      };
    } catch (e: any) {
      console.error('Failed to parse function-call arguments:', e.message);
      // fall through to text parsing below
    }
  }

  const content = data.choices?.[0]?.message?.content || "";
  console.log('Gemini response length:', content.length);
  console.log('Gemini response preview (first 300 chars):', content.substring(0, 300));

  // Clean the response - remove markdown code blocks
  let cleanedContent = content.trim();
  
  // Remove markdown code fences from start and end
  if (cleanedContent.startsWith('```json')) {
    cleanedContent = cleanedContent.replace(/^```json\n?/, '');
  }
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```\n?/, '');
  }
  if (cleanedContent.endsWith('```')) {
    cleanedContent = cleanedContent.replace(/```$/, '');
  }
  cleanedContent = cleanedContent.trim();
  
  console.log('After markdown removal (first 300 chars):', cleanedContent.substring(0, 300));

  // Extract JSON from response
  const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to extract JSON from response. Full content:', content);
    throw new Error("Failed to extract validation+detection result from Gemini response");
  }

  let jsonString = jsonMatch[0];
  
  // Fix common JSON issues
  // 1. Remove trailing commas before closing brackets/braces
  jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');
  
  console.log('After JSON fixes (first 300 chars):', jsonString.substring(0, 300));

  // Parse JSON with error handling (with repair attempts)
  let result;
  try {
    result = JSON.parse(jsonString);
  } catch (firstErr: any) {
    console.error('First JSON parse failed:', firstErr.message);
    console.error('Failed JSON string (first 2000 chars):', jsonString.substring(0, 2000));

    // Attempt repairs
    let repaired = jsonString;
    // 1) Remove trailing commas before ] or }
    repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
    // 2) Insert missing commas between objects: `}{` -> `},{`
    repaired = repaired.replace(/}\s*{/g, '},{');
    // 3) Collapse accidental double commas
    repaired = repaired.replace(/,\s*,/g, ',');
    // 4) Remove stray trailing commas at line ends
    repaired = repaired.replace(/,\s*\n\s*([\]}])/g, '\n$1');

    console.log('Applied JSON repair heuristics. Retrying parse...');

    try {
      result = JSON.parse(repaired);
      console.log('Second parse attempt succeeded.');
      jsonString = repaired; // keep repaired version for further logs if needed
    } catch (secondErr: any) {
      console.error('Second JSON parse failed:', secondErr.message);
      console.error('Repaired JSON (first 2000 chars):', repaired.substring(0, 2000));
      console.error('Repaired JSON length:', repaired.length);
      // Graceful fallback: mark as invalid instead of throwing 500
      result = { isValid: false, reason: 'Malformed AI response (JSON parse failed after repair)', items: [] };
    }
  }

  console.log('Successfully parsed wardrobe detection:', {
    isValid: result.isValid,
    itemCount: result.items?.length || 0,
    firstItemName: result.items?.[0]?.name || 'N/A',
    hasReason: !!result.reason
  });

  // Validate response structure
  if (typeof result.isValid !== 'boolean') {
    console.error('Invalid response structure - missing or invalid isValid field:', result);
    throw new Error('Response missing required "isValid" field');
  }

  if (result.isValid && !Array.isArray(result.items)) {
    console.error('Invalid response structure - items is not an array:', result);
    throw new Error('Response missing required "items" array for valid detection');
  }

  return {
    isValid: result.isValid,
    reason: result.reason,
    items: result.items || [],
  };
}

interface DuplicateCheckResult {
  uniqueItems: DetectedItem[];
  duplicatesSkipped: number;
  skipReasons: string[];
}

async function enhancedSmartDeduplication(
  detectedItems: DetectedItem[],
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

  const uniqueItems: DetectedItem[] = [];
  const skipReasons: string[] = [];

  for (const newItem of detectedItems) {
    let isDuplicate = false;
    let skipReason = "";

    // LEVEL 1: Exact name match
    // const exactMatch = existingItems.find(
    //   e => e.name?.toLowerCase().trim() === newItem.name.toLowerCase().trim()
    // );

    // if (exactMatch) {
    //   isDuplicate = true;
    //   skipReason = `Exact name: "${newItem.name}"`;
    // }

    // LEVEL 2: Enhanced Fingerprint Match (with null checks)
    //if (!isDuplicate)
    {
      const bothExistAndMatch = (a: any, b: any) => {
        return a != null && a !== "" && b != null && b !== "" && a === b;
      };

      const fingerprintMatch = existingItems.find((existing) => {
        const sameCategory = bothExistAndMatch(existing.category, newItem.category);
        if (!sameCategory) return false;

        const sameColorFamily = bothExistAndMatch(existing.color_family, newItem.color_family);
        const sameFabric = bothExistAndMatch(
          existing.fabric_primary?.toLowerCase(),
          newItem.fabric_primary?.toLowerCase(),
        );
        const sameFit = bothExistAndMatch(existing.fit_type, newItem.fit_type);
        const samePattern = bothExistAndMatch(existing.pattern_type, newItem.pattern_type);
        const sameSilhouette = bothExistAndMatch(existing.silhouette, newItem.silhouette);
        const sameClosure = bothExistAndMatch(existing.closure_type, newItem.closure_type);
        const sameLength = bothExistAndMatch(existing.length, newItem.length);

        const matchingFields = [
          sameColorFamily,
          sameFabric,
          sameFit,
          samePattern,
          sameSilhouette,
          sameClosure,
          sameLength,
        ].filter(Boolean);

        const hasEnoughMatches = matchingFields.length >= 4;

        if (hasEnoughMatches) {
          console.log(`🔍 Fingerprint match found for "${newItem.name}":`, {
            existing: existing.name,
            matchingFieldsCount: matchingFields.length,
            fields: {
              colorFamily: sameColorFamily,
              fabric: sameFabric,
              fit: sameFit,
              pattern: samePattern,
              silhouette: sameSilhouette,
              closure: sameClosure,
              length: sameLength,
            },
          });
        }

        return hasEnoughMatches;
      });

      if (fingerprintMatch) {
        isDuplicate = true;
        skipReason = `Fingerprint match: "${newItem.name}" = "${fingerprintMatch.name}"`;
      }
    }

    // LEVEL 3: Color Similarity (with null checks)
    if (!isDuplicate) {
      const colorSimilarMatch = existingItems.find((existing) => {
        if (existing.category !== newItem.category) return false;

        // Both must have valid primary colors
        const existingColor = existing.primary_color || existing.color;
        const newColor = newItem.primary_color;

        if (!existingColor || !newColor) return false;

        const distance = calculateColorDistance(existingColor, newColor);

        // Require category + color + at least 2 other attributes
        const colorMatch = distance < 30;
        const fabricMatch =
          existing.fabric_primary && newItem.fabric_primary && existing.fabric_primary === newItem.fabric_primary;
        const silhouetteMatch = existing.silhouette && newItem.silhouette && existing.silhouette === newItem.silhouette;
        const fitMatch = existing.fit_type && newItem.fit_type && existing.fit_type === newItem.fit_type;

        const extraMatches = [fabricMatch, silhouetteMatch, fitMatch].filter(Boolean).length;

        const isMatch = colorMatch && extraMatches >= 2;

        if (isMatch) {
          console.log(`🎨 Color similarity match for "${newItem.name}":`, {
            existing: existing.name,
            colorDistance: Math.round(distance),
            fabric: fabricMatch,
            silhouette: silhouetteMatch,
            fit: fitMatch,
          });
        }

        return isMatch;
      });

      if (colorSimilarMatch) {
        isDuplicate = true;
        skipReason = `Color similarity: "${newItem.name}" ~ "${colorSimilarMatch.name}"`;
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

async function generateProductImage(item: DetectedItem): Promise<Uint8Array> {
  const detailedPrompt = `Create a professional e-commerce product photo of:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEM: ${item.name}
CATEGORY: ${item.category}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**COLOR SPECIFICATION:**
- Primary: ${item.primary_color_name} (${item.primary_color})
${item.secondary_colors?.length ? `- Accent Colors: ${item.secondary_colors.join(", ")}` : ""}
${item.color_distribution ? `- Color Distribution: ${item.primary_color_name} ${item.color_distribution[0]}%, accents ${item.color_distribution.slice(1).join("%, ")}%` : ""}
- Color Family: ${item.color_family}

**FABRIC & MATERIAL:**
- Primary Fabric: ${item.fabric_primary}
- Weight: ${item.fabric_weight}
- Finish: ${item.material_finish}
- Texture: ${item.texture}

**PATTERN:**
- Type: ${item.pattern_type}
${item.pattern_scale !== "none" ? `- Scale: ${item.pattern_scale}` : ""}
${item.pattern_colors?.length ? `- Pattern Colors: ${item.pattern_colors.join(", ")}` : ""}

**CUT & FIT:**
- Fit: ${item.fit_type}
- Silhouette: ${item.silhouette}
- Length: ${item.length}

**DESIGN DETAILS:**
${item.neckline ? `- Neckline: ${item.neckline}` : ""}
${item.sleeve_type ? `- Sleeves: ${item.sleeve_type}` : ""}
- Closure: ${item.closure_type}
- Pockets: ${item.pocket_details}
- Hardware: ${item.hardware_details}
- Embellishments: ${item.embellishments}
${item.special_features.length ? `- Special Features: ${item.special_features.join(", ")}` : ""}

${item.rise ? `- Rise: ${item.rise}` : ""}
${item.waist_style ? `- Waist: ${item.waist_style}` : ""}
${item.heel_type ? `- Heel: ${item.heel_type}` : ""}
${item.toe_style ? `- Toe: ${item.toe_style}` : ""}
${item.collar_type ? `- Collar: ${item.collar_type}` : ""}

**STYLE & VIBE:**
- Aesthetic: ${item.style_aesthetic.join(" + ")}
- Formality: ${item.formality_level}
- Detailed Notes: ${item.style_notes_detailed}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GENERATION REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Pure white background (#FFFFFF)
- Front-facing, centered, full visibility
- Professional e-commerce lighting (no shadows)
- Item laid flat or on invisible mannequin
- NO person/body parts visible
- Maintain ALL specified colors, textures, and details
- Show ALL mentioned hardware, pockets, and features
- Capture the exact silhouette and fit described
- Ultra-high clarity and sharpness

Generate this exact item with precision.`;

  console.log(`Generating image with prompt: ${detailedPrompt.substring(0, 100)}...`);

  const data = await callGeminiAPI({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [
      {
        role: "user",
        content: detailedPrompt,
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
