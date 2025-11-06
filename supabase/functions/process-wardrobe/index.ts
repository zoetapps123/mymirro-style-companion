import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getAIApiKey } from '../_shared/ai-config.ts';
import { validateImage } from './validateImage.ts';
import { detectItemsWithBbox } from './detectItemsWithBbox.ts';
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

    // STEP 2: Detect items with bounding boxes (single fast AI call)
    const detectedItems = await detectItemsWithBbox(actualImageUrl, apiKey);
    console.log(`Detected ${detectedItems.length} items with bounding boxes`);

    if (detectedItems.length === 0) {
      throw new Error('No clothing items detected in the image');
    }

    // Return items with bboxes for client-side cropping (fast, no storage needed here)
    const processResult = {
      items: detectedItems,
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
