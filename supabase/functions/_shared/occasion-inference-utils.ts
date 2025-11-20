export interface OccasionInference {
  inferred_occasion: string | null;
  confidence: number; // 0-100
}

export function inferOccasion(userMessage: string, conversationHistory: any[]): OccasionInference {
  const msg = userMessage.toLowerCase();
  
  // Direct mention patterns
  const occasionPatterns: Record<string, RegExp> = {
    wedding: /wedding|marriage|shaadi/i,
    party: /party|celebration|bash/i,
    date: /date\s+night|dating|romantic/i,
    office: /office|work|corporate|meeting|presentation/i,
    casual: /casual|hangout|chill|relax/i,
    brunch: /brunch|breakfast|lunch/i,
    gym: /gym|workout|exercise|fitness/i,
    beach: /beach|poolside/i,
    college: /college|university|class|lecture/i,
    interview: /interview|job/i,
    festive: /festival|diwali|holi|eid|navratri|christmas/i,
  };
  
  for (const [occasion, pattern] of Object.entries(occasionPatterns)) {
    if (pattern.test(msg)) {
      return {
        inferred_occasion: occasion,
        confidence: 90,
      };
    }
  }
  
  // Context-based inference from history
  const recentOccasions = conversationHistory
    .slice(-3)
    .reverse()
    .map((m: any) => {
      const content = m.content?.toLowerCase() || '';
      for (const [occasion, pattern] of Object.entries(occasionPatterns)) {
        if (pattern.test(content)) return occasion;
      }
      return null;
    })
    .filter(Boolean);
  
  if (recentOccasions.length > 0) {
    return {
      inferred_occasion: recentOccasions[0],
      confidence: 60,
    };
  }
  
  // Time-based inference
  if (/tonight|this\s+evening/.test(msg)) {
    return { inferred_occasion: 'party', confidence: 50 };
  }
  
  if (/tomorrow|next\s+week/.test(msg)) {
    return { inferred_occasion: 'casual', confidence: 40 };
  }
  
  return {
    inferred_occasion: null,
    confidence: 0,
  };
}
