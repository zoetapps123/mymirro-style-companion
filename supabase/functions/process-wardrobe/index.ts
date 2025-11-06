import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getAIApiKey, callGeminiAPI } from '../_shared/ai-config.ts';
import { validateImage } from './validateImage.ts';
import { detectItems } from './detectItems.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';

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
    const { imageData, imageUrl } = await req.json();
    const apiKey = getAIApiKey();

    const actualImageUrl = imageUrl || imageData;
    if (!actualImageUrl) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Processing image...');

    // Check cache for wardrobe processing
    const cacheKey = await generateCacheKey({ type: 'wardrobe_process_v4', imageUrl: actualImageUrl });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached wardrobe processing result');
      return new Response(
        JSON.stringify({
          success: true,
          ...cachedResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Validate Image (fast check)
    const validationResult = await validateImage(actualImageUrl, apiKey);
    console.log('Validation passed:', validationResult.contentType);

    // STEP 2: Detect items list
    const detectedItems = await detectItems(actualImageUrl, apiKey);
    console.log(`Detected ${detectedItems.length} items`);

    if (detectedItems.length === 0) {
      throw new Error('No clothing items detected in the image');
    }

    // STEP 3: Generate individual images for each item using Gemini
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Limit concurrency to reduce memory/CPU usage
    const CONCURRENCY = 2;

    async function processOne(item: any, i: number) {
      console.log(`Generating image for item ${i + 1}/${detectedItems.length}: ${item.name}`);
      try {
        const prompt = `Extract and isolate this ${item.category}: ${item.name}. 
Color: ${item.color}
${item.fabric ? `Fabric: ${item.fabric}` : ''}
${item.pattern ? `Pattern: ${item.pattern}` : ''}
${item.style_notes ? `Style: ${item.style_notes}` : ''}

Create a clean, isolated image of this item on a pure white background. Show the item clearly with all details visible.`;

        const response = await callGeminiAPI({
          model: 'google/gemini-2.5-flash-image',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: actualImageUrl } }
              ]
            }
          ],
          modalities: ['image', 'text']
        });

        const generatedImageUrl = response.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!generatedImageUrl) {
          console.error(`No image generated for item: ${item.name}`);
          return null;
        }

        const base64Data = generatedImageUrl.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

        const timestamp = Date.now();
        const fileName = `${user.id}/${timestamp}-${i}-${item.category}.png`;

        const { error: uploadError } = await supabase.storage
          .from('composite-images')
          .upload(fileName, binaryData, {
            contentType: 'image/png',
            upsert: false,
          });
        if (uploadError) {
          console.error(`Failed to upload item ${item.name}:`, uploadError);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('composite-images')
          .getPublicUrl(fileName);

        console.log(`Saved image for ${item.name}:`, urlData.publicUrl);
        return { ...item, processedImageUrl: urlData.publicUrl };
      } catch (error) {
        console.error(`Error processing item ${item.name}:`, error);
        return null;
      }
    }

    const results: (any | null)[] = new Array(detectedItems.length).fill(null);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(CONCURRENCY, detectedItems.length) }, async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= detectedItems.length) break;
        results[i] = await processOne(detectedItems[i], i);
      }
    });

    await Promise.all(workers);
    const itemsWithImages = results.filter((r) => r !== null) as any[];

    if (itemsWithImages.length === 0) {
      throw new Error('Failed to generate images for any items');
    }

    // Cache the result
    const processResult = {
      items: itemsWithImages,
      contentType: validationResult.contentType
    };
    // Write cache in background when possible to avoid blocking response
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(setCachedResult(cacheKey, processResult));
    } else {
      await setCachedResult(cacheKey, processResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        items: processResult.items,
        contentType: processResult.contentType
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in process-wardrobe:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Handle specific error types with appropriate status codes
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRateLimit = errorMessage.includes('Rate limit');
    const isCredits = errorMessage.includes('credits');
    const isValidation = errorMessage.includes('does not contain') || errorMessage.includes('Image quality');
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        status: isRateLimit ? 429 : isCredits ? 402 : isValidation ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
