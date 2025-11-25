export interface IntentDetection {
  intent: 'explicit_outfit' | 'implicit_outfit' | 'item_only' | 'shopping' | 'theory' | 'general' | 'wardrobe-info' | 'visual_simulation';
  confidence: number;
  occasion?: string;
  category?: string; // For item_only requests
  query_type: 'new_outfit' | 'styling_question' | 'wardrobe_query' | 'shopping_request' | 'general_chat' | 'theory_question' | 'visual_simulation';
  is_continuation: boolean;
  context_weight: number;
}

export function detectIntent(
  userMessage: string,
  recentIntents?: Array<string>
): IntentDetection {
  const msg = userMessage.toLowerCase().trim();

  // Check for continuation patterns
  const continuationPatterns = /^(yes|yeah|yep|sure|ok|okay|no|nope|nah|maybe|or|and|also|what about|how about)/i;
  const isContinuation = continuationPatterns.test(userMessage.trim());

  // Check if this is a follow-up to a recent outfit request
  const hasRecentOutfitContext = recentIntents?.some(
    intent => intent === 'explicit_outfit' || intent === 'implicit_outfit'
  ) || false;

  // If user is continuing a conversation about outfits, boost confidence
  if (isContinuation && hasRecentOutfitContext) {
    console.log('[Intent Detection] Detected outfit continuation pattern');
  }

  // STRICTER Short message guard - if message is too short and ambiguous, default to general
  // Block casual greetings and short responses more aggressively
  if (userMessage.length < 20 && !isContinuation && !/outfit|look|wear|dress|style|show|wardrobe|clothes/i.test(userMessage)) {
    console.log('[Intent Detection] Message too short and ambiguous, defaulting to general');
    return {
      intent: 'general',
      confidence: 0.2,
      query_type: 'general_chat',
      is_continuation: isContinuation,
      context_weight: 0.1
    };
  }

  // VISUAL SIMULATION DETECTION - "how will this look?", "imagine this", "picture this"
  const visualSimulationPatterns = /\b(how (will|would|does) (this|that|it) look|imagine|picture (this|that)|visuali[sz]e|what (will|would) (this|that|it) look like)\b/i;
  if (visualSimulationPatterns.test(userMessage)) {
    console.log('[Intent Detection] Visual simulation request detected');
    return {
      intent: 'visual_simulation',
      confidence: 0.85,
      query_type: 'visual_simulation',
      is_continuation: isContinuation,
      context_weight: hasRecentOutfitContext ? 0.8 : 0.6
    };
  }

  // CATEGORY-SPECIFIC ITEM REQUESTS - "show me accessories", "show my shoes", "display my tops"
  const categoryItemPatterns = /\b(show|display|see|view|check|list|what) (me |my )?(all )?(the )?(accessories|shoes|tops|bottoms|outerwear|dresses|bags|jewelry|watches|belts|hats|scarves|sunglasses|footwear|upper ?wear|lower ?wear|outer ?wear)\b/i;
  const categoryMatch = userMessage.match(categoryItemPatterns);
  if (categoryMatch) {
    const category = categoryMatch[categoryMatch.length - 1];
    console.log('[Intent Detection] Category-specific item request detected:', category);
    return {
      intent: 'item_only',
      confidence: 0.95,
      category: category,
      query_type: 'wardrobe_query',
      is_continuation: isContinuation,
      context_weight: 0.9
    };
  }

  // GENERAL WARDROBE INFO - "what's in my wardrobe", "show my items"
  const wardrobeInfoPatterns = /\b(what'?s? in my wardrobe|show (me )?my (wardrobe|items|clothes)|display (my )?wardrobe|list (my )?(items|clothes)|what (do i|i) have)\b/i;
  if (wardrobeInfoPatterns.test(userMessage)) {
    console.log('[Intent Detection] General wardrobe info request detected');
    return {
      intent: 'wardrobe-info',
      confidence: 0.9,
      query_type: 'wardrobe_query',
      is_continuation: isContinuation,
      context_weight: 0.85
    };
  }

  // EXPLICIT OUTFIT REQUEST - Strong keywords (MUST be high confidence)
  const explicitOutfitPatterns = /\b(create|build|make|generate|suggest|give me|show me|design|put together|style|plan).*(outfit|look|ensemble|fit|ootd)\b/i;
  const strongOccasionPatterns = /\bfor (a |an |my |the )?(wedding|party|date|interview|meeting|gym|work|office|casual|formal|dinner|brunch|beach|night out|club|concert|event|trip|vacation)\b/i;
  
  if (explicitOutfitPatterns.test(userMessage) || strongOccasionPatterns.test(userMessage)) {
    const occasionMatch = userMessage.match(strongOccasionPatterns);
    console.log('[Intent Detection] Explicit outfit request detected');
    return {
      intent: 'explicit_outfit',
      confidence: 0.95,
      occasion: occasionMatch ? occasionMatch[0] : undefined,
      query_type: 'new_outfit',
      is_continuation: isContinuation,
      context_weight: 1.0
    };
  }

  // IMPLICIT OUTFIT REQUEST - Weaker signals (STRICTER - must reach 60% confidence)
  const implicitOutfitPatterns = /\b(what (should|can|could) i wear|help me (dress|style|choose|pick)|outfit (idea|help|advice)|dress me|style me|what to wear|clothing (help|advice))\b/i;
  
  if (implicitOutfitPatterns.test(userMessage)) {
    console.log('[Intent Detection] Implicit outfit request detected');
    // Only allow if continuation OR high context weight
    const baseConfidence = (isContinuation && hasRecentOutfitContext) ? 0.7 : 0.55;
    
    // If confidence is below 60%, downgrade to general
    if (baseConfidence < 0.6 && !isContinuation) {
      console.log('[Intent Detection] Implicit confidence too low, downgrading to general');
      return {
        intent: 'general',
        confidence: 0.4,
        query_type: 'general_chat',
        is_continuation: isContinuation,
        context_weight: 0.3
      };
    }
    
    return {
      intent: 'implicit_outfit',
      confidence: baseConfidence,
      query_type: 'styling_question',
      is_continuation: isContinuation,
      context_weight: hasRecentOutfitContext ? 0.8 : 0.5
    };
  }

  // ITEM-ONLY INTENT
  const itemPatterns = /\b(show|give|suggest) (me )?(just )?(a |an )?(single |one )?(t-?shirt|tshirt|top|pant|shoe|watch|accessory|kurta|dress|bottom)\b/i;
  if (itemPatterns.test(msg)) {
    console.log('[Intent Detection] Item-only request detected');
    return {
      intent: 'item_only',
      confidence: 0.85,
      query_type: 'wardrobe_query',
      is_continuation: isContinuation,
      context_weight: 0.7
    };
  }

  // SHOPPING INTENT
  if (/(?:where|what)\s+(?:to|should\s+i)\s+buy|recommend\s+brands|shopping|purchase/.test(msg)) {
    console.log('[Intent Detection] Shopping request detected');
    return {
      intent: 'shopping',
      confidence: 0.9,
      query_type: 'shopping_request',
      is_continuation: isContinuation,
      context_weight: 0.8
    };
  }

  // THEORY INTENT
  if (/(?:what\s+colors?|color\s+season|style\s+tips?|fashion\s+rules?|how\s+to\s+style)/.test(msg)) {
    console.log('[Intent Detection] Fashion theory question detected');
    return {
      intent: 'theory',
      confidence: 0.85,
      query_type: 'theory_question',
      is_continuation: isContinuation,
      context_weight: 0.75
    };
  }

  // GENERAL / LOW CONFIDENCE
  // Apply context boost if recent intents suggest styling conversation
  let baseConfidence = 0.4;
  let contextWeight = 0;

  if (recentIntents && recentIntents.length >= 2) {
    const stylingCount = recentIntents.filter(i =>
      i === 'explicit_outfit' || i === 'implicit_outfit' || i === 'theory' || i === 'shopping'
    ).length;

    if (stylingCount >= 2) {
      contextWeight = 0.2;
      baseConfidence += contextWeight;
    }
  }

  console.log('[Intent Detection] Defaulting to general chat');
  return {
    intent: 'general',
    confidence: baseConfidence,
    query_type: 'general_chat',
    is_continuation: isContinuation,
    context_weight: contextWeight
  };
}
