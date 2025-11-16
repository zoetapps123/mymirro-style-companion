/**
 * Edge Function: predict-outfit-vibe
 * 
 * Role: Initial vibe prediction from outfit image (API Call #1 in Style Check flow)
 * 
 * Dependencies:
 * - Called by: StyleCheckHub.tsx (handleImageUpload)
 * - Uses: VIBE_PREDICTION_PROMPTS.PREDICT_OUTFIT_VIBE from _shared/prompts.ts
 * - Model: google/gemini-2.5-flash via Lovable AI Gateway
 * 
 * Input:
 * {
 *   imageData: string  // Base64 data URL (data:image/jpeg;base64,...)
 * }
 * 
 * Output:
 * {
 *   occasion: string,  // e.g., "Casual Outing", "Date Night"
 *   style: string,     // e.g., "Streetwear", "Minimalist"
 *   vibe: string,      // e.g., "Relaxed", "Edgy"
 *   comment: string    // Brief AI observation about the outfit
 * }
 * 
 * Flow:
 * 1. Validates imageData is provided
 * 2. Calls Gemini API with PREDICT_OUTFIT_VIBE prompt + image
 * 3. Parses JSON response from AI
 * 4. Returns prediction to client
 * 
 * Error Handling:
 * - 400: Missing imageData
 * - 429: Rate limit exceeded (RATE_LIMIT)
 * - 402: Payment required (PAYMENT_REQUIRED)
 * - 500: AI response parsing errors
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { VIBE_PREDICTION_PROMPTS } from '../_shared/prompts.ts';
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
    const { imageData } = await req.json();
    
    if (!imageData) {
      return new Response(JSON.stringify({ error: 'Image data is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI Call: Predict outfit vibe using Gemini Flash
    // Retry logic handles transient failures
    const data = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: VIBE_PREDICTION_PROMPTS.PREDICT_OUTFIT_VIBE
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 200
    }));

    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response');
      return new Response(JSON.stringify({ error: 'No prediction generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON from response
    // AI returns JSON within text, extract it using regex
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return new Response(JSON.stringify({ error: 'Invalid prediction format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prediction = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in predict-outfit-vibe:', error);
    
    if (error.message === 'RATE_LIMIT') {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (error.message === 'PAYMENT_REQUIRED') {
      return new Response(JSON.stringify({ error: 'Payment required' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Prediction failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});