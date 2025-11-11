import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { validateImage } from './validateImage.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';
import { callGeminiAPI } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
  // Optional
  brand?: string;
  condition?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    console.error('Auth failed:', authError);
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Processing image with Gemini-only pipeline...');

    // Check cache
    const cacheKey = await generateCacheKey({ type: 'wardrobe_gemini_v2', imageUrl });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached result');
      return new Response(
        JSON.stringify({ success: true, ...cachedResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 0: Validate image (check for real human or clothing items)
    console.log('Step 0: Validating image...');
    const validation = await validateImage(imageUrl);
    
    if (!validation.isValidForExtraction) {
      console.log('Image validation failed:', validation.rejectionReason);
      return new Response(JSON.stringify({ 
        error: validation.rejectionReason || 'Image does not contain suitable content for wardrobe extraction',
        items: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Image validation passed:', validation.contentType);

    // Step 1: Detect items using Gemini Vision
    console.log('Step 1: Detecting items with Gemini Vision...');
    const detectedItems = await detectItemsWithGemini(imageUrl);
    
    if (!detectedItems || detectedItems.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No clothing items detected in the image',
        items: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Detected ${detectedItems.length} items from image`);

    // Step 1.5: Enhanced Smart Deduplication
    console.log('Step 1.5: Running enhanced smart deduplication...');
    const dedupeResult = await enhancedSmartDeduplication(detectedItems, user.id);

    if (dedupeResult.uniqueItems.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'All detected items already exist in your wardrobe',
        items: [],
        duplicatesSkipped: dedupeResult.duplicatesSkipped,
        skipReasons: dedupeResult.skipReasons
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ${dedupeResult.uniqueItems.length} unique items to process`);
    console.log(`⏭️  ${dedupeResult.duplicatesSkipped} duplicates skipped`);

    const uniqueDetectedItems = dedupeResult.uniqueItems;

    // Step 2: Generate individual product images for each item using Gemini (in parallel)
    console.log('Step 2: Generating product images with Gemini in parallel...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const itemGenerationPromises = uniqueDetectedItems.map(async (item, i) => {
      console.log(`Starting generation for item ${i + 1}/${uniqueDetectedItems.length}: ${item.name}`);
      
      try {
        const imageData = await generateProductImage(item);
        
        // Upload to Supabase storage
        const fileName = `${user.id}/wardrobe_gen_${Date.now()}_${i}_${item.name.replace(/\s+/g, '-')}.png`;
        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, imageData, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError) {
          console.error(`Upload error for ${item.name}:`, uploadError);
          return null;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        console.log(`Generated image for ${item.name}`);
        return {
          ...item,
          imageUrl: publicUrl
        };
      } catch (error) {
        console.error(`Failed to generate image for ${item.name}:`, error);
        return null;
      }
    });

    const results = await Promise.all(itemGenerationPromises);
    const itemsWithImages = results.filter(item => item !== null) as Array<DetectedItem & { imageUrl: string }>;

    if (itemsWithImages.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Failed to generate images for detected items',
        items: []
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize categories using the same logic as the database trigger (as fallback)
    const normalizeCategory = (category: string): string => {
      if (!category) return category;
      
      const lowerCat = category.toLowerCase();
      
      // Footwear → Shoes
      if (['footwear', 'foot wear', 'foot-wear'].includes(lowerCat)) return 'Shoes';
      
      // Various top variations → Tops
      if (['upper wear', 'upperwear', 'upper-wear', 'top', 'shirt', 'tshirt', 't-shirt', 'blouse', 'tee'].includes(lowerCat)) return 'Tops';
      
      // Various bottom variations → Bottoms
      if (['lower wear', 'lowerwear', 'lower-wear', 'bottom', 'pants', 'trouser', 'trousers', 'jean', 'chinos', 'shorts'].includes(lowerCat)) return 'Bottoms';
      
      // Various outer wear variations → Outerwear
      if (['outer wear', 'outerwear', 'outer-wear', 'jacket', 'coat', 'blazer', 'cardigan', 'sweater', 'hoodie'].includes(lowerCat)) return 'Outerwear';
      
      // Accessories variations → Accessories
      if (['accessory', 'accessorie'].includes(lowerCat)) return 'Accessories';
      
      // Dresses variations → Dresses
      if (['dress', 'gown'].includes(lowerCat)) return 'Dresses';
      
      // Keep as-is if already standard or unknown
      return category;
    };

    const normalizedItems = itemsWithImages.map(item => ({
      ...item,
      category: normalizeCategory(item.category)
    }));

    const result = { items: normalizedItems };
    
    // Cache result
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(setCachedResult(cacheKey, result));
    } else {
      await setCachedResult(cacheKey, result);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-wardrobe:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRateLimit = errorMessage.includes('Rate limit') || errorMessage.includes('429');
    const isCredits = errorMessage.includes('credits') || errorMessage.includes('402');
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        status: isRateLimit ? 429 : isCredits ? 402 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function detectItemsWithGemini(imageUrl: string): Promise<DetectedItem[]> {
  const data = await callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${WARDROBE_PROMPTS.DETECT_ITEMS}

Return ONLY a JSON array of items, no other text. Example format:
[
  {
    "name": "Blue Denim Jacket",
    "category": "Outerwear",
    "color": "#4A90E2",
    "fabric": "denim",
    "texture": "textured",
    "pattern": "solid",
    "style_notes": "Classic fit with button closure"
  }
]`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ]
  });

  const content = data.choices?.[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to extract items from Gemini response');
  }

  const items = JSON.parse(jsonMatch[0]);
  return items;
}

interface DuplicateCheckResult {
  uniqueItems: DetectedItem[];
  duplicatesSkipped: number;
  skipReasons: string[];
}

async function enhancedSmartDeduplication(
  detectedItems: DetectedItem[],
  userId: string
): Promise<DuplicateCheckResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: existingItems, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId);
  
  if (error || !existingItems || existingItems.length === 0) {
    console.log('No existing items, all detected items are unique');
    return {
      uniqueItems: detectedItems,
      duplicatesSkipped: 0,
      skipReasons: []
    };
  }
  
  const uniqueItems: DetectedItem[] = [];
  const skipReasons: string[] = [];
  
  for (const newItem of detectedItems) {
    let isDuplicate = false;
    let skipReason = '';
    
    // LEVEL 1: Exact name match
    const exactMatch = existingItems.find(
      e => e.name?.toLowerCase().trim() === newItem.name.toLowerCase().trim()
    );
    
    if (exactMatch) {
      isDuplicate = true;
      skipReason = `Exact name: "${newItem.name}"`;
    }
    
    // LEVEL 2: Enhanced Fingerprint Match
    if (!isDuplicate) {
      const fingerprintMatch = existingItems.find(existing => {
        const sameCategory = existing.category === newItem.category;
        const sameColorFamily = existing.color_family === newItem.color_family;
        const sameFabric = existing.fabric_primary?.toLowerCase() === newItem.fabric_primary?.toLowerCase();
        const sameFit = existing.fit_type === newItem.fit_type;
        const samePattern = existing.pattern_type === newItem.pattern_type;
        
        if (!sameCategory || !sameColorFamily || !sameFabric) return false;
        
        const sameSilhouette = existing.silhouette === newItem.silhouette;
        const sameClosure = existing.closure_type === newItem.closure_type;
        const sameLength = existing.length === newItem.length;
        
        const matchScore = [
          sameCategory, sameColorFamily, sameFabric, sameFit, samePattern,
          sameSilhouette, sameClosure, sameLength
        ].filter(Boolean).length;
        
        return matchScore >= 6;
      });
      
      if (fingerprintMatch) {
        isDuplicate = true;
        skipReason = `Fingerprint match: "${newItem.name}" = "${fingerprintMatch.name}"`;
      }
    }
    
    // LEVEL 3: Color Similarity
    if (!isDuplicate) {
      const colorSimilarMatch = existingItems.find(existing => {
        if (existing.category !== newItem.category) return false;
        if (existing.color_family !== newItem.color_family) return false;
        
        const distance = calculateColorDistance(
          existing.primary_color || existing.color || '#000000',
          newItem.primary_color
        );
        
        return distance < 30 && 
               existing.fabric_primary === newItem.fabric_primary &&
               existing.silhouette === newItem.silhouette;
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
    skipReasons
  };
}

function calculateColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return 999;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
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
${item.pattern_scale !== 'none' ? `- Scale: ${item.pattern_scale}` : ""}
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
    model: 'google/gemini-2.5-flash-image-preview',
    messages: [
      {
        role: 'user',
        content: detailedPrompt
      }
    ],
    modalities: ['image', 'text']
  });

  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    throw new Error('No image URL in Gemini response');
  }

  // Extract base64 data from data URL
  const base64Match = imageUrl.match(/^data:image\/[a-z]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid image data URL format');
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
