-- Create conversation_state table for tracking conversation context
CREATE TABLE conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Conversation tracking
  last_outfit_generation_turn INTEGER DEFAULT 0,
  last_intent_detected TEXT,
  last_intent_confidence DECIMAL(3,2), -- 0.00 to 1.00
  last_known_occasion TEXT,
  last_user_query_type TEXT, -- 'shopping' | 'outfit' | 'theory' | 'general' | 'wardrobe-info' | 'item-only'
  
  -- Wardrobe state
  wardrobe_validation_state JSONB DEFAULT '{}',
  
  -- Recommendation context
  recommendation_mode TEXT DEFAULT 'outfit', -- 'outfit' | 'items' | 'general'
  outstanding_question_flag BOOLEAN DEFAULT false,
  last_generated_outfit_ids TEXT[],
  
  -- Metadata
  current_turn INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversation state"
  ON conversation_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_conversation_state_updated_at
  BEFORE UPDATE ON conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();