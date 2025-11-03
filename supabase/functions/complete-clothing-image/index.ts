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
    const { imageUrl, itemType } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = getAIApiKey();

    // Create instruction based on item type
    const completionPrompt = IMAGE_PROMPTS.COMPLETE_CLOTHING_ITEM(itemType);

    console.log('Completing clothing image:', { imageUrl, itemType, prompt: completionPrompt });

    const response = await fetch(AI_API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: completionPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');
    console.log('Full AI response structure:', JSON.stringify(data, null, 2));
    console.log('Available response keys:', Object.keys(data));
    if (data.choices?.[0]) {
      console.log('First choice structure:', JSON.stringify(data.choices[0], null, 2));
    }

    const completedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

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
