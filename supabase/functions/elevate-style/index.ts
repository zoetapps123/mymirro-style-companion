/**
 * Phase 8: Elevate Through AI - Enhanced with Unified Schema Support
 * 
 * Upgrades:
 * - Now accepts enriched metadata from unified style check schema
 * - Supports micro_recommendations, missing_features, whatDoesntWork
 * - Full backward compatibility with legacy payload structure
 * - Enhanced prompt building with body visibility awareness
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from '../_shared/ai-config.ts';
import { STYLING_PROMPTS } from '../_shared/prompts.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/auth-utils.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';
import { buildMetadataContext } from './helpers.ts';

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
    // Phase 6: Accept enriched payload (unified schema Phase 2)
    const { 
      imageData, 
      wardrobeItems = [], 
      orientation, 
      width, 
      height,
      // Phase 2 unified schema fields
      microFixes = [],
      whatDoesntWork = [],
      proportionBalance,
      silhouetteBreakdown,
      wardrobeOpportunities = [],
      missingFeatures = [],
    } = await req.json();

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

    console.log('Phase 8: Elevating style with AI using unified schema...');

    // Phase 6: Detect body visibility from missing features
    const bodyNotVisible = missingFeatures.some((f: string) => 
      f.toLowerCase().includes('person_not_detected') || 
      f.toLowerCase().includes('body_not_visible')
    );

    // Phase 6: Build enriched metadata context using Phase 2 structure
    const metadataContext = buildMetadataContext({
      microFixes,
      whatDoesntWork,
      proportionBalance,
      silhouetteBreakdown,
      wardrobeOpportunities,
      missingFeatures,
      wardrobeItems,
      bodyNotVisible,
    });

    const editPrompt = STYLING_PROMPTS.QUICK_STYLE_FIXES(metadataContext, wardrobeItems, bodyNotVisible);

    // Call Gemini API for image generation
    const data = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: editPrompt },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      modalities: ['image', 'text']
    }));
    
    console.log('Style elevation complete');

    // Extract generated image from Gemini response
    const enhancedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || imageData;

    if (!enhancedImage) {
      throw new Error('Failed to generate enhanced image');
    }

    return new Response(
      JSON.stringify({ enhancedImage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in elevate-style:', error);
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
