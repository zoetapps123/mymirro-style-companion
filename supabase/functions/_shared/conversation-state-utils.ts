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
}

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
