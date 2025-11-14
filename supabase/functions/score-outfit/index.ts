import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { SCORING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { generateCacheKey, getCachedResult, setCachedResult } from '../_shared/cache-utils.ts';
import { EXTRACTION_PROMPT } from '../_shared/fashion/prompt/extractionPrompt.ts';
import { EDITORIAL_PROMPT } from '../_shared/fashion/prompt/editorialPrompt.ts';
import { VisualSchema } from '../_shared/fashion/schema/visualSchema.ts';
import { computeScore } from '../_shared/fashion/scoring/computeScore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const cacheKey = await generateCacheKey({ type: 'outfit_score_v2', imageData, occasion, style, vibe });
    const cachedScore = await getCachedResult(cacheKey);
    if (cachedScore) {
      console.log('Returning cached outfit score');
      return new Response(
        JSON.stringify(cachedScore),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract visual metadata
    let extractionData;
    try {
      console.log('Step 1: Extracting visual metadata...');
      extractionData = await callGeminiAPI({
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
                image_url: { url: imageData }
              }
            ]
          }
        ],
        temperature: 0
      });
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
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

    let metadata;
    try {
      const cleaned = extractionContent.trim().replace(/^```json\n?|```$/g, '');
      metadata = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse extraction JSON:', e);
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

    // Step 3: Compute deterministic scores
    console.log('Step 3: Computing deterministic scores...');
    const scoreResults = computeScore(validatedMetadata);

    // Step 4: Generate editorial commentary
    console.log('Step 4: Generating editorial...');
    let editorialData;
    try {
      editorialData = await callGeminiAPI({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${EDITORIAL_PROMPT}

METADATA:
${JSON.stringify(validatedMetadata, null, 2)}

SCORES:
${JSON.stringify(scoreResults, null, 2)}

${occasion ? `OCCASION: ${occasion}` : ''}
${style ? `STYLE: ${style}` : ''}
${vibe ? `VIBE: ${vibe}` : ''}`
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ],
        temperature: 0.7
      });
    } catch (error: any) {
      console.error('Editorial generation failed, continuing without it:', error);
      editorialData = null;
    }

    // Parse editorial
    let editorial = "A refined outfit with careful attention to fit and proportion.";
    if (editorialData) {
      const editorialContent = editorialData.choices?.[0]?.message?.content;
      if (editorialContent) {
        try {
          const editorialCleaned = editorialContent.trim().replace(/^```json\n?|```$/g, '');
          const editorialObj = JSON.parse(editorialCleaned);
          editorial = editorialObj.editorial || editorial;
        } catch (e) {
          console.error('Failed to parse editorial, using default');
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
      // Legacy compatibility
      outfit_name: `${style || 'Contemporary'} Ensemble`,
      color_score: scoreResults.components.color,
      fit_score: scoreResults.components.fit,
      texture_score: scoreResults.components.material,
      occasion_score: scoreResults.overall_score, // Use overall as fallback
      what_works: [editorial.split('.')[0] || "Good foundation"],
      what_didnt_work: scoreResults.missing_features.length > 0 
        ? [`Limited visibility: ${scoreResults.missing_features.join(', ')}`]
        : ["Minor refinements possible"],
      quick_fix: [
        "Adjust proportions for better balance",
        "Consider accessory additions",
        "Review color harmony",
        "Check hemline placement"
      ]
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