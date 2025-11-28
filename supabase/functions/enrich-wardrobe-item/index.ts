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
    const { originalImageUrl, category, visualMetadata } = await req.json();
    
    console.log(`PHASE 2 SEMANTIC ENRICHMENT: ${visualMetadata.item_name} (${category})`);

    const SEMANTIC_ENRICHMENT_PROMPT = `You are analyzing a ${category} item to add SEMANTIC and CONTEXTUAL metadata.

═══════════════════════════════════════════════════════════════════════
PHASE 1 VISUAL METADATA (AUTHORITATIVE - DO NOT CONTRADICT)
═══════════════════════════════════════════════════════════════════════
The following visual facts have been extracted and are AUTHORITATIVE:
- Name: ${visualMetadata.item_name}
- Category: ${category}
- Primary Color: ${visualMetadata.primary_color_name} (${visualMetadata.primary_color_hex})
- Color Palette: ${visualMetadata.color_palette?.join(", ")}
- Pattern: ${visualMetadata.pattern_type}
- Pattern Geometry: ${visualMetadata.pattern_geometry}
- Fit: ${visualMetadata.fit_type}
- Silhouette: ${visualMetadata.silhouette}
- Length: ${visualMetadata.length}
${visualMetadata.neckline ? `- Neckline: ${visualMetadata.neckline}` : ""}
${visualMetadata.sleeve_type ? `- Sleeves: ${visualMetadata.sleeve_type}` : ""}
${visualMetadata.closure_type ? `- Closure: ${visualMetadata.closure_type}` : ""}
- Visual Summary: ${visualMetadata.visual_summary}

═══════════════════════════════════════════════════════════════════════
YOUR TASK: SEMANTIC ENRICHMENT ONLY
═══════════════════════════════════════════════════════════════════════

Using BOTH the image and the visual metadata above, infer SEMANTIC properties.
You may refine fabric details but DO NOT contradict the visual facts above.

**FABRIC REFINEMENT (can add detail):**
- fabric_primary: cotton | polyester | linen | wool | denim | silk | leather | synthetic | knit | jersey | fleece | velvet | satin
- fabric_weight: lightweight | medium | heavy
- material_finish: matte | glossy | textured | distressed | washed | faded
- texture: smooth | rough | soft | stiff | stretchy | ribbed | fuzzy

**SEMANTIC INFERENCE (this is what we need from you):**
- style_aesthetic: Array of 1-3 aesthetics that this item embodies
  Options: ["casual", "streetwear", "minimalist", "bohemian", "preppy", "edgy", "classic", "sporty", "elegant", "vintage", "modern", "artsy", "grunge", "romantic"]
  
- formality_level: Where would this be appropriate?
  Options: casual | smart_casual | business_casual | semi_formal | formal | athletic | loungewear
  
- suitable_occasions: Array of 2-5 occasions
  Options: ["everyday", "work", "office", "date_night", "party", "formal_event", "outdoor", "gym", "sports", "beach", "travel", "brunch", "evening_out", "casual_dinner", "wedding_guest"]
  
- season: Array of applicable seasons
  Options: ["spring", "summer", "fall", "winter"]
  
- weather_suitability: What weather is this suited for?
  Options: hot | warm | mild | cool | cold | all_weather
  
- brand: If a brand logo/name is visible, name it. Otherwise "unknown"
  
- condition: Based on visible wear/tear
  Options: excellent | good | fair | worn
  
- special_features: Array of special characteristics
  Options: ["water_resistant", "reversible", "convertible", "quick_dry", "stretch", "lined", "breathable", "insulated", "wrinkle_resistant", "stain_resistant"]
  
- style_notes_detailed: A 50-100 character styling suggestion (e.g., "Pairs well with slim dark jeans and white sneakers for a clean casual look")

═══════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════
1. Do NOT change category, colors, pattern, fit, silhouette, or length from Phase 1
2. Only infer semantics that logically follow from visible design
3. Do NOT use stereotypes - base on actual visual elements
4. If uncertain, use more general/neutral values

Use the return_semantic_metadata function to return structured output.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_semantic_metadata',
          description: 'Return semantic/contextual metadata for wardrobe item',
          parameters: {
            type: 'object',
            properties: {
              // Fabric refinement (can add detail to visual)
              fabric_primary: { type: 'string' },
              fabric_weight: { type: 'string' },
              material_finish: { type: 'string' },
              texture: { type: 'string' },
              
              // Pure semantic fields
              style_aesthetic: { type: 'array', items: { type: 'string' } },
              formality_level: { type: 'string' },
              suitable_occasions: { type: 'array', items: { type: 'string' } },
              season: { type: 'array', items: { type: 'string' } },
              weather_suitability: { type: 'string' },
              brand: { type: 'string' },
              condition: { type: 'string' },
              special_features: { type: 'array', items: { type: 'string' } },
              style_notes_detailed: { type: 'string' },
              
              // Additional color details (optional)
              secondary_colors: { type: 'array', items: { type: 'string' } },
            },
            required: ['style_aesthetic', 'formality_level', 'suitable_occasions', 'season', 'weather_suitability', 'condition']
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
            { type: 'text', text: SEMANTIC_ENRICHMENT_PROMPT },
            { type: 'image_url', image_url: { url: originalImageUrl } }
          ]
        }
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'return_semantic_metadata' } }
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
    console.log(`PHASE 2 SUCCESS: Extracted ${Object.keys(detailedMetadata).length} semantic fields`);

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
