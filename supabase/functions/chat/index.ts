import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPIStreaming, callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';
import { 
  buildAICompanionPrompt,
  OUTFIT_ENGINE_PROMPT,
  WARDROBE_ENGINE_PROMPT,
  TOOL_USAGE_RULES_PROMPT,
  BRAND_RECOMMENDER_PROMPT
} from '../_shared/ai_companion_prompts/index.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';
import { 
  getConversationState, 
  updateConversationState, 
  incrementTurn,
  trackIntent,
  determineConversationMode,
  canGenerateOutfit
} from '../_shared/conversation-state-utils.ts';
import { validateWardrobe } from '../_shared/wardrobe-validation-utils.ts';
import { detectIntent } from '../_shared/intent-detection-utils.ts';
import { inferOccasion } from '../_shared/occasion-inference-utils.ts';
import { detectEmotionalSubtext } from '../_shared/emo-detection-utils.ts';
import { getPreferences, getWardrobePersona, savePreference, updateTasteCalibration } from '../_shared/memory-utils.ts';
import { analyzeWardrobeGaps, generateShoppingRecommendations, inferBudgetTier } from '../_shared/shopping-analysis-utils.ts';
import { generateBrandRecommendations, getBrandRecommendationsForGap } from '../_shared/brand-recommendation-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Chat: request received', { method: req.method, url: new URL(req.url).pathname });
    
    // Extract and verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's token to respect RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const { messages, userProfile, wardrobeItems, recentBattles, recentStyleChecks } = await req.json();

    // Increment conversation turn
    const currentTurn = await incrementTurn(supabase, userId);
    console.log('Current conversation turn:', currentTurn);

    // Get conversation state
    let conversationState = await getConversationState(supabase, userId);

    // Validate wardrobe
    const wardrobeValidation = validateWardrobe(wardrobeItems || []);

    // Update wardrobe validation state
    await updateConversationState(supabase, userId, {
      wardrobe_validation_state: wardrobeValidation,
    });

    // Get recent intent history for context
    const recentIntents = conversationState?.last_5_intents || [];

    // Detect intent from last user message WITH CONTEXT
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const intentDetection = lastUserMessage 
      ? detectIntent(lastUserMessage.content, recentIntents) 
      : { intent: 'general', confidence: 0, query_type: 'general', is_continuation: false, context_weight: 0 };

    // Detect emotional subtext
    const emotionalDetection = lastUserMessage
      ? detectEmotionalSubtext(lastUserMessage.content)
      : { emotional_tone: 'neutral', confidence: 0, soft_mode_required: false, signals: [] };

    // Infer occasion
    const occasionInference = lastUserMessage
      ? inferOccasion(lastUserMessage.content, messages)
      : { inferred_occasion: null, confidence: 0 };
    
    console.log('[INTENT DETECTION]', {
      message: lastUserMessage?.content?.substring(0, 50),
      intent: intentDetection.intent,
      confidence: intentDetection.confidence,
      query_type: intentDetection.query_type,
      occasion: occasionInference.inferred_occasion,
      is_continuation: intentDetection.is_continuation,
      context_weight: intentDetection.context_weight
    });

    console.log('[EMOTIONAL DETECTION]', {
      tone: emotionalDetection.emotional_tone,
      confidence: emotionalDetection.confidence,
      soft_mode: emotionalDetection.soft_mode_required,
      signals: emotionalDetection.signals
    });

    // Determine conversation mode using state machine
    const conversationMode = determineConversationMode(
      conversationState!,
      intentDetection,
      emotionalDetection
    );

    console.log('[CONVERSATION MODE]', conversationMode);

    // Track intent in history
    await trackIntent(
      supabase,
      userId,
      intentDetection.intent,
      intentDetection.confidence,
      intentDetection.query_type
    );

    // Update conversation state with detected intent and emotional context
    await updateConversationState(supabase, userId, {
      last_intent_detected: intentDetection.intent,
      last_intent_confidence: intentDetection.confidence / 100,
      last_user_query_type: intentDetection.query_type,
      last_known_occasion: occasionInference.inferred_occasion || conversationState?.last_known_occasion,
      current_turn: currentTurn,
      emotional_tone: emotionalDetection.emotional_tone,
      chat_direction: conversationMode.toLowerCase(),
    });

    // Refresh state
    conversationState = await getConversationState(supabase, userId);
    
    console.log('[CONVERSATION STATE]', {
      current_turn: conversationState?.current_turn,
      last_outfit_turn: conversationState?.last_outfit_generation_turn,
      turns_since_outfit: (conversationState?.current_turn || 0) - (conversationState?.last_outfit_generation_turn || 0),
      recommendation_mode: conversationState?.recommendation_mode,
      outstanding_question: conversationState?.outstanding_question_flag,
      emotional_tone: conversationState?.emotional_tone,
      chat_direction: conversationState?.chat_direction,
      consecutive_blocks: conversationState?.consecutive_outfit_blocks
    });

    // Fetch user preferences and wardrobe persona for Memory Engine
    const userPreferences = await getPreferences(supabase, userId);
    const wardrobePersona = await getWardrobePersona(supabase, userId);

    console.log('[MEMORY CONTEXT]', {
      preferences_count: userPreferences.length,
      wardrobe_size: wardrobePersona.wardrobe_size,
      color_palette: wardrobePersona.color_palette,
      dominant_colors: wardrobePersona.dominant_colors.slice(0, 2)
    });

    // Check if outfit generation is allowed (anti-spam + eligibility)
    const canGenerate = canGenerateOutfit(
      conversationState!,
      intentDetection,
      wardrobeItems?.length || 0
    );

    console.log('[OUTFIT GENERATION ELIGIBILITY]', {
      can_generate: canGenerate,
      reason: !canGenerate ? 'Anti-spam or eligibility check failed' : 'Eligible'
    });

    // Track if outfit request was blocked (for consecutive block tracking)
    if (!canGenerate && (intentDetection.intent === 'explicit_outfit' || intentDetection.intent === 'implicit_outfit')) {
      const currentBlocks = conversationState?.consecutive_outfit_blocks || 0;
      await updateConversationState(supabase, userId, {
        consecutive_outfit_blocks: currentBlocks + 1,
      });
      console.log('[ANTI-SPAM BLOCK]', { consecutive_blocks: currentBlocks + 1 });
    }

    // Fetch user profile
    let bodyShape: string | null = null;
    let skinTone: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('body_shape, skin_tone')
        .eq('id', userId)
        .single();
      
      bodyShape = profile?.body_shape || undefined;
      skinTone = profile?.skin_tone || undefined;
    } catch (e) {
      console.error('Failed to fetch user context:', e);
    }

    // PHASE 7: Add Explicit Confirmation System
    const confirmationInstruction = `
<CONFIRMATION_RULES>
  BEFORE calling ANY tool, you MUST:
  
  1. For outfits:
     - If user EXPLICITLY says "create/generate/suggest outfits" → proceed
     - If UNCLEAR → ask "Would you like me to create some outfit suggestions?"
     
  2. For images:
     - ALWAYS ask: "What would you like me to do with this image?"
     - Options: Add to wardrobe / Get feedback / Just chatting
     
  3. For wardrobe:
     - If user asks to SEE items → show items (no outfits)
     - If user asks to STYLE with items → ask occasion first
     
  4. For shopping:
     - Only when user explicitly asks "what should I buy"
     
  NEVER auto-trigger features. ALWAYS confirm intent first.
</CONFIRMATION_RULES>
`;

    // PHASE 4: Enforce Follow-Up Questions
    const followUpInstruction = `
<FOLLOW_UP_RULES>
  You MUST ALWAYS end your response with ONE follow-up question to keep the conversation flowing.
  
  Examples:
    • After outfit suggestion: "Want me to tweak anything?"
    • After showing items: "What vibe are you going for with these?"
    • After style advice: "Does that make sense for what you're aiming for?"
    • After casual chat: "So what's on your mind style-wise today?"
    
  NEVER end a response without a question unless user explicitly says goodbye.
</FOLLOW_UP_RULES>
`;

    // PHASE 5: Natural Memory References
    const memoryUsageInstruction = `
<MEMORY_USAGE_RULES>
  You have access to user's taste profile and preferences. USE THEM NATURALLY:
  
  DON'T:
    "Based on your stored preference for oversized fits..."
    "According to my memory, you like..."
    
  DO:
    "Since you're usually into that oversized vibe..."
    "You love neutrals right? This would fit perfectly."
    "Knowing your minimal aesthetic..."
    
  REMEMBER:
    - Color preferences: ${wardrobePersona.dominant_colors.join(', ')}
    - Style vibes: ${wardrobePersona.style_aesthetic.join(', ')}
    - Formality level: ${wardrobePersona.formality_level}
    
  Reference these naturally in conversation without being explicit about "memory".
</MEMORY_USAGE_RULES>
`;

    // Build system prompt with anti-spam instructions
    let antiSpamInstruction = '';
    if (!canGenerate && (intentDetection.intent === 'explicit_outfit' || intentDetection.intent === 'implicit_outfit')) {
      const turnsSince = (conversationState?.current_turn || 0) - (conversationState?.last_outfit_generation_turn || 0);
      if (turnsSince < 2) {
        antiSpamInstruction = `\n\n🚫 DO NOT GENERATE OUTFITS - Cooldown active (${turnsSince}/2 turns). Respond conversationally.`;
      } else if (emotionalDetection?.soft_mode_required) {
        antiSpamInstruction = `\n\n🚫 DO NOT GENERATE OUTFITS - User needs emotional support. Be empathetic.`;
      } else if (wardrobeItems.length < 5) {
        antiSpamInstruction = `\n\n🚫 DO NOT GENERATE OUTFITS - Insufficient wardrobe (${wardrobeItems.length}/5). Suggest uploads.`;
      }
    }
    
    const basePrompt = buildAICompanionPrompt();
    const systemPrompt = basePrompt + confirmationInstruction + followUpInstruction + memoryUsageInstruction + antiSpamInstruction;
    
    // CRITICAL VALIDATION: Ensure system prompt is present
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      console.error("CRITICAL ERROR: systemPrompt is undefined or empty!");
      throw new Error("System prompt failed to load - AI Companion modules not initialized");
    }
    
    // Generate hash for verification
    const promptHash = Array.from(new TextEncoder().encode(systemPrompt))
      .reduce((hash, byte) => ((hash << 5) - hash) + byte, 0)
      .toString(16);
    
    console.log("SYSTEM PROMPT SIZE:", systemPrompt.length);
    console.log("AI_COMPANION_PROMPT_HASH:", promptHash);
    console.log("AI_COMPANION_MODULES_LOADED: ✓");

    // User context with enhanced conversation state, emotional context, and memory
    const turnsSinceLastOutfit = (conversationState?.current_turn || 0) - (conversationState?.last_outfit_generation_turn || 0);
    
    const userContextMessage = {
      role: "system",
      content: `
<USER_CONTEXT>
  <NAME>${userProfile?.name || ''}</NAME>
  <GENDER>${userProfile?.gender || ''}</GENDER>
  <LOCATION>${userProfile?.location || 'India'}</LOCATION>
  <BODY_SHAPE>${bodyShape || ''}</BODY_SHAPE>
  <SKIN_TONE>${skinTone || ''}</SKIN_TONE>
  
  <CONVERSATION_STATE>
    <CURRENT_MODE>${conversationMode}</CURRENT_MODE>
    <CURRENT_TURN>${conversationState?.current_turn || 0}</CURRENT_TURN>
    <LAST_OUTFIT_GENERATION_TURN>${conversationState?.last_outfit_generation_turn || 0}</LAST_OUTFIT_GENERATION_TURN>
    <TURNS_SINCE_LAST_OUTFIT>${turnsSinceLastOutfit}</TURNS_SINCE_LAST_OUTFIT>
    <CONSECUTIVE_OUTFIT_BLOCKS>${conversationState?.consecutive_outfit_blocks || 0}</CONSECUTIVE_OUTFIT_BLOCKS>
    <LAST_INTENT_DETECTED>${conversationState?.last_intent_detected || 'none'}</LAST_INTENT_DETECTED>
    <LAST_INTENT_CONFIDENCE>${((conversationState?.last_intent_confidence || 0) * 100).toFixed(0)}%</LAST_INTENT_CONFIDENCE>
    <LAST_KNOWN_OCCASION>${conversationState?.last_known_occasion || 'none'}</LAST_KNOWN_OCCASION>
    <LAST_QUERY_TYPE>${conversationState?.last_user_query_type || 'none'}</LAST_QUERY_TYPE>
    <RECOMMENDATION_MODE>${conversationState?.recommendation_mode || 'outfit'}</RECOMMENDATION_MODE>
    <OUTSTANDING_QUESTION>${conversationState?.outstanding_question_flag || false}</OUTSTANDING_QUESTION>
    <CHAT_DIRECTION>${conversationState?.chat_direction || 'casual_chat'}</CHAT_DIRECTION>
  </CONVERSATION_STATE>
  
  <EMOTIONAL_CONTEXT>
    <CURRENT_EMOTIONAL_TONE>${emotionalDetection.emotional_tone}</CURRENT_EMOTIONAL_TONE>
    <EMOTIONAL_CONFIDENCE>${emotionalDetection.confidence}%</EMOTIONAL_CONFIDENCE>
    <SOFT_MODE_REQUIRED>${emotionalDetection.soft_mode_required}</SOFT_MODE_REQUIRED>
    <EMOTIONAL_SIGNALS>${emotionalDetection.signals.join('; ')}</EMOTIONAL_SIGNALS>
  </EMOTIONAL_CONTEXT>
  
  <TASTE_PROFILE>
    <WARDROBE_SIZE>${wardrobePersona.wardrobe_size}</WARDROBE_SIZE>
    <COLOR_PALETTE>${wardrobePersona.color_palette}</COLOR_PALETTE>
    <DOMINANT_COLORS>${wardrobePersona.dominant_colors.join(', ')}</DOMINANT_COLORS>
    <COMMON_PATTERNS>${wardrobePersona.common_patterns.join(', ')}</COMMON_PATTERNS>
    <STYLE_AESTHETICS>${wardrobePersona.style_aesthetic.join(', ')}</STYLE_AESTHETICS>
    <FORMALITY_LEVEL>${wardrobePersona.formality_level}</FORMALITY_LEVEL>
  </TASTE_PROFILE>
  
  <USER_PREFERENCES>
${userPreferences.map(p => `    <PREFERENCE type="${p.preference_type}" key="${p.preference_key}" confidence="${(p.confidence_score * 100).toFixed(0)}%" source="${p.source}">${JSON.stringify(p.preference_value)}</PREFERENCE>`).join('\n')}
  </USER_PREFERENCES>
  
  <WARDROBE_VALIDATION>
    <TOTAL_ITEMS>${wardrobeValidation.total_items}</TOTAL_ITEMS>
    <HAS_MINIMUM_ITEMS>${wardrobeValidation.has_minimum_items}</HAS_MINIMUM_ITEMS>
    <HAS_TOPS>${wardrobeValidation.has_tops}</HAS_TOPS>
    <HAS_BOTTOMS>${wardrobeValidation.has_bottoms}</HAS_BOTTOMS>
    <HAS_SHOES>${wardrobeValidation.has_shoes}</HAS_SHOES>
    <HAS_ETHNIC_SET>${wardrobeValidation.has_ethnic_set}</HAS_ETHNIC_SET>
    <HAS_DRESSES>${wardrobeValidation.has_dresses}</HAS_DRESSES>
    <WARDROBE_HEALTH_SCORE>${wardrobeValidation.wardrobe_health_score}/100</WARDROBE_HEALTH_SCORE>
    <CATEGORIES>${wardrobeValidation.categories.join(', ')}</CATEGORIES>
  </WARDROBE_VALIDATION>
  
  <CURRENT_INTENT_DETECTION>
    <DETECTED_INTENT>${intentDetection.intent}</DETECTED_INTENT>
    <CONFIDENCE>${intentDetection.confidence}%</CONFIDENCE>
    <IS_CONTINUATION>${intentDetection.is_continuation || false}</IS_CONTINUATION>
    <CONTEXT_WEIGHT>${intentDetection.context_weight || 0}</CONTEXT_WEIGHT>
    <INFERRED_OCCASION>${occasionInference.inferred_occasion || 'none'}</INFERRED_OCCASION>
    <OCCASION_CONFIDENCE>${occasionInference.confidence}%</OCCASION_CONFIDENCE>
  </CURRENT_INTENT_DETECTION>
</USER_CONTEXT>

<CRITICAL_RULES>
CONVERSATION MODE AWARENESS:
  - Current mode: ${conversationMode}
  - Emotional tone: ${emotionalDetection.emotional_tone}
  - Soft mode required: ${emotionalDetection.soft_mode_required}
  
  BEHAVIOR BY MODE:
    • EMOTIONAL_SUPPORT: No outfit suggestions, empathetic tone, supportive
    • CASUAL_CHAT: No outfit auto-generation, light personality
    • PLAYFUL_BANTER: Witty, hype, teasing energy - NO outfit generation unless explicitly asked
    • STYLE_DISCOVERY: Short insights, 1 clarifying question max
    • OUTFIT_REQUEST_ACTIVE: Generate outfits using Outfit Engine
    • SHOPPING_EXPLORATION: Brand picks, wardrobe-aware recommendations
    • WARDROBE_MANAGEMENT: Pairing ideas, organization insights

ANTI-SPAM PROTECTION:
  - Last outfit generation was at turn ${conversationState?.last_outfit_generation_turn || 0}
  - Current turn is ${conversationState?.current_turn || 0}
  - Turns since last outfit: ${turnsSinceLastOutfit}
  - Consecutive blocks: ${conversationState?.consecutive_outfit_blocks || 0}
  - Generation eligibility: ${canGenerate ? 'ALLOWED' : 'BLOCKED'}
  - DO NOT generate outfits if turns_since_last_outfit < 2 UNLESS user explicitly asks for "more", "different", "another"
  - If blocked 3+ times consecutively, user likely wants to chat, not get styled

TIMING INTELLIGENCE:
  - Detected intent: ${intentDetection.intent}
  - Confidence: ${intentDetection.confidence}%
  - Query type: ${intentDetection.query_type}
  - Is continuation: ${intentDetection.is_continuation || false}
  - Conversation mode: ${conversationMode}
  - CAN_GENERATE_OUTFIT: ${canGenerate}
  
  ${!canGenerate ? `
  ⚠️ OUTFIT GENERATION BLOCKED - Respond conversationally instead
  Reason: Anti-spam check failed or eligibility criteria not met
  DO NOT call generate_outfits tool
  ` : ''}
  
  GENERATE OUTFITS IMMEDIATELY when:
    ✓ canGenerateOutfit validation: ${canGenerate}
    ✓ Intent is 'explicit_outfit' OR 'implicit_outfit'
    ✓ Confidence ≥ 60%
    ✓ Occasion known OR inferred
    ✓ Wardrobe has minimum items OR flexible generation possible
    ✓ Turns since last outfit ≥ 2
    ✓ Mode is OUTFIT_REQUEST_ACTIVE or STYLE_DISCOVERY with high intent
  
  ASK ONE CLARIFYING QUESTION when:
    • Intent confidence ≥ 60% BUT occasion unclear
    • Example: "What's the occasion?"
  
  DO NOT GENERATE when:
    ✗ canGenerateOutfit validation: false
    ✗ Mode is CASUAL_CHAT, PLAYFUL_BANTER, EMOTIONAL_SUPPORT (unless explicit request)
    ✗ Intent is 'theory', 'shopping', 'wardrobe-info', 'general'
    ✗ Confidence < 60%
    ✗ Turns since last outfit < 2 (anti-spam)
    ✗ Wardrobe completely empty (0 items)
    ✗ Emotional tone requires soft mode and user didn't ask for styling

1-QUESTION RULE:
  - Maximum 1 clarifying question per request
  - Outstanding question flag: ${conversationState?.outstanding_question_flag || false}
  - If outstanding_question = true, generate immediately on next turn
</CRITICAL_RULES>
`
    };

    // Wardrobe summary and data - separated for better context management
    const wardrobeSummary = `
<WARDROBE_SUMMARY>
total_items=${wardrobeItems?.length || 0}
categories=${[...new Set((wardrobeItems || []).map((i: any) => i.category))].join(", ")}
</WARDROBE_SUMMARY>
`;

    const wardrobeJSON = `WARDROBE_DATA_JSON:\n${JSON.stringify(wardrobeItems || [])}`;
    const battlesJSON = `RECENT_BATTLES_JSON:\n${JSON.stringify(recentBattles || [])}`;
    const styleChecksJSON = `RECENT_STYLE_CHECKS_JSON:\n${JSON.stringify(recentStyleChecks || [])}`;

    // Process messages to handle images
    const processedMessages = messages.map((msg: any) => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map((img: string) => ({
              type: 'image_url',
              image_url: { url: img }
            }))
          ]
        };
      }
      return msg;
    });

    console.log('Chat: processed messages', { count: processedMessages.length });

    // Define AI tools
    const tools = [
      {
        type: "function",
        function: {
          name: "fetch_wardrobe_items",
          description: "Fetch and filter wardrobe items by category. Use when user asks to see specific items (e.g., 'show my shoes').",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Category filter: Tops, Bottoms, Shoes, Outerwear, Accessories, Dresses, or All for all items",
                enum: ["Tops", "Bottoms", "Shoes", "Outerwear", "Accessories", "Dresses", "All"]
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_wardrobe_items",
          description: "Display wardrobe items (internal use after fetch_wardrobe_items).",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional: filter by category (tops, bottoms, shoes, dresses, outerwear, accessories, etc.)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_outfits",
          description: `Generate complete outfit suggestions from user's wardrobe.

⚠️ CRITICAL ANTI-SPAM CHECK (MUST CHECK BEFORE CALLING):
- Current turn: ${conversationState?.current_turn || 0}
- Last outfit generation turn: ${conversationState?.last_outfit_generation_turn || 0}
- Turns since last outfit: ${(conversationState?.current_turn || 0) - (conversationState?.last_outfit_generation_turn || 0)}

ONLY call this tool if BOTH conditions are met:
  ✓ Intent confidence >= 60% AND
  ✓ (turns_since_last_outfit >= 2 OR user explicitly requests "more", "different", "another", "new outfits", "show me more")
  
DO NOT CALL if:
  ✗ User is chatting casually ("what?", "nice", "ok", "cool", "bro", general conversation)
  ✗ turns_since_last_outfit < 2 (unless explicit request for more)
  ✗ User asks theory/shopping/general questions
  ✗ Intent confidence < 60%

If anti-spam triggered, respond conversationally instead of calling this tool.

WHEN TO USE - TWO SCENARIOS:

A) USER SPECIFIES OCCASION → Call immediately (if anti-spam check passes):
   - "what should I wear for [occasion]"
   - "outfit for [occasion]" 
   - "[occasion] outfit"
   Examples: "date night", "what should I wear casually", "outfit for work"

B) USER DOESN'T SPECIFY OCCASION → Ask for occasion first (max 1 question):
   - "what outfits can I create"
   - "suggest outfits"
   Examples: "what outfits can I create?" → Ask: "What occasion are you dressing for?"
   
After they specify occasion, THEN call this tool (if anti-spam check passes).`,
          parameters: {
            type: "object",
            properties: {
              occasion: {
                type: "string",
                description: "The occasion or context (casual, formal, date, wedding, party, business, interview, workout, beach, brunch, date night, etc.)"
              },
              style: {
                type: "string",
                description: "Desired style (smart casual, streetwear, elegant, sporty, comfortable, etc.)"
              },
              count: {
                type: "number",
                description: "Number of outfits to generate (1-5, default 3)"
              }
            },
            required: ["occasion"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_shopping_needs",
          description: "Detect wardrobe gaps and provide personalized shopping recommendations with budget awareness, brand suggestions, and styling opinions",
          parameters: {
            type: "object",
            properties: {
              occasion: {
                type: "string",
                description: "Specific occasion user mentioned (if any)"
              },
              request_type: {
                type: "string",
                description: "Type of shopping request",
                enum: ["gap_analysis", "occasion_specific", "brand_recommendation", "general_advice"]
              },
              style_preference: {
                type: "string",
                description: "User style preference if mentioned"
              }
            },
            required: ["request_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_user_preference",
          description: "Save or update a user's style preference. Use when user explicitly states a preference (e.g., 'I love oversized fits', 'I prefer minimal colors', 'I'm not into bold patterns').",
          parameters: {
            type: "object",
            properties: {
              preference_type: {
                type: "string",
                enum: ["fashion", "vibe", "brand", "emotional", "experiment_level"],
                description: "Type of preference"
              },
              preference_key: {
                type: "string",
                description: "Key identifier (e.g., 'preferred_silhouette', 'color_preference', 'brand_affinity')"
              },
              preference_value: {
                type: "string",
                description: "The preference value (e.g., 'oversized', 'minimal', 'high')"
              },
              source: {
                type: "string",
                enum: ["explicit", "inferred", "repeated"],
                description: "How the preference was detected"
              },
              confidence: {
                type: "number",
                description: "Confidence score 0-1"
              }
            },
            required: ["preference_type", "preference_key", "preference_value"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "run_style_check",
          description: "Redirect user to Style Check feature. Only use when user EXPLICITLY asks to check/rate an outfit they uploaded or described. Chat cannot run style checks directly.",
          parameters: {
            type: "object",
            properties: {
              image_url: { 
                type: "string", 
                description: "URL of the uploaded outfit image (if any)" 
              },
              context: { 
                type: "string", 
                description: "What the user said about the outfit" 
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "recommend_brands",
          description: "Provide specific brand recommendations based on user's style, budget, and wardrobe gaps. Use when user explicitly asks 'where should I shop?', 'which brands?', 'where to buy?'",
          parameters: {
            type: "object",
            properties: {
              focus: {
                type: "string",
                description: "What to focus recommendations on",
                enum: ["wardrobe_gaps", "specific_occasion", "style_alignment", "general"]
              },
              occasion: {
                type: "string",
                description: "Specific occasion if mentioned"
              },
              item_category: {
                type: "string",
                description: "Specific category (Tops, Bottoms, Shoes, etc.) if user asks for specific item type"
              }
            },
            required: ["focus"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_wardrobe_items",
          description: "ALWAYS use this to visually display wardrobe items when user says 'show me', 'display', 'let me see'. REQUIRED for outfit combinations.",
          parameters: {
            type: "object",
            properties: {
              item_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of wardrobe item IDs to display"
              },
              context: {
                type: "string",
                description: "Brief explanation of why these items are being shown"
              }
            },
            required: ["item_ids", "context"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_outfit_suggestion",
          description: "Create and display visual outfit suggestions to the user",
          parameters: {
            type: "object",
            properties: {
              outfits: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    outfit_name: { type: "string" },
                    item_ids: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" }
                  },
                  required: ["outfit_name", "item_ids", "reasoning"]
                }
              }
            },
            required: ["outfits"]
          }
        }
      }
    ];

    // PHASE 2: Tool blocking - Remove generate_outfits if confidence < 60% or wrong intent
    let availableTools = [...tools];
    const hasImages = messages.some((m: any) => m.images && m.images.length > 0);
    const lastMessageHasImages = lastUserMessage?.images?.length > 0;
    
    // PHASE 6: Stricter tool blocking for implicit intent
    const shouldBlockOutfitGeneration = 
      intentDetection.confidence < 0.6 || 
      ['general', 'theory', 'shopping', 'wardrobe-info', 'item_only'].includes(intentDetection.intent) ||
      intentDetection.intent === 'implicit_outfit'; // Block implicit - requires confirmation
    
    if (shouldBlockOutfitGeneration) {
      availableTools = tools.filter(t => t.function.name !== 'generate_outfits');
      console.log('[TOOL BLOCK] generate_outfits removed - ', {
        reason: intentDetection.intent === 'implicit_outfit' ? 'implicit intent requires confirmation' : 'confidence/intent check failed',
        intent: intentDetection.intent,
        confidence: intentDetection.confidence
      });
    }
    
    // PHASE 3: Image upload detection - ANSWER FIRST, then offer options
    if (lastMessageHasImages) {
      // Check if user asked a question
      const hasQuestion = /\?|how|what|rate|check|does this|is this|would this|good|bad|work/i.test(lastUserMessage?.content || '');
      
      if (hasQuestion) {
        // User asked a question - instruct AI to answer FIRST
        antiSpamInstruction += `\n\n📸 IMAGE WITH QUESTION DETECTED:
1. FIRST: Answer the user's question about the outfit (give style feedback, rating, or opinion)
2. THEN at the END of your response, offer secondary options:
   "If you'd like, I can also:
   • Add pieces from this to your wardrobe
   • Run a detailed Style Check
   Or we can just keep chatting!"
DO NOT ask what they want to do BEFORE answering their question.`;
      } else {
        // No question - just uploaded an image, ask what they want
        antiSpamInstruction += `\n\n📸 IMAGE UPLOADED (no question):
Ask user: "Nice! What would you like me to do with this?
1. Add to wardrobe
2. Run a style check  
3. Just want your opinion"
WAIT for user response before taking any action.`;
      }
    }
    
    // PHASE 5: Session preference detection
    const preferencePatterns = {
      boldness: {
        bolder: /\b(not bold enough|too safe|more adventurous|push me|experiment)\b/i,
        safer: /\b(too bold|too much|tone it down|more classic|safer)\b/i
      },
      color: {
        colorful: /\b(more color|colorful|vibrant|pop of color|brighter)\b/i,
        neutral: /\b(too colorful|more neutral|toned down|muted)\b/i
      }
    };
    
    // Update session preferences based on feedback
    if (lastUserMessage?.content) {
      const currentPrefs = conversationState?.session_preferences || {
        boldness_level: 'medium',
        color_intensity: 'neutral',
        formality_bias: 'casual'
      };
      
      if (preferencePatterns.boldness.bolder.test(lastUserMessage.content)) {
        await updateConversationState(supabase, userId, {
          session_preferences: { ...currentPrefs, boldness_level: 'bold' }
        });
      } else if (preferencePatterns.boldness.safer.test(lastUserMessage.content)) {
        await updateConversationState(supabase, userId, {
          session_preferences: { ...currentPrefs, boldness_level: 'safe' }
        });
      }
      
      if (preferencePatterns.color.colorful.test(lastUserMessage.content)) {
        await updateConversationState(supabase, userId, {
          session_preferences: { ...currentPrefs, color_intensity: 'colorful' }
        });
      } else if (preferencePatterns.color.neutral.test(lastUserMessage.content)) {
        await updateConversationState(supabase, userId, {
          session_preferences: { ...currentPrefs, color_intensity: 'neutral' }
        });
      }
    }

    console.log('Chat: calling Gemini API', {
      model: 'google/gemini-2.5-flash',
      messageCount: processedMessages.length,
      toolsCount: availableTools.length,
      toolsBlocked: tools.length - availableTools.length,
      hasImages: hasImages,
      lastMessageHasImages: lastMessageHasImages
    });

    // FINAL VALIDATION: Ensure systemPrompt hasn't been corrupted
    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.length === 0) {
      console.error("CRITICAL ERROR: systemPrompt corrupted before API call!");
      throw new Error("System prompt validation failed - refusing to call AI without persona");
    }

    // Call Gemini API with streaming
    const response = await retryWithBackoff(() => callGeminiAPIStreaming({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: "system", content: systemPrompt },
        userContextMessage,
        // CRITICAL: Inject Module 09, 10, 13 prompts EVERY TIME to ensure outfit generation follows styling rules
        { role: "system", content: TOOL_USAGE_RULES_PROMPT },     // Module 09 - Tool Usage Rules
        { role: "system", content: OUTFIT_ENGINE_PROMPT },        // Module 10 - Outfit Engine
        { role: "system", content: WARDROBE_ENGINE_PROMPT },      // Module 13 - Wardrobe Engine
        { role: "system", content: `${wardrobeSummary}\n\n${wardrobeJSON}\n\n${battlesJSON}\n\n${styleChecksJSON}` },
        ...processedMessages
      ],
      tools: availableTools,
      temperature: 0.7,
      max_tokens: 2048
    }));

    console.log('Chat: streaming response');

    // Transform Gemini SSE format to OpenAI format
    let assistantMessage = '';
    const lastUserMsg = processedMessages.filter((m: any) => m.role === 'user').pop();

    const transformStream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                // Parse Gemini format
                const geminiData = JSON.parse(jsonStr);
                const candidate = geminiData.candidates?.[0];
                
                if (!candidate) continue;

                console.log('Transform: received Gemini chunk', { hasCandidate: !!candidate });

                // Handle function calls
                const functionCall = candidate.content?.parts?.find((p: any) => p.functionCall);
                if (functionCall) {
                  // PHASE 2: run_style_check handler - call score-outfit
                  if (functionCall.functionCall.name === 'run_style_check') {
                    const imageUrl = functionCall.functionCall.args.image_url;
                    
                    if (imageUrl) {
                      try {
                        console.log('[RUN_STYLE_CHECK] Calling score-outfit:', { imageUrl });
                        
                        const scoreResponse = await fetch(`${supabaseUrl}/functions/v1/score-outfit`, {
                          method: 'POST',
                          headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ 
                            imageData: imageUrl,
                            occasion: functionCall.functionCall.args.occasion,
                            style: functionCall.functionCall.args.style
                          })
                        });
                        
                        if (scoreResponse.ok) {
                          const styleResult = await scoreResponse.json();
                          functionCall.functionCall.args.style_result = styleResult;
                          console.log('[RUN_STYLE_CHECK] Success:', styleResult);
                        } else {
                          const errorText = await scoreResponse.text();
                          console.error('[RUN_STYLE_CHECK] Failed:', errorText);
                          functionCall.functionCall.args.style_result = { error: 'Failed to analyze outfit' };
                        }
                      } catch (error) {
                        console.error('[RUN_STYLE_CHECK] Error:', error);
                        functionCall.functionCall.args.style_result = { error: 'Failed to analyze outfit' };
                      }
                    }
                  }
                  
                  // PHASE 1: add_to_wardrobe handler - call process-wardrobe
                  if (functionCall.functionCall.name === 'add_to_wardrobe') {
                    const imageUrl = functionCall.functionCall.args.image_url;
                    
                    if (imageUrl) {
                      try {
                        console.log('[ADD_TO_WARDROBE] Calling process-wardrobe:', { imageUrl });
                        
                        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-wardrobe`, {
                          method: 'POST',
                          headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ imageUrl })
                        });
                        
                        if (processResponse.ok) {
                          const result = await processResponse.json();
                          functionCall.functionCall.args.processing_result = result;
                          console.log('[ADD_TO_WARDROBE] Success:', result);
                        } else {
                          const errorText = await processResponse.text();
                          console.error('[ADD_TO_WARDROBE] Failed:', errorText);
                          functionCall.functionCall.args.processing_result = { 
                            success: false, 
                            error: 'Failed to process image' 
                          };
                        }
                      } catch (error) {
                        console.error('[ADD_TO_WARDROBE] Error:', error);
                        functionCall.functionCall.args.processing_result = { 
                          success: false, 
                          error: 'Failed to process image' 
                        };
                      }
                    }
                  }
                  
                  // PHASE 2: fetch_wardrobe_items handler - filter and convert to show_wardrobe_items
                  if (functionCall.functionCall.name === 'fetch_wardrobe_items') {
                    const category = functionCall.functionCall.args.category;
                    let filteredItems = wardrobeItems || [];
                    
                    if (category && category !== 'All') {
                      filteredItems = wardrobeItems.filter((item: any) => 
                        item.category?.toLowerCase() === category.toLowerCase()
                      );
                    }
                    
                    console.log('[FETCH_WARDROBE_ITEMS]', {
                      category,
                      totalItems: wardrobeItems.length,
                      filteredCount: filteredItems.length
                    });
                    
                    // Convert to show_wardrobe_items format
                    functionCall.functionCall.name = 'show_wardrobe_items';
                    functionCall.functionCall.args = {
                      item_ids: filteredItems.map((i: any) => i.id),
                      context: category && category !== 'All' ? `Your ${category}` : 'Your wardrobe items',
                      items: filteredItems // Include full item data
                    };
                  }
                  
                  // Track outfit generation in conversation state
                  if (functionCall.functionCall.name === 'generate_outfits') {
                    // PHASE 5: Inject emotional context, taste profile, and session preferences into args
                    functionCall.functionCall.args = {
                      ...functionCall.functionCall.args,
                      session_preferences: conversationState?.session_preferences,
                      emotionalContext: emotionalDetection,
                      tasteProfile: wardrobePersona,
                      conversationMode: conversationMode,
                    };
                    
                    await updateConversationState(supabase, userId, {
                      last_outfit_generation_turn: currentTurn,
                      recommendation_mode: 'outfit',
                      outstanding_question_flag: false,
                      consecutive_outfit_blocks: 0, // Reset block counter on successful generation
                    });
                    
                    console.log('[OUTFIT GENERATION] Injected context:', {
                      emotional_tone: emotionalDetection.emotional_tone,
                      conversation_mode: conversationMode,
                      color_palette: wardrobePersona.color_palette
                    });
                  }
                  
                  if (functionCall.functionCall.name === 'show_wardrobe_items') {
                    await updateConversationState(supabase, userId, {
                      recommendation_mode: 'items',
                    });
                  }
                  
                  if (functionCall.functionCall.name === 'analyze_shopping_needs') {
                    // Enhance with v5 shopping engine analysis
                    const wardrobeGaps = await analyzeWardrobeGaps(supabase, userId);
                    const recommendations = await generateShoppingRecommendations(
                      supabase,
                      userId,
                      wardrobeGaps,
                      wardrobePersona,
                      functionCall.functionCall.args.occasion
                    );
                    
                    const budgetTier = inferBudgetTier(
                      wardrobePersona.wardrobe_size || 0,
                      wardrobePersona.style_aesthetic || []
                    );
                    
                    // Inject v5 analysis into tool call
                    functionCall.functionCall.args.shopping_analysis = {
                      wardrobe_gaps: wardrobeGaps,
                      recommendations: recommendations,
                      budget_awareness: {
                        suggested_tier: budgetTier,
                        reasoning: `Based on your wardrobe size (${wardrobePersona.wardrobe_size}) and style (${wardrobePersona.style_aesthetic.join(', ')}), I recommend the ${budgetTier.replace('_', ' ')} tier.`
                      },
                      immediate_needs: wardrobeGaps.filter(g => g.priority === 'high').map(g => g.gap_description),
                      long_term_needs: wardrobeGaps.filter(g => g.priority !== 'high').map(g => g.gap_description)
                    };
                    
                    console.log('[SHOPPING ANALYSIS v5]', {
                      gaps: wardrobeGaps.length,
                      recommendations: recommendations.length,
                      budgetTier
                    });
                    
                    await updateConversationState(supabase, userId, {
                      recommendation_mode: 'general',
                    });
                  }
                  
                  if (functionCall.functionCall.name === 'recommend_brands') {
                    // v6 Brand Recommender Integration
                    const wardrobeGaps = await analyzeWardrobeGaps(supabase, userId);
                    const budgetTier = inferBudgetTier(
                      wardrobePersona.wardrobe_size || 0,
                      wardrobePersona.style_aesthetic || []
                    );
                    
                    const brandRecommendations = await generateBrandRecommendations({
                      wardrobeGaps: wardrobeGaps,
                      styleAesthetics: wardrobePersona.style_aesthetic || [],
                      budgetTier: budgetTier,
                      occasion: functionCall.functionCall.args.occasion,
                      specificRequest: functionCall.functionCall.args.item_category || functionCall.functionCall.args.focus
                    });
                    
                    // Inject brand recommendations into tool call
                    functionCall.functionCall.args.brand_recommendations = brandRecommendations;
                    functionCall.functionCall.args.budget_tier = budgetTier;
                    
                    console.log('[BRAND RECOMMENDATIONS v6]', {
                      count: brandRecommendations.length,
                      brands: brandRecommendations.map(b => b.brand_name),
                      budgetTier
                    });
                    
                    await updateConversationState(supabase, userId, {
                      recommendation_mode: 'general',
                    });
                  }
                  
                  // Handle preference updates
                  if (functionCall.functionCall.name === 'update_user_preference') {
                    const args = functionCall.functionCall.args;
                    try {
                      await savePreference(
                        supabase,
                        userId,
                        args.preference_type,
                        args.preference_key,
                        args.preference_value,
                        args.source || 'explicit',
                        args.confidence || 0.8
                      );
                      console.log('[PREFERENCE SAVED]', args);
                    } catch (err) {
                      console.error('[PREFERENCE SAVE FAILED]', err);
                    }
                  }
                  
                  const openAIFormat = {
                    choices: [{
                      delta: {
                        tool_calls: [{
                          type: 'function',
                          function: {
                            name: functionCall.functionCall.name,
                            arguments: JSON.stringify(functionCall.functionCall.args)
                          }
                        }]
                      }
                    }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                  continue;
                }

                // Handle text content
                const textPart = candidate.content?.parts?.find((p: any) => p.text);
                if (textPart?.text) {
                  assistantMessage += textPart.text;  // Accumulate full message
                  console.log('Transform: sending OpenAI format', { hasContent: true, chunkLength: textPart.text.length });
                  
                  const openAIFormat = {
                    choices: [{
                      delta: {
                        content: textPart.text
                      }
                    }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                }
              } catch (parseErr) {
                console.error('Failed to parse Gemini SSE:', parseErr);
              }
            }
          }

          console.log('Transform: stream ended, total chars:', assistantMessage.length);

          // After stream ends, call pill-suggestions
          if (lastUserMsg && assistantMessage) {
            try {
              console.log('Calling pill-suggestions with:', { 
                userMsgLength: lastUserMsg.content?.length || 0, 
                assistantMsgLength: assistantMessage.length 
              });

              const pillResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pill-suggestions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': req.headers.get('Authorization') || ''
                },
                body: JSON.stringify({
                  lastUserMessage: typeof lastUserMsg.content === 'string' ? lastUserMsg.content : lastUserMsg.content[0].text,
                  lastAssistantMessage: assistantMessage
                })
              });

              if (pillResponse.ok) {
                const { suggestions } = await pillResponse.json();
                console.log('Pill suggestions received:', suggestions);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'suggestions', pills: suggestions })}\n\n`));
              } else {
                console.error('Pill suggestions failed:', await pillResponse.text());
              }
            } catch (pillErr) {
              console.error('Pill generation failed:', pillErr);
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream transform error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(transformStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });

  } catch (error) {
    console.error('Chat: error processing request', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
