export interface IntentDetection {
  intent: 'explicit_outfit' | 'implicit_outfit' | 'non_outfit' | 'item_only' | 'shopping' | 'theory' | 'general';
  confidence: number; // 0-100
  occasion?: string;
  query_type: 'shopping' | 'outfit' | 'theory' | 'general' | 'wardrobe-info' | 'item-only';
  is_continuation?: boolean;
  context_weight?: number;
}

export function detectIntent(
  userMessage: string, 
  recentIntents?: Array<{ intent: string; queryType: string; confidence: number }>
): IntentDetection {
  const msg = userMessage.toLowerCase().trim();
  
  // Check for outfit request continuation patterns
  const continuationPatterns = [
    /^(more|another|different|something else|show me more|other options?)/i,
    /^(try|give me|suggest) (another|different|more)/i,
    /what else/i,
    /any other/i,
  ];
  
  const isContinuation = continuationPatterns.some(p => p.test(msg));
  
  // Check if previous context was outfit-related
  const hasOutfitContext = recentIntents && recentIntents.length > 0 &&
    recentIntents[0].queryType === 'outfit' &&
    recentIntents[0].confidence > 60;
  
  // If continuation + outfit context, boost outfit intent
  if (isContinuation && hasOutfitContext) {
    return {
      intent: 'explicit_outfit',
      confidence: 85,
      query_type: 'outfit',
      is_continuation: true,
      context_weight: 40,
    };
  }
  
  // SHORT MESSAGE GUARD - Prevent ambiguous 1-2 word messages from triggering outfit generation
  // This fixes the "what?" bug - casual responses should not trigger outfit intent
  if (msg.length <= 10) {
    const shortAmbiguous = /^(what|huh|ok|okay|bro|yeah|yea|nah|nope|wtf|lol|lmao|hmm|ohh?|uh|umm?|nice|cool)\??!?\.?$/i;
    if (shortAmbiguous.test(msg)) {
      return {
        intent: 'general',
        confidence: 5,  // Near-zero confidence - clearly not an outfit request
        query_type: 'general',
      };
    }
  }
  
  // EXPLICIT OUTFIT INTENT (90%+ confidence)
  const explicitPatterns = [
    /create outfit/i,
    /make outfit/i,
    /pick\s+(an?\s+)?outfit/i,
    /choose\s+(my\s+)?outfit/i,
    /style me/i,
    /dress me/i,
    /what\s+should\s+i\s+wear/i,
    /what\s+to\s+wear/i,
    /give\s+me\s+a\s+look/i,
    /outfit\s+ideas?/i,
    /suggest\s+outfits?/i,
    /(\w+)\s+outfit/i, // "date outfit", "wedding outfit"
    /outfit\s+for\s+(\w+)/i,
  ];
  
  for (const pattern of explicitPatterns) {
    if (pattern.test(msg)) {
      const occasionMatch = msg.match(/(?:for|to|at|outfit)\s+(wedding|party|date|office|work|brunch|gym|beach|college|interview|festive|casual)/i);
      return {
        intent: 'explicit_outfit',
        confidence: 95,
        occasion: occasionMatch?.[1],
        query_type: 'outfit',
      };
    }
  }
  
  // IMPLICIT OUTFIT INTENT (60-90% confidence)
  const implicitPatterns = [
    /(?:i'm|i am)\s+going\s+to\s+(a\s+)?(\w+)/i,
    /(?:i\s+have|got)\s+(a\s+)?(\w+)\s+(?:tomorrow|tonight|today|this\s+weekend|next\s+week)/i,
    /heading\s+to/i,
    /confused\s+about\s+what\s+to\s+wear/i,
    /don'?t\s+know\s+what\s+to\s+(?:wear|put\s+on)/i,
    /want\s+to\s+look\s+(classy|professional|casual|hot|confident)/i,
    /need\s+to\s+impress/i,
  ];
  
  for (const pattern of implicitPatterns) {
    if (pattern.test(msg)) {
      const occasionMatch = msg.match(/(wedding|party|date|office|work|brunch|gym|beach|college|interview|meeting|dinner)/i);
      return {
        intent: 'implicit_outfit',
        confidence: 75,
        occasion: occasionMatch?.[1],
        query_type: 'outfit',
      };
    }
  }
  
  // ITEM-ONLY INTENT
  const itemPatterns = [
    /show\s+me\s+(a\s+)?(t-?shirt|tshirt|top|pant|shoe|watch|accessory|kurta|dress)/i,
    /suggest\s+(a\s+)?(t-?shirt|pant|top|bottom|shoe)/i,
    /what\s+(t-?shirt|pant|shoe|top|bottom)/i,
    /give\s+me\s+(a|just\s+a)\s+(t-?shirt|pant|top|shoe)/i,
  ];
  
  for (const pattern of itemPatterns) {
    if (pattern.test(msg)) {
      return {
        intent: 'item_only',
        confidence: 85,
        query_type: 'item-only',
      };
    }
  }
  
  // SHOPPING INTENT
  if (/(?:where|what)\s+(?:to|should\s+i)\s+buy|recommend\s+brands|shopping|purchase/.test(msg)) {
    return {
      intent: 'shopping',
      confidence: 90,
      query_type: 'shopping',
    };
  }
  
  // THEORY INTENT
  if (/(?:what\s+colors?|color\s+season|style\s+tips?|fashion\s+rules?|how\s+to\s+style)/.test(msg)) {
    return {
      intent: 'theory',
      confidence: 85,
      query_type: 'theory',
    };
  }
  
  // WARDROBE INFO
  if (/(?:show\s+(?:my\s+)?wardrobe|what'?s\s+in\s+my\s+closet|how\s+many|do\s+i\s+have)/.test(msg)) {
    return {
      intent: 'non_outfit',
      confidence: 90,
      query_type: 'wardrobe-info',
    };
  }
  
  // GENERAL / LOW CONFIDENCE
  // Apply context boost if recent intents suggest styling conversation
  let baseConfidence = 40;
  let contextWeight = 0;
  
  if (recentIntents && recentIntents.length >= 2) {
    const stylingCount = recentIntents.filter(i => 
      i.queryType === 'outfit' || i.queryType === 'theory' || i.queryType === 'shopping'
    ).length;
    
    if (stylingCount >= 2) {
      contextWeight = 20;
      baseConfidence += contextWeight;
    }
  }
  
  return {
    intent: 'general',
    confidence: baseConfidence,
    query_type: 'general',
    context_weight: contextWeight,
  };
}
