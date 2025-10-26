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
    const { items, focusItem } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Auto-generating outfits with:', { itemCount: items?.length, focusItem: focusItem?.name });

    // Separate items by category
    const tops = items.filter((item: any) => item.category === 'Tops' || item.category === 'Shirts');
    const bottoms = items.filter((item: any) => item.category === 'Bottoms' || item.category === 'Pants' || item.category === 'Skirts');
    const shoes = items.filter((item: any) => item.category === 'Shoes');
    const accessories = items.filter((item: any) => item.category === 'Accessories');
    const layers = items.filter((item: any) => item.category === 'Layers' || item.category === 'Jackets');

    const prompt = `You are a professional fashion stylist. Create outfit combinations using the following wardrobe items:

TOPS (${tops.length}): ${tops.map((t: any) => `${t.name} (${t.color})`).join(', ')}
BOTTOMS (${bottoms.length}): ${bottoms.map((b: any) => `${b.name} (${b.color})`).join(', ')}
SHOES (${shoes.length}): ${shoes.map((s: any) => `${s.name} (${s.color})`).join(', ')}
ACCESSORIES (${accessories.length}): ${accessories.map((a: any) => `${a.name} (${a.color})`).join(', ')}
LAYERS (${layers.length}): ${layers.map((l: any) => `${l.name} (${l.color})`).join(', ')}

${focusItem ? `FOCUS on creating outfits that include: ${focusItem.name} (${focusItem.category})` : ''}

Create 5 complete outfits for each category:
1. STYLE-BASED: Create outfits for different style aesthetics (Casual, Smart-Casual, Formal, Sporty, Trendy)
2. OCCASION-BASED: Create outfits for different occasions (Work, Date Night, Weekend, Party, Travel)
3. ITEM-BASED: Create outfits centered around key pieces

For each outfit:
- Select 3-5 items that work well together
- Ensure color coordination and style consistency
- Include item IDs from the wardrobe
- Label each outfit appropriately

Return structured outfit data.`;

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
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        itemIds: { type: 'array', items: { type: 'string' } },
                        type: { type: 'string', enum: ['style'] }
                      }
                    }
                  },
                  occasionOutfits: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        itemIds: { type: 'array', items: { type: 'string' } },
                        type: { type: 'string', enum: ['occasion'] }
                      }
                    }
                  },
                  itemBasedOutfits: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        itemIds: { type: 'array', items: { type: 'string' } },
                        type: { type: 'string', enum: ['item'] }
                      }
                    }
                  }
                },
                required: ['styleOutfits', 'occasionOutfits', 'itemBasedOutfits']
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
      occasionOutfits: mapOutfits(outfitData.occasionOutfits || []),
      itemBasedOutfits: mapOutfits(outfitData.itemBasedOutfits || [])
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
