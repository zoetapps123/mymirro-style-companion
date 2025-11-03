import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AI_API_ENDPOINT, getAIApiKey } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData, improvements, wardrobeItems, orientation, width, height } = await req.json();
    const apiKey = getAIApiKey();

    // Validate input
    if (!imageData || typeof imageData !== 'string') {
      return new Response(
        JSON.stringify({ error: 'imageData is required and must be a base64 data URL or http(s) URL' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isDataUrl = imageData.startsWith('data:image/');
    const isHttpUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
    if (!isDataUrl && !isHttpUrl) {
      return new Response(
        JSON.stringify({ error: 'Invalid imageData format. Provide data:image/* base64 or a public URL.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Elevating style with AI...');

    // Build wardrobe context
    let wardrobeContext = '';
    if (wardrobeItems && wardrobeItems.length > 0) {
      wardrobeContext = `\n\nAVAILABLE WARDROBE ITEMS (ONLY use these items for suggestions):
${wardrobeItems.map((item: any, idx: number) => `${idx + 1}. ${item.name} (${item.category}) - ${item.color || 'color not specified'}`).join('\n')}

IMPORTANT: When suggesting accessories or additional items, ONLY suggest items from the available wardrobe list above. DO NOT suggest random items that don't exist in the wardrobe.`;
    }

    const editPrompt = `Apply ONLY these QUICK STYLING FIXES to the outfit - DO NOT change the clothes completely:

${improvements}
${wardrobeContext}

🚨 ABSOLUTELY CRITICAL - IMAGE ORIENTATION REQUIREMENTS 🚨
YOU MUST FOLLOW THESE ORIENTATION RULES EXACTLY:

1. The original image shows a person in PORTRAIT orientation (VERTICAL/UPRIGHT/STANDING)
2. The person's HEAD is at the TOP of the image
3. The person's FEET are at the BOTTOM of the image
4. You MUST generate the enhanced image in the EXACT SAME PORTRAIT orientation
5. DO NOT rotate the output image by ANY angle (not 90°, not 180°, not any degrees)
6. The enhanced image MUST have the person STANDING VERTICALLY just like the input
7. If you see the person sideways or horizontal, you are doing it WRONG
8. The person must be UPRIGHT with head at top and feet at bottom
9. Keep the aspect ratio and orientation IDENTICAL to the input image
10. PORTRAIT MODE ONLY - The image should be TALLER than it is wide

STYLING REQUIREMENTS:
- ONLY apply the specific quick fixes mentioned (adding accessories, layering, minor adjustments)
- If suggesting accessories (bags, sunglasses, jewelry, etc.), ONLY use items from the "AVAILABLE WARDROBE ITEMS" list above
- DO NOT add random items that are not in the wardrobe
- DO NOT change the main clothing items completely
- Apply SUBTLE, under-1-minute fixes that would increase the style score to at least 4/5
- Make changes look natural and realistic
- Maintain original lighting, photo quality, and composition
- Goal: Show how quick styling fixes from their existing wardrobe can elevate the outfit, not replace it`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(AI_API_ENDPOINT, {
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
                { type: 'text', text: editPrompt },
                { type: 'image_url', image_url: { url: imageData } }
              ]
            }
          ],
          modalities: ['image', 'text']
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error (elevate-style):', response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI error', details: errText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Style elevation complete');

    const enhancedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!enhancedImage) {
      throw new Error('Failed to generate enhanced image');
    }

    return new Response(
      JSON.stringify({ enhancedImage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in elevate-style:', error);
    const isAbort = (error as any)?.name === 'AbortError' || (error as any)?.message?.includes('aborted');
    const status = isAbort ? 504 : 500;
    const msg = isAbort ? 'AI service timeout. Please try again.' : (error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
