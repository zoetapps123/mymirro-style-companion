import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ConversationState {
  user_id: string;
  last_outfit_generation_turn: number;
  last_intent_detected: string | null;
  last_intent_confidence: number | null;
  last_known_occasion: string | null;
  last_user_query_type: string | null;
  wardrobe_validation_state: any;
  recommendation_mode: 'outfit' | 'items' | 'general';
  outstanding_question_flag: boolean;
  last_generated_outfit_ids: string[];
  current_turn: number;
  emotional_tone: string | null;
  chat_direction: string;
  last_mode_used: string | null;
  consecutive_outfit_blocks: number;
  last_5_intents: any[];
  session_preferences: {
    boldness_level: 'safe' | 'medium' | 'bold';
    color_intensity: 'neutral' | 'colorful';
    formality_bias: 'casual' | 'smart_casual' | 'formal';
  } | null;
}

export type ConversationMode = 
  | 'CASUAL_CHAT'
  | 'STYLE_DISCOVERY'
  | 'OUTFIT_REQUEST_ACTIVE'
  | 'SHOPPING_ADVISOR'
  | 'WARDROBE_MANAGEMENT'
  | 'WARDROBE_EXPLORATION'
  | 'VISUAL_SIMULATION'
  | 'CHALLENGE_MODE'
  | 'ROAST_MODE'
  | 'FEEDBACK_MODE'
  | 'EMOTIONAL_SUPPORT'
  | 'CONFIRMATION_PENDING'
  | 'IMAGE_UPLOAD_PENDING';

export async function getConversationState(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from('conversation_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching conversation state:', error);
    return null;
  }

  if (!data) {
    // No state found - initialize
    const newState = await initializeConversationState(supabase, userId);
    return newState;
  }
  
  return data;
}

