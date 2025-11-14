import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { IMAGE_PROMPTS } from '../_shared/prompts.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userImage, outfitItems } = await req.json();

    console.log('Processing virtual try-on...');

    // Check cache first
    const cacheKey = await generateCacheKey({ type: 'tryon', userImage, outfitItems });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached try-on result');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user image quality first
    const validationPrompt = IMAGE_PROMPTS.VALIDATE_TRYON_IMAGE;

    const validationData = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: validationPrompt },
            { type: 'image_url', image_url: { url: userImage } }
          ]
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'validate_image',
            description: 'Validate image suitability for try-on',
            parameters: {
              type: 'object',
              properties: {
                suitable: { type: 'boolean' },
                reason: { type: 'string' }
              },
              required: ['suitable']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'validate_image' } }
    }));
    const validation = validationData.choices?.[0]?.message?.tool_calls?.[0];
    const isValid = validation ? JSON.parse(validation.function.arguments) : null;

    if (!isValid?.suitable) {
      return new Response(
        JSON.stringify({ 
          error: 'Image not suitable for try-on',
          reason: isValid?.reason || 'Please upload a clear, full-length photo in good lighting.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate virtual try-on using Gemini image generation
    const tryonPrompt = IMAGE_PROMPTS.GENERATE_TRYON(outfitItems);

    const tryonData = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: tryonPrompt },
            { type: 'image_url', image_url: { url: userImage } }
          ]
        }
      ],
      modalities: ['image', 'text']
    }));
    
    console.log('Try-on generation complete');

    // Extract generated image from Gemini response
    const renderedImage = tryonData.choices?.[0]?.message?.images?.[0]?.image_url?.url || userImage;

    if (!renderedImage) {
      throw new Error('Failed to generate try-on image');
    }

    const result = {
      renderUrl: renderedImage,
      status: 'completed'
    };

    // Cache the result
    await setCachedResult(cacheKey, result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in tryon-outfit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
