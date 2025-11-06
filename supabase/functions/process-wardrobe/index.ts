import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { validateImage } from './validateImage.ts';
import { WARDROBE_PROMPTS } from '../_shared/prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DetectedItem {
  name: string;
  category: string;
  color: string;
  fabric?: string;
  texture?: string;
  pattern?: string;
  style_notes?: string;
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
    const validation = await validateImage(imageUrl, LOVABLE_API_KEY!);
    
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

    console.log(`Detected ${detectedItems.length} items`);

    // Step 2: Generate individual product images for each item using Gemini
    console.log('Step 2: Generating product images with Gemini...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const itemsWithImages: Array<DetectedItem & { imageUrl: string }> = [];

    for (let i = 0; i < detectedItems.length; i++) {
      const item = detectedItems[i];
      console.log(`Generating image for item ${i + 1}/${detectedItems.length}: ${item.name}`);
      
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
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        itemsWithImages.push({
          ...item,
          imageUrl: publicUrl
        });

        console.log(`Generated image for ${item.name}`);
      } catch (error) {
        console.error(`Failed to generate image for ${item.name}:`, error);
      }
    }

    if (itemsWithImages.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Failed to generate images for detected items',
        items: []
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = { items: itemsWithImages };
    
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
  // Use the public URL directly to avoid large base64 conversions
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to extract items from Gemini response');
  }

  const items = JSON.parse(jsonMatch[0]);
  return items;
}

async function generateProductImage(item: DetectedItem): Promise<Uint8Array> {
  const prompt = `Extract and isolate this clothing item: ${item.name}

CRITICAL REQUIREMENTS (CUTOUT RULES):
- Display item straight and front-facing
- Fully unfolded (not crumpled or folded)
- NO human, background, or other items visible
- Pure white background (#FFFFFF)
- Even lighting, minimal shadows
- Centered and fully in frame
- Should look like a professional product catalog photo

Item Details:
- Color: ${item.color}
- Material: ${item.fabric || 'fabric'}
- Pattern: ${item.pattern || 'solid'}
- Texture: ${item.texture || 'smooth'}
- Style: ${item.style_notes || 'N/A'}

Generate a clean product photo on pure white background, as if this item was photographed for an e-commerce catalog.`;

  console.log(`Generating image with prompt: ${prompt.substring(0, 100)}...`);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      modalities: ['image', 'text']
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini image generation error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
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
