import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Processing wardrobe item...');

    // First, extract clothing details and category
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                text: 'Analyze this clothing item and provide: 1) Item name (e.g., "White Oxford Shirt"), 2) Category (choose from: Tops, Bottoms, Layers, Dresses, Shoes, Accessories), 3) Primary color. Return ONLY a JSON object with keys: name, category, color (as hex code).'
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_clothing_info',
              description: 'Extract clothing item information',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the clothing item' },
                  category: { 
                    type: 'string', 
                    enum: ['Tops', 'Bottoms', 'Layers', 'Dresses', 'Shoes', 'Accessories'],
                    description: 'Category of clothing' 
                  },
                  color: { type: 'string', description: 'Primary color as hex code' }
                },
                required: ['name', 'category', 'color']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_clothing_info' } }
      }),
    });

    const analysisData = await analysisResponse.json();
    console.log('Analysis response:', analysisData);

    const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
    const clothingInfo = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!clothingInfo) {
      throw new Error('Failed to extract clothing information');
    }

    // Generate image with white background using Nano banana
    const imageGenResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              {
                type: 'text',
                text: `Extract this clothing item and place it on a clean white background. Remove any person, background, or unnecessary elements. Keep only the clothing item centered and well-lit.`
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    const imageGenData = await imageGenResponse.json();
    console.log('Image generation response received');

    const processedImageUrl = imageGenData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!processedImageUrl) {
      throw new Error('Failed to generate processed image');
    }

    return new Response(
      JSON.stringify({
        ...clothingInfo,
        processedImageUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-wardrobe:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});