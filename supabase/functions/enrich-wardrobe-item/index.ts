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
    const { originalImageUrl, category, coreMetadata } = await req.json();
    
    console.log(`PHASE 2 ENRICHMENT: Starting for ${coreMetadata.name} (${category})`);

    const ENRICHMENT_PROMPT = `Analyze this ${category} item for DETAILED METADATA ONLY.

You already have this CORE info from Phase 1:
- Name: ${coreMetadata.name}
- Category: ${category}
- Primary Color: ${coreMetadata.primary_color_name} (${coreMetadata.primary_color})
- Color Family: ${coreMetadata.color_family}
- Fabric: ${coreMetadata.fabric_primary}
- Pattern: ${coreMetadata.pattern_type}
- Style: ${coreMetadata.style_aesthetic?.join(', ')}
- Formality: ${coreMetadata.formality_level}
- Occasions: ${coreMetadata.suitable_occasions?.join(', ')}

Now extract ALL DETAILED ATTRIBUTES (37 fields):

COLOR DETAILS:
- secondary_colors: Array of hex codes for accent colors
- color_distribution: Array of percentages [primary%, secondary%, tertiary%]
- pattern_colors: Array of hex codes if patterned

FABRIC DETAILS:
- fabric_weight: lightweight | medium | heavy
- material_finish: matte | glossy | textured | distressed
- texture: smooth | rough | soft | stiff | stretchy

FIT & SILHOUETTE:
- fit_type: slim | regular | relaxed | oversized | tailored
- silhouette: fitted | straight | A-line | flowy | structured
- length: ${category === 'Tops' ? 'crop | hip | below_hip | tunic' : category === 'Bottoms' ? 'shorts | knee | midi | ankle | floor' : category === 'Outerwear' ? 'waist | hip | thigh | knee | ankle' : category === 'Dresses' ? 'mini | knee | midi | maxi' : 'N/A'}

${category === 'Tops' || category === 'Dresses' || category === 'Outerwear' ? `TOPS/DRESSES/OUTERWEAR SPECIFIC:
- neckline: crew | v_neck | scoop | boat | off_shoulder | halter | turtleneck | collar
- sleeve_type: sleeveless | short | three_quarter | long | cap | bell | bishop
- collar_type: none | standard | mandarin | peter_pan | shawl | notched | spread` : ''}

${category === 'Bottoms' ? `BOTTOMS SPECIFIC:
- rise: low | mid | high
- waist_style: elastic | button | zipper | drawstring | belted` : ''}

${category === 'Shoes' ? `SHOES SPECIFIC:
- heel_type: flat | low | mid | high | platform | wedge | stiletto
- toe_style: round | pointed | square | open | peep` : ''}

CONSTRUCTION DETAILS:
- closure_type: button | zipper | pullover | tie | snap | hook | velcro | lace_up
- pocket_details: none | side | patch | welt | cargo | hidden | kangaroo
- hardware_details: none | buttons | zippers | buckles | studs | grommets | chains
- embellishments: none | embroidery | sequins | beads | lace | ruffles | fringe

ADDITIONAL METADATA:
- special_features: Array ["water_resistant", "reversible", "convertible", etc.]
- style_notes_detailed: Detailed styling description (50-100 chars)
- season: Array of seasons ["spring", "summer", "fall", "winter"]
- weather_suitability: hot | warm | mild | cool | cold | all_weather
- brand: Brand name if visible, otherwise "unknown"
- condition: excellent | good | fair | worn

Use the return_detailed_metadata function to return structured output.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_detailed_metadata',
          description: 'Return detailed metadata for wardrobe item',
          parameters: {
            type: 'object',
            properties: {
              // Color details
              secondary_colors: { type: 'array', items: { type: 'string' }, description: 'Hex codes for secondary colors' },
              color_distribution: { type: 'array', items: { type: 'number' }, description: 'Percentage distribution' },
              pattern_colors: { type: 'array', items: { type: 'string' }, description: 'Pattern color hex codes' },
              
              // Fabric details
              fabric_weight: { type: 'string', description: 'Fabric weight' },
              material_finish: { type: 'string', description: 'Material finish type' },
              texture: { type: 'string', description: 'Texture description' },
              
              // Fit details
              fit_type: { type: 'string', description: 'Fit style' },
              silhouette: { type: 'string', description: 'Overall silhouette' },
              length: { type: 'string', description: 'Length description' },
              
              // Category-specific
              neckline: { type: 'string', description: 'Neckline style (tops/dresses)' },
              sleeve_type: { type: 'string', description: 'Sleeve type (tops/dresses/outerwear)' },
              collar_type: { type: 'string', description: 'Collar style' },
              rise: { type: 'string', description: 'Rise level (bottoms)' },
              waist_style: { type: 'string', description: 'Waist closure (bottoms)' },
              heel_type: { type: 'string', description: 'Heel style (shoes)' },
              toe_style: { type: 'string', description: 'Toe style (shoes)' },
              
              // Construction
              closure_type: { type: 'string', description: 'Closure mechanism' },
              pocket_details: { type: 'string', description: 'Pocket description' },
              hardware_details: { type: 'string', description: 'Hardware details' },
              embellishments: { type: 'string', description: 'Embellishment details' },
              
              // Additional
              special_features: { type: 'array', items: { type: 'string' }, description: 'Special features' },
              style_notes_detailed: { type: 'string', description: 'Detailed styling notes' },
              season: { type: 'array', items: { type: 'string' }, description: 'Suitable seasons' },
              weather_suitability: { type: 'string', description: 'Weather appropriateness' },
              brand: { type: 'string', description: 'Brand name' },
              condition: { type: 'string', description: 'Item condition' }
            },
            required: ['fabric_weight', 'material_finish', 'texture', 'fit_type', 'silhouette', 'closure_type', 'season', 'weather_suitability', 'condition']
          }
        }
      }
    ];

    const data = await callGeminiAPI({
      model: 'gemini-2.0-flash-exp',
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
      tool_choice: { type: 'function', function: { name: 'return_detailed_metadata' } }
    });

    const functionCall = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (!functionCall) {
      console.error('No function call in response');
      return new Response(
        JSON.stringify({ error: 'No function call returned', detailedMetadata: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const detailedMetadata = JSON.parse(functionCall.arguments);
    console.log(`PHASE 2 SUCCESS: Extracted ${Object.keys(detailedMetadata).length} detailed fields`);

    return new Response(
      JSON.stringify({ detailedMetadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        detailedMetadata: {} // Return empty metadata on error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
