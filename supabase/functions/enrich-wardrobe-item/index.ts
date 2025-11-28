import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalImageUrl, category, itemName, userContext } = await req.json();
    
    console.log(`PHASE 2 ENRICHMENT: ${itemName} (${category}) for ${userContext?.gender || 'unknown'} user`);

    const ENRICHMENT_PROMPT = `You are analyzing a ${category} item to extract exactly 15 core styling metadata fields.

═══════════════════════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════════════════════
Item: ${itemName}
Category: ${category}
${userContext?.gender ? `User Gender: ${userContext.gender}` : ''}
${userContext?.age_range ? `User Age Range: ${userContext.age_range}` : ''}

═══════════════════════════════════════════════════════════════════════
YOUR TASK: Extract 15 Core Styling Fields
═══════════════════════════════════════════════════════════════════════

**1. color** (string):
   - Identify the exact color with confidence
   - Use precise shade names when the color has a distinct shade (hot pink, navy blue, mustard yellow, lavender, turquoise)
   - Use simple names when the item is truly that color (black, white, pink, blue, red)
   - Be accurate, not artificially specific
   - Examples: "black", "hot pink", "navy blue", "dusty rose", "turquoise", "burgundy"

**2. pattern_type** (string):
   - Categorize: solid | stripes | polka_dots | floral | geometric | abstract | plaid | checkered | animal_print | tie_dye | camouflage | paisley | houndstooth | tribal | mixed
   - If no pattern, use "solid"

**3. pattern_description** (string):
   - Describe pattern density (sparse, moderate, dense, all-over)
   - Describe position (chest only, scattered, all-over, border, placement print)
   - Describe scale (small, medium, large dots/stripes/florals)
   - Include pattern colors if different from base color
   - Example: "small scattered white dots, sparse density" or "dense vertical navy stripes, thin width"
   - If solid, use "solid color, no pattern"

**4. fabric_primary** (string):
   - Options: cotton | polyester | linen | wool | denim | silk | leather | synthetic | knit | jersey | fleece | velvet | satin | chiffon | georgette | rayon | blend
   - If unsure, use most likely based on appearance

**5. texture** (string):
   - Options: smooth | rough | soft | stiff | stretchy | ribbed | fuzzy | shiny | matte | textured | woven
   
**6. fit_type** (string):
   - Options: slim | fitted | regular | relaxed | oversized | loose | tailored | bodycon | flowy

**7. length** (string):
   - For tops: cropped | waist_length | hip_length | thigh_length | knee_length | midi | maxi | full_length
   - For bottoms: shorts | above_knee | knee_length | below_knee | ankle_length | full_length
   - For dresses: mini | above_knee | knee_length | midi | maxi | floor_length

**8. formality_level** (string):
   - Options: casual | smart_casual | business_casual | semi_formal | formal | athletic | loungewear
   
**9. suitable_occasions** (array of strings):
   - Select 2-5 occasions this item is appropriate for
   - Consider user gender and age when determining occasions
   - Options: "everyday", "work", "office", "date_night", "party", "formal_event", "outdoor", "gym", "sports", "beach", "travel", "brunch", "evening_out", "casual_dinner", "wedding_guest", "college", "festive", "religious", "cocktail"

**10. style_aesthetic** (array of strings):
   - Select 1-3 style aesthetics this item embodies
   - Options: "casual", "streetwear", "minimalist", "bohemian", "preppy", "edgy", "classic", "sporty", "elegant", "vintage", "modern", "artsy", "grunge", "romantic", "ethnic", "contemporary", "formal", "chic"

**11. season** (array of strings):
   - Select applicable seasons (1-4)
   - Options: "spring", "summer", "fall", "winter"

**12. weather_suitability** (string):
   - Options: hot | warm | mild | cool | cold | all_weather

**13. item_type** (string):
   - Dynamic specific type: e.g., "T-shirt", "Jeans", "Sneakers", "Kurta", "Palazzo", "Watch", "Handbag", "Saree", "Sherwani"
   - Be specific, not generic

**14. style_notes_detailed** (string):
   - A 50-150 character styling suggestion
   - Example: "Pairs well with slim dark jeans and white sneakers for a clean casual look"
   - Example: "Perfect with high-waisted trousers and heels for a polished office outfit"

**15. category** (string):
   - Normalize to one of: Tops | Bottoms | Outerwear | Dresses | Shoes | Accessories
   - Based on: ${category}

═══════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════
1. Extract ALL 15 fields - do not skip any
2. Be accurate with color - if it's pink, say "pink"; if it's hot pink, say "hot pink"
3. Pattern description should be detailed and descriptive
4. Consider user context (gender, age) when determining occasions
5. If uncertain, use neutral/general values rather than guessing

Use the return_styling_metadata function to return structured output.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_styling_metadata',
          description: 'Return 15 core styling metadata fields for outfit generation',
          parameters: {
            type: 'object',
            properties: {
              color: { type: 'string', description: 'Accurate color name - simple or specific shade' },
              pattern_type: { type: 'string', description: 'Pattern category' },
              pattern_description: { type: 'string', description: 'Detailed pattern description with density, position, scale' },
              fabric_primary: { type: 'string', description: 'Primary fabric type' },
              texture: { type: 'string', description: 'Texture feel' },
              fit_type: { type: 'string', description: 'How the item fits' },
              length: { type: 'string', description: 'Length of the item' },
              formality_level: { type: 'string', description: 'Formality level' },
              suitable_occasions: { type: 'array', items: { type: 'string' }, description: '2-5 suitable occasions' },
              style_aesthetic: { type: 'array', items: { type: 'string' }, description: '1-3 style aesthetics' },
              season: { type: 'array', items: { type: 'string' }, description: 'Applicable seasons' },
              weather_suitability: { type: 'string', description: 'Weather suitability' },
              item_type: { type: 'string', description: 'Specific item type' },
              style_notes_detailed: { type: 'string', description: '50-150 char styling suggestion' },
              category: { type: 'string', description: 'Normalized category' }
            },
            required: ['color', 'pattern_type', 'pattern_description', 'fabric_primary', 'texture', 'fit_type', 'length', 
                      'formality_level', 'suitable_occasions', 'style_aesthetic', 'season', 'weather_suitability', 
                      'item_type', 'style_notes_detailed', 'category']
          }
        }
      }
    ];

    const data = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ENRICHMENT_PROMPT },
            { type: 'image_url', image_url: { url: originalImageUrl } }
          ]
        }
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'return_styling_metadata' } }
    });

    const functionCall = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (!functionCall) {
      console.error('No function call in response');
      return new Response(
        JSON.stringify({ error: 'No function call returned', enrichedMetadata: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const enrichedMetadata = JSON.parse(functionCall.arguments);
    console.log(`PHASE 2 SUCCESS: Extracted 15 fields for ${itemName}`);
    console.log(`Color: ${enrichedMetadata.color}, Pattern: ${enrichedMetadata.pattern_type}`);

    return new Response(
      JSON.stringify({ enrichedMetadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        enrichedMetadata: {} // Return empty metadata on error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
