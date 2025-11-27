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
    const { originalImageUrl, visualMetadata } = await req.json();
    
    console.log(`PHASE 2 SEMANTIC ENRICHMENT: ${visualMetadata.item_type} (${visualMetadata.category})`);

    const PROMPT = `You are analyzing a ${visualMetadata.category} item to add SEMANTIC and CONTEXTUAL metadata.

═══════════════════════════════════════════════════════════════════════
PHASE 1 VISUAL METADATA (AUTHORITATIVE - DO NOT CONTRADICT)
═══════════════════════════════════════════════════════════════════════
The following visual facts are AUTHORITATIVE:
- Category: ${visualMetadata.category}
- Item Type: ${visualMetadata.item_type}
- Fit/Silhouette: ${visualMetadata.fit_silhouette}
- Length: ${visualMetadata.length}
- Primary Color: ${visualMetadata.primary_color_hex}
- Secondary Palette: ${visualMetadata.secondary_palette?.join(', ') || 'none'}
- Pattern Type: ${visualMetadata.pattern_type}
- Pattern Geometry: ${visualMetadata.pattern_geometry}
- Graphic: ${visualMetadata.graphic_summary}
- Sleeve/Neck: ${visualMetadata.sleeve_neck_summary}
- Fabric Family: ${visualMetadata.fabric_family}
- Fabric Behavior: ${visualMetadata.fabric_behavior}

═══════════════════════════════════════════════════════════════════════
YOUR TASK: SEMANTIC ENRICHMENT ONLY
═══════════════════════════════════════════════════════════════════════

Using BOTH the image and the visual metadata above, infer SEMANTIC properties.
DO NOT contradict the visual facts above.

**SEMANTIC INFERENCE:**
- style_aesthetic: Array of 1-3 aesthetics
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
  
- style_notes_detailed: A 50-100 character styling suggestion

**RULES:**
1. Do NOT change any of the 12 visual fields
2. Only infer semantics that logically follow from visible design
3. Do NOT use stereotypes
4. If uncertain, use more general/neutral values

Use return_semantic_metadata function.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_semantic_metadata',
          description: 'Return semantic/contextual metadata for wardrobe item',
          parameters: {
            type: 'object',
            properties: {
              style_aesthetic: { type: 'array', items: { type: 'string' } },
              formality_level: { type: 'string' },
              suitable_occasions: { type: 'array', items: { type: 'string' } },
              season: { type: 'array', items: { type: 'string' } },
              weather_suitability: { type: 'string' },
              brand: { type: 'string' },
              condition: { type: 'string' },
              special_features: { type: 'array', items: { type: 'string' } },
              style_notes_detailed: { type: 'string' },
            },
            required: ['style_aesthetic', 'formality_level', 'suitable_occasions', 'season', 'weather_suitability', 'condition']
          }
        }
      }
    ];

    // Fetch and convert image to base64
    console.log("Fetching image URL:", originalImageUrl);
    const imageResponse = await fetch(originalImageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const imageDataUrl = `data:${imageResponse.headers.get('content-type') || 'image/jpeg'};base64,${base64Image}`;
    console.log("Successfully converted image, size:", imageBuffer.byteLength, "type:", imageResponse.headers.get('content-type'));

    const data = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } }
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
      JSON.stringify({ success: true, detailedMetadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enrich-wardrobe-item:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        detailedMetadata: {} 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
