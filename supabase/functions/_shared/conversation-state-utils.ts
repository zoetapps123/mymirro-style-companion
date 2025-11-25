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
}

export type ConversationMode = 
  | 'CASUAL_CHAT'
  | 'STYLE_DISCOVERY'
  | 'OUTFIT_REQUEST_ACTIVE'
  | 'SHOPPING_EXPLORATION'
  | 'WARDROBE_MANAGEMENT'
  | 'EMOTIONAL_SUPPORT'
  | 'PLAYFUL_BANTER'
  | 'EVENT_PLANNING'
  | 'FEEDBACK_SESSION'
  | 'DATA_COLLECTION_LIGHT';

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
  // EMOTIONAL_SUPPORT overrides everything
  if (emotionalContext?.soft_mode_required) {
    return 'EMOTIONAL_SUPPORT';
  }

  // Check for explicit outfit request
  if (currentIntent.intent === 'explicit_outfit' && currentIntent.confidence >= 60) {
    return 'OUTFIT_REQUEST_ACTIVE';
  }

  // Check query type patterns
  if (currentIntent.query_type === 'shopping') {
    return 'SHOPPING_EXPLORATION';
  }

  if (currentIntent.query_type === 'wardrobe-info') {
    return 'WARDROBE_MANAGEMENT';
  }

  // Check for implicit styling intent
  if (currentIntent.intent === 'implicit_outfit' && currentIntent.confidence >= 70) {
    return 'STYLE_DISCOVERY';
  }

  // Check for playful/casual patterns from intent history
  const recentIntents = state.last_5_intents || [];
  const casualCount = recentIntents.filter((i: any) => i.queryType === 'general').length;
  
  if (casualCount >= 3) {
    return 'PLAYFUL_BANTER';
  }

  // Default based on chat direction
  if (state.chat_direction === 'styling_mode') {
    return 'STYLE_DISCOVERY';
  }

  return 'CASUAL_CHAT';
}

export function canGenerateOutfit(
  state: ConversationState,
  intent: { intent: string; confidence: number },
  wardrobeItemCount: number
): boolean {
  // Check anti-spam rules
  const turnsSinceLast = state.current_turn - state.last_outfit_generation_turn;
  if (turnsSinceLast < 2) {
    return false;
  }

  // Check intent threshold
  if (intent.confidence < 60) {
    return false;
  }

  // Check wardrobe sufficiency
  if (wardrobeItemCount < 5) {
    return false;
  }

  // Check if not in explicit outfit intent
  if (intent.intent !== 'explicit_outfit' && intent.intent !== 'implicit_outfit') {
    return false;
  }

  return true;
}
