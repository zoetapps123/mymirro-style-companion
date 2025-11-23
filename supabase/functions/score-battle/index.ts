import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { SCORING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';
import { MASTER_UNIFIED_STYLECHECK_PROMPT } from '../_shared/fashion/prompt/masterUnifiedStyleCheckPrompt.ts';
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

// Analyze a single participant using unified style check (extraction + scoring in one call)
async function analyzeParticipant(participant: any): Promise<any> {
  // Check cache first (1-hour TTL for individual analyses)
  const analysisCacheKey = await generateCacheKey({ 
    type: 'unified_battle_participant',
    imageData: participant.imageData 
  });
  
  const cachedAnalysis = await getCachedResult<any>(analysisCacheKey);
  if (cachedAnalysis) {
    console.log(`Using cached unified analysis for ${participant.name}`);
    return cachedAnalysis;
  }

  console.log(`Performing unified style check for ${participant.name}...`);
  
  // Call Gemini with MASTER_UNIFIED_STYLECHECK_PROMPT for complete analysis
  const analysisData = await retryWithBackoff(() => callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: MASTER_UNIFIED_STYLECHECK_PROMPT({ occasion: participant.occasion })
          },
          {
            type: 'image_url',
            image_url: { url: participant.imageData }
          }
        ]
      }
    ]
  }));

  const rawContent = analysisData.choices?.[0]?.message?.content;
  if (!rawContent) {
    console.warn(`No analysis data for ${participant.name}, using fallback`);
    return {
      name: participant.name,
      scores: { overall_score: 2.5, fit: 2.5, color: 2.5, styling: 2.5, material: 2.5 },
      outfit_name: 'Unanalyzed Look',
      what_works: ['Style could not be analyzed'],
      what_doesnt_work: [],
      quick_fixes: []
    };
  }

  // Parse and validate the unified response
  let styleCheck: any = {};
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Extract relevant fields for battle
      styleCheck = {
        name: participant.name,
        outfit_name: parsed.outfit_name || 'Stylish Look',
        overall_score: parsed.overall_score || 2.5,
        fit_score: parsed.components?.fit?.score || 2.5,
        color_score: parsed.components?.color?.score || 2.5,
        styling_score: parsed.components?.styling?.score || 2.5,
        material_score: parsed.components?.material?.score || 2.5,
        what_works: parsed.what_works || [],
        what_doesnt_work: parsed.what_doesnt_work || [],
        quick_fixes: parsed.quick_fixes || [],
        editorial: parsed.editorial || '',
        extraction: parsed.extraction || {}
      };
    }
  } catch (error) {
    console.warn(`Failed to parse unified analysis for ${participant.name}:`, error);
    styleCheck = {
      name: participant.name,
      overall_score: 2.5,
      fit_score: 2.5,
      color_score: 2.5,
      styling_score: 2.5,
      material_score: 2.5,
      outfit_name: 'Classic Look',
      what_works: [],
      what_doesnt_work: [],
      quick_fixes: []
    };
  }

  // Cache for 1 hour
  await setCachedResult(analysisCacheKey, styleCheck);
  
  return styleCheck;
}

// Determine winner from analyzed participants
async function determineWinner(participantAnalyses: any[]): Promise<any> {
  console.log('Determining winner from analyzed participants...');
  
  // Build summary of all participants with their scores
  const participantSummaries = participantAnalyses.map((analysis, idx) => `
**Participant ${idx + 1}: ${analysis.name}**
- Outfit Name: ${analysis.outfit_name}
- Overall Score: ${analysis.overall_score}/5
- Fit: ${analysis.fit_score}/5
- Color: ${analysis.color_score}/5
- Styling: ${analysis.styling_score}/5
- Material: ${analysis.material_score}/5
- Key Strengths: ${analysis.what_works.slice(0, 2).join('; ')}
`).join('\n');

  const prompt = `You are judging a fashion battle with ${participantAnalyses.length} contestants. Each has already been individually scored by expert stylists.

${participantSummaries}

Your task: Compare these pre-scored outfits and create a competitive leaderboard with fun roasts and a winner's verdict.

Guidelines:
- Respect the individual scores (they are accurate)
- Create engaging competitive banter in the roasts
- Assign creative persona names (2-3 words each)
- The person with the highest overall_score wins
- Make it entertaining but supportive

Return ONLY a valid JSON object with this structure:
{
  "results": [
    {
      "name": "original_participant_name",
      "persona_name": "Street Style Maven",
      "score": 4.2,
      "rank": 1,
      "roast": "Fun competitive banter comparing their style to others"
    }
  ],
  "winner_verdict": "2-3 sentences celebrating the winner's victory and style strengths"
}`;

  const winnerData = await retryWithBackoff(() => callGeminiAPI({
    model: 'google/gemini-2.5-flash',
    messages: [{ role: 'user', content: prompt }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'determine_winner',
          description: 'Rank participants and determine fashion battle winner',
          parameters: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    persona_name: { type: 'string' },
                    score: { type: 'number', minimum: 1.0, maximum: 5.0 },
                    rank: { type: 'integer', minimum: 1 },
                    roast: { type: 'string' }
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
    tool_choice: { type: 'function', function: { name: 'determine_winner' } }
  }));

  const toolCall = winnerData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse winner determination:', e);
    }
  }
  
  // Fallback: simple ranking by score
  const sorted = [...participantAnalyses].sort((a, b) => b.overall_score - a.overall_score);
  return {
    results: sorted.map((p, idx) => ({
      name: p.name,
      persona_name: p.outfit_name,
      score: p.overall_score,
      rank: idx + 1,
      roast: `Scored ${p.overall_score}/5 in this battle`
    })),
    winner_verdict: `${sorted[0].name} takes the crown with a score of ${sorted[0].overall_score}/5!`
  };
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

    // Generate cache key based on participant images (30-minute TTL for battle results)
    const cacheKey = await generateCacheKey({ 
      type: 'battle_result',
      participants: participants.map(p => ({ name: p.name, imageData: p.imageData })) 
    });
    
    // Check cache first
    const cachedResult = await getCachedResult<any>(cacheKey);
    if (cachedResult) {
      console.log('Battle result found in cache');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 1: Analyze all participants in parallel with unified style check
    console.log('Performing unified style check for all participants...');
    const analysisPromises = participants.map((p: any) => analyzeParticipant(p));
    const participantAnalyses = await Promise.all(analysisPromises);
    
    console.log('All participants analyzed, determining winner...');

    // PHASE 2: Determine winner from analyzed participants
    const battleResult = await determineWinner(participantAnalyses);
    
    // Sort results by rank to ensure rank 1 (winner) is first
    battleResult.results.sort((a: any, b: any) => a.rank - b.rank);
    
    // PHASE 3: Enhance results with individual style check data
    const enhancedResults = {
      ...battleResult,
      results: battleResult.results.map((result: any) => {
        const analysis = participantAnalyses.find((a: any) => a.name === result.name);
        return {
          ...result,
          styleCheck: analysis || {},
          individualScores: {
            fit: analysis?.fit_score || result.score,
            color: analysis?.color_score || result.score,
            styling: analysis?.styling_score || result.score,
            material: analysis?.material_score || result.score
          }
        };
      }),
      participantAnalyses // Include full analyses for frontend display
    };

    // Cache for 30 minutes
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
