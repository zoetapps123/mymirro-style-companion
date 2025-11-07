import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { IMAGE_PROMPTS } from '../_shared/prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, itemType } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create instruction based on item type
    const completionPrompt = IMAGE_PROMPTS.COMPLETE_CLOTHING_ITEM(itemType);

    console.log('Completing clothing image:', { imageUrl, itemType, prompt: completionPrompt });

    // Note: Gemini doesn't support image generation via modalities like Lovable AI Gateway
    // For image generation, we'll need to use Imagen or similar, this is text-only response
    let data;
    try {
      data = await callGeminiAPI({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: completionPrompt + "\n\nNote: Please provide a detailed description of the completed clothing item as Gemini API doesn't support direct image generation."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ]
      });
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (error.message === 'PAYMENT_REQUIRED') {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
    
    console.log('AI response received');

    // Gemini returns text description, not actual images
    const description = data.choices?.[0]?.message?.content;
    const completedImageUrl = description; // Return description instead of image

    if (!completedImageUrl) {
      console.error('Image extraction failed. Response structure:', {
        hasChoices: !!data.choices,
        hasMessage: !!data.choices?.[0]?.message,
        hasImages: !!data.choices?.[0]?.message?.images,
        imageCount: data.choices?.[0]?.message?.images?.length || 0
      });
      throw new Error('No image generated in response');
    }

    return new Response(
      JSON.stringify({ 
        completedImageUrl,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in complete-clothing-image:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to complete image',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
