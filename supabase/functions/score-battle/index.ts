import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { SCORING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';
import { EXTRACTION_PROMPT } from '../_shared/fashion/prompt/extractionPrompt.ts';
import { VisualSchema } from '../_shared/fashion/schema/visualSchema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to check if a value is meaningful (not N/A or unknown)
function isMeaningful(val: any): boolean {
  if (!val || val === null || val === undefined) return false;
  const str = String(val).toLowerCase().trim();
  return !['n/a', 'unknown', 'none', 'not applicable', ''].includes(str);
}

// Build metadata context string for a single participant
function buildParticipantMetadataContext(name: string, metadata: any): string {
  const parts: string[] = [`\n**PARTICIPANT: ${name}**\n`];
  
  // Fit parameters
  if (metadata.fit) {
    const fit = metadata.fit;
    const fitDetails: string[] = [];
    if (isMeaningful(fit.silhouette?.value)) fitDetails.push(`${fit.silhouette.value} silhouette`);
    if (isMeaningful(fit.hemline?.value)) fitDetails.push(`${fit.hemline.value} hemline`);
    if (isMeaningful(fit.sleeve_length?.value)) fitDetails.push(`${fit.sleeve_length.value} sleeves`);
    if (isMeaningful(fit.shoulder_structure?.value)) fitDetails.push(`${fit.shoulder_structure.value} shoulders`);
    if (isMeaningful(fit.pant_stacking?.value)) fitDetails.push(`${fit.pant_stacking.value} pant stacking`);
    if (fitDetails.length > 0) parts.push(`📏 **FIT:** ${fitDetails.join(', ')}`);
  }
  
  // Fabric details
  if (metadata.fabric) {
    const fabric = metadata.fabric;
    const fabricDetails: string[] = [];
    if (isMeaningful(fabric.material?.value)) fabricDetails.push(fabric.material.value);
    if (isMeaningful(fabric.texture?.value)) fabricDetails.push(`${fabric.texture.value} texture`);
    if (isMeaningful(fabric.finish?.value)) fabricDetails.push(`${fabric.finish.value} finish`);
    if (isMeaningful(fabric.weight?.value)) fabricDetails.push(`${fabric.weight.value} weight`);
    if (fabricDetails.length > 0) parts.push(`🧵 **FABRIC:** ${fabricDetails.join(', ')}`);
  }
  
  // Color harmony
  if (metadata.color) {
    const color = metadata.color;
    const colorDetails: string[] = [];
    if (isMeaningful(color.harmony?.value)) colorDetails.push(`${color.harmony.value} harmony`);
    if (isMeaningful(color.contrast?.value)) colorDetails.push(`${color.contrast.value} contrast`);
    if (colorDetails.length > 0) parts.push(`🎨 **COLOR:** ${colorDetails.join(', ')}`);
  }
  
  // Styling details
  if (metadata.styling) {
    const styling = metadata.styling;
    const details: string[] = [];
    if (isMeaningful(styling.tuck_status?.value)) details.push(`${styling.tuck_status.value} tuck`);
    if (isMeaningful(styling.sleeve_treatment?.value)) details.push(`${styling.sleeve_treatment.value} sleeves`);
    if (isMeaningful(styling.layering_pieces?.value)) details.push(`${styling.layering_pieces.value} layer(s)`);
    if (details.length > 0) parts.push(`✨ **STYLING:** ${details.join(', ')}`);
  }
  
  // Aesthetics
  if (metadata.aesthetics) {
    const aes = metadata.aesthetics;
    const aesDetails: string[] = [];
    if (isMeaningful(aes.cultural_aesthetic?.value)) aesDetails.push(aes.cultural_aesthetic.value);
    if (isMeaningful(aes.price_tier?.value)) aesDetails.push(`${aes.price_tier.value} tier`);
    if (isMeaningful(aes.polish_level?.value)) aesDetails.push(`polish level ${aes.polish_level.value}/5`);
    if (aesDetails.length > 0) parts.push(`🌟 **AESTHETIC:** ${aesDetails.join(', ')}`);
  }
  
  // AI Scores from extraction
  if (metadata.scores) {
    const scores = metadata.scores;
    const scoreDetails: string[] = [];
    if (isMeaningful(scores.fit_score?.value)) scoreDetails.push(`fit ${scores.fit_score.value}/5`);
    if (isMeaningful(scores.color_score?.value)) scoreDetails.push(`color ${scores.color_score.value}/5`);
    if (isMeaningful(scores.styling_score?.value)) scoreDetails.push(`styling ${scores.styling_score.value}/5`);
    if (isMeaningful(scores.material_score?.value)) scoreDetails.push(`material ${scores.material_score.value}/5`);
    if (scoreDetails.length > 0) parts.push(`⚡ **AI SCORES:** ${scoreDetails.join(', ')}`);
  }
  
  return parts.join('\n');
}

// Extract metadata for a single participant
async function extractParticipantMetadata(participant: any): Promise<any> {
  // Check cache first
  const extractionCacheKey = await generateCacheKey({ 
    type: 'participant_extraction',
    imageData: participant.imageData 
  });
  
  const cachedExtraction = await getCachedResult<any>(extractionCacheKey);
  if (cachedExtraction) {
    console.log(`Using cached extraction for ${participant.name}`);
    return cachedExtraction;
  }

  console.log(`Extracting metadata for ${participant.name}...`);
  
  // Call Gemini with VisualSchema to extract detailed outfit attributes
  const extractionData = await retryWithBackoff(() => callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT
          },
          {
            type: 'image_url',
            image_url: { url: participant.imageData }
          }
        ]
      }
    ]
  }));

  const rawContent = extractionData.choices?.[0]?.message?.content;
  if (!rawContent) {
    console.warn(`No extraction data for ${participant.name}, using empty metadata`);
    return {};
  }

  // Parse and validate against VisualSchema
  let extractedMetadata: any = {};
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = VisualSchema.parse(parsed);
      extractedMetadata = validated;
    }
  } catch (error) {
    console.warn(`Failed to parse/validate extraction for ${participant.name}:`, error);
  }

  // Cache the extraction for 24 hours
  await setCachedResult(extractionCacheKey, extractedMetadata);
  
  return extractedMetadata;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    console.error('Auth failed:', authError);
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { participants } = await req.json();

    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 participants required' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (participants.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Too many participants. Max 5 allowed.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    for (const p of participants) {
      if (!p?.name || typeof p.name !== 'string' || !p?.imageData || typeof p.imageData !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Each participant must include name and imageData' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (p.imageData.startsWith('data:image/') && p.imageData.length > 15_000_000) {
        return new Response(
          JSON.stringify({ error: `Image too large for ${p.name}. Please use a smaller image (<10MB).` }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Scoring battle with ${participants.length} participants...`);

    // Generate cache key based on participant images
    const cacheKey = await generateCacheKey({ participants: participants.map(p => ({ name: p.name, imageData: p.imageData })) });
    
    // Check cache first
    const cachedResult = await getCachedResult<any>(cacheKey);
    if (cachedResult) {
      console.log('Battle result found in cache');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 1: Extract metadata for all participants in parallel
    console.log('Extracting metadata for all participants...');
    const metadataPromises = participants.map((p: any) => extractParticipantMetadata(p));
    const participantMetadata = await Promise.all(metadataPromises);
    
    // Build metadata context string for all participants
    const metadataContext = participantMetadata.map((metadata, idx) => 
      buildParticipantMetadataContext(participants[idx].name, metadata)
    ).join('\n');
    
    console.log('Metadata extraction complete, proceeding with battle scoring...');

    // PHASE 2: Call Gemini API with metadata-enhanced prompt
    const data = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SCORING_PROMPTS.SCORE_BATTLE(participants.length, true)
            },
            {
              type: 'text',
              text: metadataContext
            },
            ...participants.map((p: any, idx: number) => [
              { type: 'text', text: `Participant ${idx + 1}: ${p.name}` },
              { type: 'image_url', image_url: { url: p.imageData } }
            ]).flat()
          ]
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'score_battle',
            description: 'Score and rank multiple outfits in a fashion battle with fun competitive banter',
            parameters: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Original participant name' },
                      persona_name: { type: 'string', description: 'Competitive persona name (2-3 words)' },
                      score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                      rank: { type: 'integer', minimum: 1 },
                      roast: { type: 'string', description: 'Fun competitive banter comparing to others' }
                    },
                    required: ['name', 'persona_name', 'score', 'rank', 'roast']
                  }
                },
                winner_verdict: { type: 'string' }
              },
              required: ['results', 'winner_verdict']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'score_battle' } }
    }));
    console.log('Battle scoring response:', data);

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let battleResults = null as any;
    if (toolCall?.function?.arguments) {
      try { battleResults = JSON.parse(toolCall.function.arguments); } catch (_) {}
    }
    if (!battleResults) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        try { battleResults = JSON.parse(content); } catch (_) {}
      }
    }

    if (!battleResults) {
      throw new Error('Failed to score battle');
    }

    // Sort by rank to ensure proper ordering
    battleResults.results.sort((a: any, b: any) => a.rank - b.rank);

    // Enhance results with metadata highlights
    const enhancedResults = {
      ...battleResults,
      results: battleResults.results.map((result: any, idx: number) => {
        const metadata = participantMetadata[participants.findIndex((p: any) => p.name === result.name)];
        return {
          ...result,
          metadata_highlights: {
            silhouette: metadata?.fit?.silhouette?.value || 'N/A',
            color_harmony: metadata?.color?.harmony?.value || 'N/A',
            polish_level: metadata?.aesthetics?.polish_level?.value || 'N/A',
            fabric_quality: metadata?.fabric?.material?.value || 'N/A',
          }
        };
      }),
      participant_metadata: participantMetadata // Include full metadata for advanced features
    };

    // Cache the enhanced result for 24 hours
    await setCachedResult(cacheKey, enhancedResults);

    return new Response(
      JSON.stringify(enhancedResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in score-battle:', error);
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
