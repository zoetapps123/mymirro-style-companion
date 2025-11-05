import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAIApiKey } from '../_shared/ai-config.ts';
import { validateImage } from './validateImage.ts';
import { detectItems } from './detectItems.ts';
import { generateComposite } from './generateComposite.ts';
import { detectCompositeItems } from './detectCompositeItems.ts';
import { matchItems } from './matchItems.ts';
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
    const cacheKey = await generateCacheKey({ type: 'wardrobe_process', imageUrl: actualImageUrl });
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

    // STEP 0: Image Validation
    const validationResult = await validateImage(actualImageUrl, apiKey);

    // STEP 1: Detect items from original image (detailed attributes)
    const detectedItems = await detectItems(actualImageUrl, apiKey);

    // STEP 2: Generate ONE composite image with all items
    const compositeResult = await generateComposite(actualImageUrl, detectedItems, apiKey);

    // STEP 3: Detect items in composite (to get actual positions)
    const compositeDetections = await detectCompositeItems(compositeResult.compositeImageUrl, apiKey);

    // STEP 4: Match original items to composite detections (correct labels + accurate positions)
    const matchedItems = matchItems(detectedItems, compositeDetections);

    // Cache the complete result
    const processResult = {
      items: matchedItems, // Items now have bbox from composite detection
      compositeImageUrl: compositeResult.compositeImageUrl,
      gridLayout: compositeResult.gridLayout, // Keep for fallback
      contentType: validationResult.contentType
    };
    await setCachedResult(cacheKey, processResult);

    return new Response(
      JSON.stringify({
        success: true,
        ...processResult
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
