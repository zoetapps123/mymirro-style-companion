import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { SCORING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { EXTRACTION_PROMPT } from '../_shared/fashion/prompt/extractionPrompt.ts';
import { VisualSchema } from '../_shared/fashion/schema/visualSchema.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';

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

// Helper function to build metadata context string
function buildMetadataContext(metadata: any): string {
  const parts: string[] = ['**EXTRACTED OUTFIT METADATA:**\n'];
  
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
  
  // AI Scores from extraction (only show if values exist)
  if (metadata.scores) {
    const scores = metadata.scores;
    const scoreLines: string[] = [];
    if (scores.fit?.value != null) scoreLines.push(`   - Fit: ${scores.fit.value.toFixed(1)}/5.0 (${scores.fit.confidence?.toFixed(0) || 0}% confidence)${scores.fit.reason ? ' — ' + scores.fit.reason : ''}`);
    if (scores.color?.value != null) scoreLines.push(`   - Color: ${scores.color.value.toFixed(1)}/5.0 (${scores.color.confidence?.toFixed(0) || 0}% confidence)${scores.color.reason ? ' — ' + scores.color.reason : ''}`);
    if (scores.styling?.value != null) scoreLines.push(`   - Styling: ${scores.styling.value.toFixed(1)}/5.0 (${scores.styling.confidence?.toFixed(0) || 0}% confidence)${scores.styling.reason ? ' — ' + scores.styling.reason : ''}`);
    if (scores.material?.value != null) scoreLines.push(`   - Material: ${scores.material.value.toFixed(1)}/5.0 (${scores.material.confidence?.toFixed(0) || 0}% confidence)${scores.material.reason ? ' — ' + scores.material.reason : ''}`);
    if (scoreLines.length > 0) {
      parts.push(`\n📊 **INITIAL AI SCORES:**`);
      parts.push(...scoreLines);
    }
  }
  
  // Low confidence warnings (only for meaningful fields with low confidence)
  const lowConfidenceFields: string[] = [];
  if (isMeaningful(metadata.fit?.silhouette?.value) && metadata.fit?.silhouette?.confidence < 0.5) lowConfidenceFields.push('silhouette');
  if (isMeaningful(metadata.color?.harmony?.value) && metadata.color?.harmony?.confidence < 0.5) lowConfidenceFields.push('color harmony');
  if (isMeaningful(metadata.aesthetics?.polish_level?.value) && metadata.aesthetics?.polish_level?.confidence < 0.5) lowConfidenceFields.push('polish level');
  if (lowConfidenceFields.length > 0) {
    parts.push(`\n⚠️ **LOW CONFIDENCE AREAS:** ${lowConfidenceFields.join(', ')} — may need better image visibility`);
  }
  
  parts.push(`\n**USE THIS DATA:** Reference specific parameters (e.g., "oversized silhouette," "monochrome harmony," "partial tuck") in your analysis to make feedback data-driven and precise.\n`);
  
  return parts.join('\n');
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
    const { imageData, occasion, style, vibe } = await req.json();

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
    if (isDataUrl && imageData.length > 15_000_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Please upload a smaller image (<10MB).' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scoring outfit with enhanced fashion analysis...');

    // Check cache first
    const cacheKey = await generateCacheKey({ type: 'outfit_score_v4', imageData, occasion, style, vibe });
    const cachedScore = await getCachedResult(cacheKey);
    if (cachedScore) {
      console.log('Returning cached outfit score');
      return new Response(
        JSON.stringify(cachedScore),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract visual metadata and scores from AI
    let extractionData;
    try {
      console.log('Step 1: Extracting visual metadata and AI scores...');
      const contextPrompt = EXTRACTION_PROMPT(occasion, style, vibe);

      extractionData = await retryWithBackoff(() =>
        callGeminiAPI({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: contextPrompt
                },
                {
                  type: 'image_url',
                  image_url: { url: imageData }
                }
              ]
            }
          ],
          temperature: 0
        })
      );
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Our AI is experiencing high demand. Please try again in a few moments.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (error.message === 'PAYMENT_REQUIRED') {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Parse extraction response
    const extractionContent = extractionData.choices?.[0]?.message?.content;
    if (!extractionContent) {
      throw new Error('Failed to extract visual metadata');
    }

    console.log('Raw AI extraction response:', extractionContent);

    let metadata;
    try {
      const cleaned = extractionContent.trim().replace(/^```json\n?|```$/g, '');
      metadata = JSON.parse(cleaned);
      console.log('Parsed metadata sample:', JSON.stringify({
        fit_sleeve: metadata?.fit?.sleeve_length,
        color_top: metadata?.color?.top_color
      }));
    } catch (e) {
      console.error('Failed to parse extraction JSON:', e);
      console.error('Raw content:', extractionContent);
      throw new Error('Invalid extraction response format');
    }

    // Step 2: Validate with schema
    console.log('Step 2: Validating metadata...');
    const validationResult = VisualSchema.safeParse(metadata);
    if (!validationResult.success) {
      console.error('Schema validation failed:', validationResult.error);
      throw new Error('Extracted metadata does not match expected schema');
    }

    const validatedMetadata = validationResult.data;

    // Build metadata context for enhanced analysis
    const metadataContext = buildMetadataContext(validatedMetadata);
    console.log('Built metadata context:', metadataContext.substring(0, 200) + '...');

    // Step 2: Use AI-generated scores (no deterministic computation)
    console.log('Step 2: Using AI-generated scores...');
    const aiScores = validatedMetadata.scores;
    const scoreResults = {
      overall_score: Math.round(aiScores.overall.value * 4) / 4, // Round to nearest 0.25
      components: {
        fit: aiScores.fit.value,
        color: aiScores.color.value,
        styling: aiScores.styling.value,
        material: aiScores.material.value,
      },
      confidence: Math.min(
        aiScores.fit.confidence,
        aiScores.color.confidence,
        aiScores.styling.confidence,
        aiScores.material.confidence
      ),
      missing_features: validatedMetadata.missing_features,
      reasoning: {
        fit: aiScores.fit.reason || '',
        color: aiScores.color.reason || '',
        styling: aiScores.styling.reason || '',
        material: aiScores.material.reason || '',
        overall: aiScores.overall.reason || '',
      }
    };

    // Step 3: Generate dynamic feedback using SCORE_OUTFIT with metadata context
    console.log('Step 3: Generating outfit analysis with SCORE_OUTFIT and metadata...');
    let scoreOutfitData;
    try {
      const scorePrompt = SCORING_PROMPTS.SCORE_OUTFIT(occasion, style, vibe, metadataContext);
      scoreOutfitData = await retryWithBackoff(() =>
        callGeminiAPI({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: scorePrompt
                },
                {
                  type: 'image_url',
                  image_url: { url: imageData }
                }
              ]
            }
          ],
          temperature: 0.7
        })
      );
    } catch (error: any) {
      console.error('SCORE_OUTFIT generation failed, will use defaults:', error);
      scoreOutfitData = null;
    }

    // Log raw response
    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      console.log('Raw SCORE_OUTFIT response:', content);
    }

    // Parse SCORE_OUTFIT response
    let outfitName = `${style || 'Contemporary'} Ensemble`;
    let whatWorks = ["Good foundation"];
    let whatDidntWork = scoreResults.missing_features.length > 0 
      ? [`Limited visibility: ${scoreResults.missing_features.join(', ')}`]
      : ["Minor refinements possible"];
    let quickFix = [
      "Adjust proportions for better balance",
      "Consider accessory additions",
      "Review color harmony",
      "Check hemline placement"
    ];
    let editorial = "A refined outfit with careful attention to fit and proportion.";

    if (scoreOutfitData) {
      const content = scoreOutfitData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.trim().replace(/^```json\n?|```$/g, '');
          const parsed = JSON.parse(cleaned);
          
          if (parsed.outfit_name) outfitName = parsed.outfit_name;
          if (Array.isArray(parsed.what_works) && parsed.what_works.length > 0) {
            whatWorks = parsed.what_works;
          }
          if (Array.isArray(parsed.what_doesnt_work) && parsed.what_doesnt_work.length > 0) {
            whatDidntWork = parsed.what_doesnt_work;
          }
          if (Array.isArray(parsed.quick_fixes) && parsed.quick_fixes.length > 0) {
            quickFix = parsed.quick_fixes;
          }
          // Use first what_works item as editorial fallback if no editorial field
          if (parsed.editorial) {
            editorial = parsed.editorial;
          } else if (whatWorks.length > 0) {
            editorial = whatWorks.join('. ') + '.';
          }
        } catch (e) {
          console.error('Failed to parse SCORE_OUTFIT response, using defaults:', e);
        }
      }
    }

    // Combine results
    const finalResult = {
      overall_score: scoreResults.overall_score,
      components: scoreResults.components,
      confidence: scoreResults.confidence,
      editorial,
      missing_features: scoreResults.missing_features,
      // Dynamic fields from SCORE_OUTFIT
      outfit_name: outfitName,
      color_score: scoreResults.components.color,
      fit_score: scoreResults.components.fit,
      texture_score: scoreResults.components.material,
      occasion_score: scoreResults.overall_score,
      what_works: whatWorks,
      what_didnt_work: whatDidntWork,
      quick_fix: quickFix
    };

    // Cache the result
    await setCachedResult(cacheKey, finalResult);

    return new Response(
      JSON.stringify(finalResult),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in score-outfit:', error);
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