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
    const { items } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Auto-generating outfits with:', { itemCount: items?.length });

    // Separate items by category
    const tops = items.filter((item: any) => item.category === 'Tops' || item.category === 'Shirts');
    const bottoms = items.filter((item: any) => item.category === 'Bottoms' || item.category === 'Pants' || item.category === 'Skirts');
    const shoes = items.filter((item: any) => item.category === 'Shoes');
    const accessories = items.filter((item: any) => item.category === 'Accessories');
    const layers = items.filter((item: any) => item.category === 'Layers' || item.category === 'Jackets');

    const prompt = `You are a professional fashion stylist with deep knowledge of fashion trends, color theory, and style principles. Create curated outfit combinations using the following wardrobe items:

TOPS (${tops.length}): ${tops.map((t: any) => `ID:${t.id} - ${t.name} (${t.color})`).join(', ')}
BOTTOMS (${bottoms.length}): ${bottoms.map((b: any) => `ID:${b.id} - ${b.name} (${b.color})`).join(', ')}
SHOES (${shoes.length}): ${shoes.map((s: any) => `ID:${s.id} - ${s.name} (${s.color})`).join(', ')}
ACCESSORIES (${accessories.length}): ${accessories.map((a: any) => `ID:${a.id} - ${a.name} (${a.color})`).join(', ')}
LAYERS (${layers.length}): ${layers.map((l: any) => `ID:${l.id} - ${l.name} (${l.color})`).join(', ')}

CRITICAL RULES:
1. NEVER include more than ONE item from the same category in a single outfit (e.g., no two tops, no two bottoms)
2. Each outfit must be complete and wearable
3. Ensure color coordination and style consistency
4. EVERY outfit MUST have a unique, creative, descriptive name (2-3 words max)

Create 5 complete outfits for each category:

1. STYLE-BASED OUTFITS - Give each a name like:
   "Minimalist Maven", "Urban Edge", "Timeless Classic", "Everyday Ease", "Bold Statement"

2. OCCASION-BASED OUTFITS - Give each a name like:
   "Boardroom Boss", "Date Night Charm", "Weekend Warrior", "Party Ready", "Jet Setter"

NAMING EXAMPLES:
- "Coastal Breeze" (relaxed, breezy style)
- "Midnight Elegance" (dark, sophisticated evening)
- "Golden Hour" (warm-toned, glowing aesthetic)
- "Monochrome Magic" (single color palette)
- "Power Play" (confident, commanding presence)

For each outfit:
- Select 3-5 items from DIFFERENT categories only
- Ensure excellent color coordination
- Match the style aesthetic or occasion perfectly
- Use item IDs from the wardrobe
- REQUIRED: Give it a unique, creative name (2-3 words)

Return structured outfit data with creative names for ALL outfits.`;

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
            content: 'You are a professional fashion stylist who creates cohesive, wearable outfit combinations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_outfit_collections',
              description: 'Create collections of outfit combinations',
              parameters: {
                type: 'object',
                properties: {
                  styleOutfits: {
                    type: 'array',
                    description: 'Array of 5 style-based outfits, each with a unique creative name',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique identifier' },
                        label: { 
                          type: 'string', 
                          description: 'Creative 2-3 word outfit name (e.g., "Urban Edge", "Minimalist Maven")'
                        },
                        itemIds: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Array of item IDs from different categories'
                        },
                        type: { type: 'string', enum: ['style'] }
                      },
                      required: ['id', 'label', 'itemIds', 'type']
                    }
                  },
                  occasionOutfits: {
                    type: 'array',
                    description: 'Array of 5 occasion-based outfits, each with a unique creative name',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique identifier' },
                        label: { 
                          type: 'string', 
                          description: 'Creative 2-3 word outfit name (e.g., "Date Night Charm", "Boardroom Boss")'
                        },
                        itemIds: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Array of item IDs from different categories'
                        },
                        type: { type: 'string', enum: ['occasion'] }
                      },
                      required: ['id', 'label', 'itemIds', 'type']
                    }
                  }
                },
                required: ['styleOutfits', 'occasionOutfits']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_outfit_collections' } }
      }),
    });

    const data = await response.json();
    console.log('Outfit generation response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const outfitData = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!outfitData) {
      throw new Error('Failed to generate outfits');
    }

    // Map item IDs to actual items
    const mapOutfits = (outfits: any[]) => outfits.map(outfit => ({
      ...outfit,
      items: outfit.itemIds.map((id: string) => items.find((item: any) => item.id === id)).filter(Boolean)
    }));

    const result = {
      styleOutfits: mapOutfits(outfitData.styleOutfits || []),
      occasionOutfits: mapOutfits(outfitData.occasionOutfits || [])
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auto-generate-outfits:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