export async function initializeConversationState(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationState> {
  const { data, error } = await supabase
    .from('conversation_state')
    .insert({
      user_id: userId,
      current_turn: 0,
      recommendation_mode: 'outfit',
      last_outfit_generation_turn: 0,
      outstanding_question_flag: false,
      last_generated_outfit_ids: [],
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error initializing conversation state:', error);
    throw error;
  }
  return data;
}

export async function updateConversationState(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<ConversationState>
): Promise<void> {
  const { error } = await supabase
    .from('conversation_state')
    .upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  
  if (error) {
    console.error('Error updating conversation state:', error);
    throw error;
  }
}

export async function incrementTurn(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const state = await getConversationState(supabase, userId);
  const newTurn = (state?.current_turn || 0) + 1;
  
  await updateConversationState(supabase, userId, {
    current_turn: newTurn,
  });
  
  return newTurn;
}

export async function trackIntent(
  supabase: SupabaseClient,
  userId: string,
  intent: string,
  confidence: number,
  queryType: string
): Promise<void> {
  const state = await getConversationState(supabase, userId);
  const intentHistory = state?.last_5_intents || [];
  
  // Add new intent and keep only last 5
  const newIntent = {
    intent,
    confidence,
    queryType,
    timestamp: new Date().toISOString(),
  };
  
  const updatedHistory = [newIntent, ...intentHistory].slice(0, 5);
  
  await updateConversationState(supabase, userId, {
    last_5_intents: updatedHistory,
    last_intent_detected: intent,
    last_intent_confidence: confidence,
    last_user_query_type: queryType,
  });
}

export function determineConversationMode(
  state: ConversationState,
  currentIntent: { intent: string; confidence: number; query_type: string },
  emotionalContext?: { emotional_tone: string; soft_mode_required: boolean }
): ConversationMode {
  // Priority 1: Emotional support (HIGHEST - soft mode)
  if (emotionalContext?.soft_mode_required) {
    console.log('[Conversation State] Mode: EMOTIONAL_SUPPORT (soft mode required)');
    return 'EMOTIONAL_SUPPORT';
  }

  // Priority 2: Visual simulation (when user asks "how will this look?")
  if (currentIntent.intent === 'visual_simulation') {
    console.log('[Conversation State] Mode: VISUAL_SIMULATION');
    return 'VISUAL_SIMULATION';
  }

  // Priority 3: Wardrobe exploration (when user wants to see items)
  if (currentIntent.intent === 'item_only' || currentIntent.intent === 'wardrobe-info') {
    console.log('[Conversation State] Mode: WARDROBE_EXPLORATION');
    return 'WARDROBE_EXPLORATION';
  }

  // Priority 4: Active outfit request (explicit)
  if (currentIntent.intent === 'explicit_outfit' && currentIntent.confidence > 0.8) {
    console.log('[Conversation State] Mode: OUTFIT_REQUEST_ACTIVE (explicit request)');
    return 'OUTFIT_REQUEST_ACTIVE';
  }

  // Priority 5: Active outfit request (implicit - must be >60% confidence)
  if (currentIntent.intent === 'implicit_outfit' && currentIntent.confidence >= 0.6) {
    console.log('[Conversation State] Mode: OUTFIT_REQUEST_ACTIVE (implicit request)');
    return 'OUTFIT_REQUEST_ACTIVE';
  }

  // Priority 6: Shopping advisor
  if (currentIntent.intent === 'shopping' && currentIntent.confidence > 0.6) {
    console.log('[Conversation State] Mode: SHOPPING_ADVISOR');
    return 'SHOPPING_ADVISOR';
  }

  // Priority 7: Wardrobe management
  if (currentIntent.query_type === 'wardrobe_query') {
    console.log('[Conversation State] Mode: WARDROBE_MANAGEMENT');
    return 'WARDROBE_MANAGEMENT';
  }

  // Priority 8: Style discovery (fashion theory questions)
  if (currentIntent.intent === 'theory' || currentIntent.query_type === 'theory_question') {
    console.log('[Conversation State] Mode: STYLE_DISCOVERY');
    return 'STYLE_DISCOVERY';
  }

  // Default: Casual chat
  console.log('[Conversation State] Mode: CASUAL_CHAT (default)');
  return 'CASUAL_CHAT';
}

export function canGenerateOutfit(
  state: ConversationState,
  intent: { intent: string; confidence: number },
  wardrobeItemCount: number,
  emotionalContext?: { soft_mode_required: boolean },
  hasImages?: boolean
): boolean {
  // PHASE 4: Enhanced strict guards
  
  // STRICT GUARD 1: Block if images uploaded without explicit outfit request
  if (hasImages && intent.intent !== 'explicit_outfit') {
    console.log('[Outfit Generation] BLOCKED: Image uploaded - needs user choice');
    return false;
  }
  
  // STRICT GUARD 2: Emotional/soft mode - NEVER generate outfits
  if (emotionalContext?.soft_mode_required) {
    console.log('[Outfit Generation] BLOCKED: Soft mode active (emotional support needed)');
    return false;
  }

  // STRICT GUARD 3: Must have at least 5 items in wardrobe
  if (wardrobeItemCount < 5) {
    console.log('[Outfit Generation] BLOCKED: Insufficient wardrobe items (<5)');
    return false;
  }

  // STRICT GUARD 4: Must be explicit outfit intent ONLY
  if (intent.intent !== 'explicit_outfit') {
    console.log('[Outfit Generation] BLOCKED: Not an explicit outfit request');
    return false;
  }

  // STRICT GUARD 5: Confidence must be ≥60%
  if (intent.confidence < 0.6) {
    console.log('[Outfit Generation] BLOCKED: Confidence too low (<60%)');
    return false;
  }

  // STRICT GUARD 6: 2-TURN COOLDOWN - enforce strictly
  const turnsSinceOutfit = state.current_turn - (state.last_outfit_generation_turn || 0);
  if (turnsSinceOutfit < 2) {
    console.log(`[Outfit Generation] BLOCKED: Cooldown active (${turnsSinceOutfit}/2 turns)`);
    return false;
  }

  // STRICT GUARD 7: If user has been blocked 3+ times consecutively, they want to chat
  if (state.consecutive_outfit_blocks && state.consecutive_outfit_blocks >= 3) {
    console.log('[Outfit Generation] BLOCKED: Too many consecutive blocks (user wants to chat)');
    return false;
  }

  console.log('[Outfit Generation] ✅ ALLOWED');
  return true;
}
