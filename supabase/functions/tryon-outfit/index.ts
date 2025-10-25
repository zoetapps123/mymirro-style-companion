import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Processing virtual try-on...');

    // Validate user image quality first
    const validationPrompt = `Analyze this image for virtual try-on suitability:
1. Is it a clear, full-length photo?
2. Is the lighting good?
3. Is the person visible and not cropped?

Respond with a boolean 'suitable' and a 'reason' if not suitable.`;

    const validationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
    const tryonPrompt = `Apply these clothing items to the person in the image realistically:
${outfitItems.map((item: any) => `- ${item.category}: ${item.name} (${item.color})`).join('\n')}

Maintain:
- Natural fabric fit and drape
- Correct perspective and body proportions
- Original skin tone and features
- Realistic shadows and lighting
- Professional fashion photography quality`;

    const tryonResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
