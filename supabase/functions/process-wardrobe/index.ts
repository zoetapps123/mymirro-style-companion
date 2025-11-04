import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAIApiKey } from '../_shared/ai-config.ts';
import { validateImage } from './validateImage.ts';
import { detectItems } from './detectItems.ts';
import { generateComposite } from './generateComposite.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';

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

    // STEP 0: Image Validation
    const validationResult = await validateImage(actualImageUrl, apiKey);

    // STEP 1: Item Detection
    const detectedItems = await detectItems(actualImageUrl, apiKey);

    // STEP 2: Generate Composite Image
    const compositeResult = await generateComposite(actualImageUrl, detectedItems, apiKey);

    return new Response(
      JSON.stringify({
        success: true,
        items: detectedItems,
        compositeImageUrl: compositeResult.compositeImageUrl,
        gridLayout: compositeResult.gridLayout,
        contentType: validationResult.contentType
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
