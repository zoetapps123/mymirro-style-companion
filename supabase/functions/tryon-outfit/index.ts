import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AI_API_ENDPOINT, getAIApiKey } from '../_shared/ai-config.ts';
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
    const { userImage, outfitItems } = await req.json();
    const apiKey = getAIApiKey();

    console.log('Processing virtual try-on...');

    // Validate user image quality first
    const validationPrompt = IMAGE_PROMPTS.VALIDATE_TRYON_IMAGE;

    const validationResponse = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
      }),
    });

    const validationData = await validationResponse.json();
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

    // Generate virtual try-on using Gemini image editing
    const tryonPrompt = IMAGE_PROMPTS.GENERATE_TRYON(outfitItems);

    const tryonResponse = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    const tryonData = await tryonResponse.json();
    console.log('Try-on generation complete');

    const renderedImage = tryonData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!renderedImage) {
      throw new Error('Failed to generate try-on image');
    }

    return new Response(
      JSON.stringify({
        renderUrl: renderedImage,
        status: 'completed'
      }),
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
