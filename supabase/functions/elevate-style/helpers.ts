/**
 * Phase 8: Helper Functions for Elevate Through AI
 * 
 * Supports unified schema integration and body visibility handling
 */

/**
 * Builds enriched metadata context for AI image enhancement
 * 
 * Combines multiple sources of styling feedback:
 * - improvements: Legacy quick fixes string
 * - microRecommendations: Phase 6 wardrobe-first suggestions
 * - whatDoesntWork: Issues identified in scoring
 * - missingFeatures: Visibility limitations
 * - wardrobeItems: User's available items
 * - bodyNotVisible: Flag for flatlay/non-person images
 * 
 * Returns deduplicated, prioritized list of actionable improvements
 */
export function buildMetadataContext(params: {
  improvements: string;
  microRecommendations: string[];
  missingFeatures: string[];
  whatDoesntWork: string[];
  wardrobeItems: any[];
  bodyNotVisible: boolean;
}): string {
  const {
    improvements,
    microRecommendations,
    missingFeatures,
    whatDoesntWork,
    wardrobeItems,
    bodyNotVisible,
  } = params;

  const sections: string[] = [];

  // Section 1: Body visibility status
  if (bodyNotVisible) {
    sections.push(`⚠️ BODY VISIBILITY: Person not clearly detected in image. Focus on clothing aesthetics, color harmony, and styling details only. DO NOT attempt body-shape, proportion, or fit adjustments.`);
  }

  // Section 2: Primary improvements (from unified schema)
  if (improvements && improvements.trim()) {
    sections.push(`🎯 PRIMARY IMPROVEMENTS:\n${improvements}`);
  }

  // Section 3: Micro-recommendations (Phase 6)
  if (Array.isArray(microRecommendations) && microRecommendations.length > 0) {
    const deduplicated = microRecommendations
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 6);
    sections.push(`✨ MICRO-RECOMMENDATIONS (wardrobe-first):\n${deduplicated.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }

  // Section 4: Specific issues to address
  if (Array.isArray(whatDoesntWork) && whatDoesntWork.length > 0) {
    const issues = whatDoesntWork.slice(0, 3);
    sections.push(`🔧 ISSUES TO ADDRESS:\n${issues.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }

  // Section 5: Visibility limitations (conditional guidance)
  if (Array.isArray(missingFeatures) && missingFeatures.length > 0) {
    const visibilityNotes = missingFeatures
      .filter(f => !f.includes('person_not_detected')) // Already handled above
      .slice(0, 3);
    if (visibilityNotes.length > 0) {
      sections.push(`👁️ VISIBILITY LIMITATIONS:\n${visibilityNotes.map(f => `- ${f}`).join('\n')}\nProvide CONDITIONAL suggestions for these elements (e.g., "If footwear is sandals, consider...").\nDO NOT hallucinate unseen details.`);
    }
  }

  // Section 6: Wardrobe context summary
  if (Array.isArray(wardrobeItems) && wardrobeItems.length > 0) {
    const wardrobeSummary = wardrobeItems
      .map(item => `${item.name || 'Item'} (${item.category || 'Unknown'}) - ${item.color || 'color not specified'}`)
      .slice(0, 10)
      .join('\n');
    sections.push(`👗 AVAILABLE WARDROBE ITEMS (ONLY suggest from this list):\n${wardrobeSummary}`);
  } else {
    sections.push(`👗 WARDROBE: Empty - Use universal styling tweaks (tucks, rolls, cuffs, layering with visible garments)`);
  }

  return sections.join('\n\n');
}

/**
 * Deduplicates improvement suggestions to avoid repetition
 * Used by both frontend and backend to ensure clean, unique improvements
 */
export function deduplicateImprovements(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'string') continue;
    
    const normalized = item.trim().toLowerCase();
    
    // Skip if we've seen this exact suggestion
    if (seen.has(normalized)) continue;
    
    // Skip if a very similar suggestion exists (fuzzy match)
    let isDuplicate = false;
    for (const existing of seen) {
      if (areStringsSimilar(normalized, existing)) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      seen.add(normalized);
      result.push(item.trim());
    }
  }

  return result;
}

/**
 * Simple fuzzy string similarity check
 * Returns true if strings are >70% similar (basic word overlap)
 */
function areStringsSimilar(a: string, b: string): boolean {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  const similarity = overlap / Math.max(wordsA.size, wordsB.size);
  return similarity > 0.7;
}
