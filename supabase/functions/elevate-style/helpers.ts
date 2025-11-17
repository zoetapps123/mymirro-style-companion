/**
 * Phase 8: Helper Functions for Elevate Through AI
 * 
 * Supports unified schema integration and body visibility handling
 */

/**
 * Builds enriched metadata context for AI image enhancement
 * 
 * Phase 6: Updated to use Phase 2 unified feedback structure
 * PART 5: Enhanced with garment constraint data for validation
 * 
 * Combines multiple sources of styling feedback:
 * - microFixes: Phase 2 evidence-based quick fixes
 * - whatDoesntWork: Issues identified in scoring
 * - proportionBalance: Proportion analysis
 * - silhouetteBreakdown: Silhouette description
 * - wardrobeOpportunities: Wardrobe-first suggestions
 * - missingFeatures: Visibility limitations
 * - wardrobeItems: User's available items
 * - bodyNotVisible: Flag for flatlay/non-person images
 * - extractionData: PART 5 - Garment-level constraints (rollable, tuckable, accessories_present, etc.)
 * 
 * Returns deduplicated, prioritized list of actionable improvements
 */
export function buildMetadataContext(params: {
  microFixes: string[];
  whatDoesntWork: string[];
  proportionBalance?: string;
  silhouetteBreakdown?: string;
  wardrobeOpportunities: string[];
  missingFeatures: string[];
  wardrobeItems: any[];
  bodyNotVisible: boolean;
  extractionData?: any; // PART 5: Add extraction metadata
}): string {
  const {
    microFixes,
    whatDoesntWork,
    proportionBalance,
    silhouetteBreakdown,
    wardrobeOpportunities,
    missingFeatures,
    wardrobeItems,
    bodyNotVisible,
    extractionData,
  } = params;

  const sections: string[] = [];

  // PART 5: Section 0 - Garment Constraints (Critical for validation)
  if (extractionData) {
    const constraints: string[] = [];
    
    // Sleeve constraints
    const garments = extractionData.garments || [];
    const topGarment = garments.find((g: any) => g?.garment_type?.value === 'top');
    if (topGarment) {
      const rollable = topGarment.rollable?.value ?? false;
      const sleeveLength = topGarment.sleeve_length?.value ?? 'unknown';
      constraints.push(`Sleeves: ${sleeveLength} (rollable: ${rollable ? 'YES' : 'NO'})`);
    }
    
    // Hemline constraints
    if (topGarment) {
      const tuckable = topGarment.tuckable?.value ?? false;
      const hemline = topGarment.hemline?.value ?? 'unknown';
      constraints.push(`Hemline: ${hemline} (tuckable: ${tuckable ? 'YES' : 'NO'})`);
    }
    
    // Accessory presence
    const accessories = extractionData.accessories_present || {};
    const watchConfidence = accessories.watch_present_with_confidence?.value ?? 0;
    const braceletPresent = accessories.bracelet_present?.value ?? false;
    const necklacePresent = accessories.necklace_present?.value ?? false;
    constraints.push(`Accessories: Watch (confidence: ${watchConfidence}), Bracelet (${braceletPresent ? 'present' : 'absent'}), Necklace (${necklacePresent ? 'present' : 'absent'})`);
    
    // Bottom wash (for denim)
    const bottomGarment = garments.find((g: any) => g?.garment_type?.value === 'bottom');
    if (bottomGarment?.bottom_wash?.value) {
      constraints.push(`Denim wash: ${bottomGarment.bottom_wash.value}`);
    }
    
    // Color harmony
    const color = extractionData.color || {};
    if (color.top_primary_color_hex?.value && color.bottom_primary_color_hex?.value) {
      constraints.push(`Colors: Top ${color.top_primary_color_hex.value}, Bottom ${color.bottom_primary_color_hex.value}, Contrast ${color.contrast_level?.value || 'unknown'}`);
    }
    
    // Footwear visibility
    const footwear = extractionData.footwear || {};
    const footwearVisible = footwear.footwear_visible?.value ?? false;
    const footwearConfidence = footwear.footwear_visibility_confidence?.value ?? 0;
    constraints.push(`Footwear: ${footwearVisible ? 'visible' : 'not visible'} (confidence: ${footwearConfidence})`);
    
    if (constraints.length > 0) {
      sections.push(`🔒 GARMENT CONSTRAINTS (MUST VALIDATE BEFORE APPLYING FIXES):\n${constraints.join('\n')}\n\nCRITICAL: Only apply fixes that respect these physical constraints.`);
    }
  }

  // Section 1: Body visibility status
  if (bodyNotVisible) {
    sections.push(`⚠️ BODY VISIBILITY: Person not clearly detected in image. Focus on clothing aesthetics, color harmony, and styling details only. DO NOT attempt body-shape, proportion, or fit adjustments.`);
  }

  // Section 2: Micro-fixes (Phase 2 evidence-based)
  if (Array.isArray(microFixes) && microFixes.length > 0) {
    const deduplicated = microFixes
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 8);
    sections.push(`✨ MICRO-FIXES (apply these improvements):\n${deduplicated.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }

  // Section 3: Specific issues to address
  if (Array.isArray(whatDoesntWork) && whatDoesntWork.length > 0) {
    const issues = whatDoesntWork.slice(0, 4);
    sections.push(`🔧 ISSUES TO ADDRESS:\n${issues.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }

  // Section 4: Proportion balance (Phase 2)
  if (proportionBalance && typeof proportionBalance === 'string' && proportionBalance.trim()) {
    sections.push(`⚖️ PROPORTION BALANCE:\n${proportionBalance}`);
  }

  // Section 5: Silhouette breakdown (Phase 2)
  if (silhouetteBreakdown && typeof silhouetteBreakdown === 'string' && silhouetteBreakdown.trim()) {
    sections.push(`👔 SILHOUETTE BREAKDOWN:\n${silhouetteBreakdown}`);
  }

  // Section 6: Wardrobe opportunities (Phase 2)
  if (Array.isArray(wardrobeOpportunities) && wardrobeOpportunities.length > 0) {
    const opportunities = wardrobeOpportunities.slice(0, 3);
    sections.push(`🎨 WARDROBE OPPORTUNITIES:\n${opportunities.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }

  // Section 7: Visibility limitations (conditional guidance)
  if (Array.isArray(missingFeatures) && missingFeatures.length > 0) {
    const visibilityNotes = missingFeatures
      .filter(f => !f.includes('person_not_detected')) // Already handled above
      .slice(0, 3);
    if (visibilityNotes.length > 0) {
      sections.push(`👁️ VISIBILITY LIMITATIONS:\n${visibilityNotes.map(f => `- ${f}`).join('\n')}\nProvide CONDITIONAL suggestions for these elements (e.g., "If footwear is sandals, consider...").\nDO NOT hallucinate unseen details.`);
    }
  }

  // Section 8: Wardrobe context summary
  if (Array.isArray(wardrobeItems) && wardrobeItems.length > 0) {
    const wardrobeSummary = wardrobeItems
      .map(item => `${item.name || 'Item'} (${item.category || 'Unknown'}) - ${item.color || 'color not specified'}`)
      .slice(0, 10)
      .join('\n');
    sections.push(`👗 AVAILABLE WARDROBE ITEMS (ONLY suggest from this list):\n${wardrobeSummary}`);
  } else {
    sections.push(`👗 WARDROBE: Empty - Use universal styling tweaks ONLY if mechanically possible based on garment metadata`);
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
