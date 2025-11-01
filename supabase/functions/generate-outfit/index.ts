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
    const { 
      action,
      generationType, 
      occasion, 
      style, 
      anchorItem, 
      wardrobeItems, 
      maxOutfits,
      items, // For regenerate_image_only
      styleTag
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Handle regenerate image only action
    if (action === 'regenerate_image_only') {
      console.log('Regenerating outfit image only...');
      const outfitImageUrl = await generateCombinedOutfitImage(items, occasion, styleTag, LOVABLE_API_KEY);
      return new Response(
        JSON.stringify({ outfitImageUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating outfits:', { generationType, occasion, style, anchorItem: anchorItem?.name });

    // Step 1: Generate outfit combinations
    const prompt = buildOutfitGenerationPrompt(generationType, occasion, style, anchorItem, wardrobeItems, maxOutfits);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fashion stylist creating fashionable outfit combinations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_outfit_combinations',
            description: 'Generate multiple distinct outfit combinations',
            parameters: {
              type: 'object',
              properties: {
                outfits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      pieces: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            wardrobeItemId: { type: 'string' },
                            category: { type: 'string' },
                            role: { type: 'string' }
                          },
                          required: ['wardrobeItemId', 'category', 'role']
                        }
                      },
                      reasoning: { type: 'string' },
                      styleTag: { type: 'string' }
                    },
                    required: ['pieces', 'reasoning', 'styleTag']
                  }
                },
                totalGenerated: { type: 'number' }
              },
              required: ['outfits', 'totalGenerated']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_outfit_combinations' } }
      })
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in a moment.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ 
        error: 'AI credits depleted. Please add credits to continue.' 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!response.ok) {
      throw new Error('Failed to generate outfits');
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);

    console.log(`Generated ${result.totalGenerated} outfits`);

    // Step 2: Generate combined images for each outfit
    const outfitsWithImages = [];

    for (const outfit of result.outfits) {
      const outfitItems = outfit.pieces.map((piece: any) => 
        wardrobeItems.find((item: any) => item.id === piece.wardrobeItemId)
      ).filter(Boolean);

      const outfitImageUrl = await generateCombinedOutfitImage(
        outfitItems, 
        occasion || style, 
        outfit.styleTag,
        LOVABLE_API_KEY
      );

      outfitsWithImages.push({
        ...outfit,
        items: outfitItems,
        preview_image_url: outfitImageUrl
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        outfits: outfitsWithImages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-outfit:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildOutfitGenerationPrompt(
  generationType: string,
  occasion?: string,
  style?: string,
  anchorItem?: any,
  wardrobeItems?: any[],
  maxOutfits?: number
): string {
  const targetText = generationType === 'occasion' 
    ? `OCCASION: ${occasion}`
    : generationType === 'style'
    ? `STYLE: ${style}`
    : `FEATURING THIS ANCHOR ITEM: ${anchorItem.name}`;

  const items = wardrobeItems || [];

  return `You are a professional fashion stylist. Create ${maxOutfits || 'as many as viable'} DISTINCT, HIGH-QUALITY outfit combinations for:

${targetText}

AVAILABLE WARDROBE ITEMS:
${items.map((item: any) => `
- ID: ${item.id}, Name: ${item.name}
  Category: ${item.category}
  Color: ${item.color}
  Fabric: ${item.fabric || 'N/A'}
  Pattern: ${item.pattern || 'solid'}
`).join('\n')}

OUTFIT CREATION RULES:
✅ Each outfit MUST include:
   - At least 1 item (for dresses/co-ords) OR
   - At least 2 items (top + bottom minimum)
   - Maximum 1 item per category (1 top, 1 bottom, 1 layer, 1 shoes, 1 accessory)

✅ Fashion Quality Standards:
   - Color coordination (complementary, analogous, or monochromatic)
   - Fabric compatibility (don't mix overly casual with formal)
   - Pattern balance (max 1-2 patterns per outfit)
   - Occasion/style appropriateness
   - Seasonal suitability

✅ Variety Requirements:
   - Each outfit must be VISUALLY DISTINCT
   - Vary color palettes across outfits
   - Don't reuse the same item in multiple outfits unless necessary
   - Explore different silhouettes

❌ REJECT outfits that:
   - Clash in color or style
   - Are inappropriate for the occasion
   - Repeat too many items from previous outfits
   - Break the 1-per-category rule

Return outfit combinations with pieces (wardrobeItemId, category, role), reasoning, and styleTag.`;
}

async function generateCombinedOutfitImage(
  items: any[],
  occasion: string,
  styleTag: string,
  apiKey: string
): Promise<string> {
  console.log('Generating combined outfit image...');

  const prompt = `Create a professional flat-lay outfit image for the following combination:

OUTFIT ITEMS:
${items.map((item: any) => `
- ${item.name} (${item.category})
  Color: ${item.color}
  Fabric: ${item.fabric || 'N/A'}
  Pattern: ${item.pattern || 'solid'}
`).join('\n')}

VISUAL REQUIREMENTS:

**LAYOUT & ARRANGEMENT**
- Pure white background (#FFFFFF)
- All items arranged in a flat-lay composition
- Items should be positioned to suggest how they'd be worn together
- LAYERING ORDER (bottom to top):
  1. Bottoms (jeans, skirts, pants) - positioned at bottom
  2. Tops (shirts, blouses) - positioned above bottoms
  3. Layers (jackets, cardigans) - positioned over tops if present
  4. Shoes - positioned at the very bottom or sides
  5. Accessories - positioned around main garments

**SPACING & COMPOSITION**
- Items should overlap slightly to show layering
- Leave subtle spacing between items for clarity
- Center the composition in the frame
- Items fill 75-85% of canvas

**LIGHTING & QUALITY**
- Even, soft lighting with no harsh shadows
- Colors accurate to hex codes provided
- High resolution, sharp details
- Professional e-commerce quality

**STYLE CONSISTENCY**
- All items should appear to be part of a cohesive outfit
- Maintain consistent scale/perspective across items
- Show fabric textures clearly`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
          content: prompt
        }
      ],
      modalities: ['image', 'text']
    })
  });

  if (!response.ok) {
    console.error('Failed to generate outfit image');
    return '';
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  return imageUrl || '';
}
