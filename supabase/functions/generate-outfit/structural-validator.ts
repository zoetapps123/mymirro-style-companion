/**
 * ============================================
 * STRUCTURAL VALIDATOR - Phase 6.4 + 6.5
 * Non-hallucination guardrails & outfit structure validation
 * ============================================
 * 
 * PHASE 6.5 PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - Validates against in-memory wardrobe item IDs (Set lookup: O(1))
 * - Blueprint lookup is O(1) hash map access
 * - No Supabase queries, no Gemini calls
 * - Runs ONCE per outfit batch after AI generation
 */

import { OutfitBlueprint, getBlueprintFor, CategoryCode } from '../_shared/outfit_blueprints.ts';

export interface StructuralValidationResult {
  isValid: boolean;
  outfitId: string;
  score: number; // 0-100, confidence in outfit quality
  warnings: string[];
  missingRequiredCategories: CategoryCode[];
  invalidItemIds: string[];
  blueprintMatch: 'full' | 'partial' | 'degraded' | 'failed';
}

export interface BatchValidationResult {
  validatedOutfits: any[];
  droppedOutfits: any[];
  overallQuality: 'high' | 'medium' | 'low';
  totalWarnings: string[];
}

const norm = (s: any) => (s || '').toString().toLowerCase().trim();

// Category mapping for blueprint validation
// Note: Some items can be ambiguous (hoodie/sweatshirt can be top or outer)
// We prioritize by most common use case
const CATEGORY_TO_CODE: Record<string, CategoryCode> = {
  // Tops (core upper body pieces)
  'shirt': 'top', 'top': 'top', 'tee': 'top', 't-shirt': 'top', 'blouse': 'top',
  'polo': 'top', 'kurta': 'top', 'kurti': 'top', 'tank': 'top', 'crop_top': 'top',
  'sweatshirt': 'top', 'henley': 'top', 'cami': 'top', 'bodysuit': 'top',
  
  // Bottoms
  'jeans': 'btm', 'trouser': 'btm', 'pants': 'btm', 'chinos': 'btm', 'skirt': 'btm',
  'shorts': 'btm', 'bottoms': 'btm', 'bottom': 'btm', 'legging': 'btm', 'joggers': 'btm',
  'cargo': 'btm', 'palazzo': 'btm', 'culottes': 'btm', 'churidar': 'btm',
  
  // Dresses (complete outfits)
  'dress': 'drs', 'gown': 'drs', 'jumpsuit': 'drs', 'romper': 'drs', 'one-piece': 'drs',
  'anarkali': 'drs', 'maxi': 'drs',
  
  // Ethnic (complete sets or traditional pieces)
  'saree': 'eth', 'lehenga': 'eth', 'sherwani': 'eth', 'salwar': 'eth', 'kurta set': 'eth',
  'kurta_set': 'eth', 'kurta-set': 'eth', 'sharara': 'eth', 'gharara': 'eth',
  'bandhgala': 'eth', 'achkan': 'eth', 'pathani': 'eth',
  
  // Shoes / Footwear
  'shoe': 'sho', 'shoes': 'sho', 'sneaker': 'sho', 'sneakers': 'sho', 'boot': 'sho',
  'boots': 'sho', 'loafer': 'sho', 'loafers': 'sho', 'heel': 'sho', 'heels': 'sho',
  'sandal': 'sho', 'sandals': 'sho', 'flip flop': 'sho', 'slipper': 'sho',
  'jutti': 'sho', 'juttis': 'sho', 'mojari': 'sho', 'kolhapuri': 'sho',
  
  // Outerwear / Layers
  'jacket': 'out', 'blazer': 'out', 'coat': 'out', 'cardigan': 'out', 'sweater': 'out',
  'hoodie': 'out', 'outerwear': 'out', 'layer': 'out', 'shrug': 'out', 'shawl': 'out',
  'dupatta': 'out', 'nehru jacket': 'out', 'waistcoat': 'out', 'bomber': 'out',
  
  // Accessories
  'accessory': 'acc', 'accessories': 'acc', 'watch': 'acc', 'belt': 'acc', 'bag': 'acc',
  'handbag': 'acc', 'purse': 'acc', 'wallet': 'acc', 'sunglass': 'acc', 'sunglasses': 'acc',
  'hat': 'acc', 'cap': 'acc', 'scarf': 'acc', 'jewelry': 'acc', 'jewellery': 'acc',
  'necklace': 'acc', 'earring': 'acc', 'earrings': 'acc', 'bracelet': 'acc', 'ring': 'acc',
  'bangle': 'acc', 'clutch': 'acc', 'backpack': 'acc', 'tote': 'acc'
};

function getCategoryCode(category: string): CategoryCode | null {
  const catLower = norm(category);
  
  // Direct match
  if (CATEGORY_TO_CODE[catLower]) {
    return CATEGORY_TO_CODE[catLower];
  }
  
  // Partial match
  for (const [key, code] of Object.entries(CATEGORY_TO_CODE)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return code;
    }
  }
  
  return null;
}

/**
 * Validates that all item IDs in the outfit exist in the wardrobe
 * This is the primary anti-hallucination check
 */
function validateItemExistence(
  outfit: any,
  wardrobeItemIds: Set<string>
): { valid: boolean; invalidIds: string[] } {
  const invalidIds: string[] = [];
  
  for (const piece of (outfit.pieces || [])) {
    const itemId = piece.wardrobeItemId;
    if (!itemId || !wardrobeItemIds.has(itemId)) {
      invalidIds.push(itemId || 'unknown');
    }
  }
  
  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
}

/**
 * Validates outfit structure against the blueprint for the occasion
 */
function validateAgainstBlueprint(
  outfit: any,
  blueprint: OutfitBlueprint | null
): { match: 'full' | 'partial' | 'degraded' | 'failed'; missingCategories: CategoryCode[]; warnings: string[] } {
  const warnings: string[] = [];
  const presentCategories = new Set<CategoryCode>();
  
  // Extract categories from outfit pieces
  for (const piece of (outfit.pieces || [])) {
    const code = getCategoryCode(piece.category || '');
    if (code) {
      presentCategories.add(code);
    }
  }
  
  // If no blueprint, do basic structural check
  if (!blueprint) {
    // Minimum requirement: at least one clothing item
    if (presentCategories.size === 0) {
      return { match: 'failed', missingCategories: [], warnings: ['No valid clothing categories found'] };
    }
    
    // Basic outfit should have top+bottom+shoes OR dress+shoes OR ethnic+shoes
    const hasTop = presentCategories.has('top');
    const hasBottom = presentCategories.has('btm');
    const hasDress = presentCategories.has('drs');
    const hasEthnic = presentCategories.has('eth');
    const hasShoes = presentCategories.has('sho');
    
    const hasCompleteOutfit = (hasTop && hasBottom) || hasDress || hasEthnic;
    
    if (!hasCompleteOutfit) {
      warnings.push('Outfit may be incomplete (missing core pieces)');
    }
    if (!hasShoes) {
      warnings.push('No footwear in outfit');
    }
    
    return {
      match: hasCompleteOutfit && hasShoes ? 'full' : hasCompleteOutfit ? 'partial' : 'degraded',
      missingCategories: [],
      warnings
    };
  }
  
  // Check required categories from blueprint
  const missingCategories: CategoryCode[] = [];
  
  for (const required of blueprint.requiredCore) {
    // Special handling: 'top'+'btm' can be satisfied by 'drs' or 'eth'
    if (required === 'top' || required === 'btm') {
      const hasTopBottom = presentCategories.has('top') && presentCategories.has('btm');
      const hasDress = presentCategories.has('drs');
      const hasEthnic = presentCategories.has('eth');
      
      if (!hasTopBottom && !hasDress && !hasEthnic) {
        if (!missingCategories.includes(required)) {
          missingCategories.push(required);
        }
      }
    } else if (required === 'eth') {
      // Ethnic can be replaced by dress for some occasions, or top+bottom
      const hasEthnic = presentCategories.has('eth');
      const hasDress = presentCategories.has('drs');
      const hasTopBottom = presentCategories.has('top') && presentCategories.has('btm');
      
      if (!hasEthnic && !hasDress && !hasTopBottom) {
        missingCategories.push(required);
      }
    } else if (!presentCategories.has(required)) {
      missingCategories.push(required);
    }
  }
  
  // Determine match level
  let match: 'full' | 'partial' | 'degraded' | 'failed';
  
  if (missingCategories.length === 0) {
    match = 'full';
  } else if (missingCategories.length === 1 && missingCategories[0] !== 'sho') {
    // Missing one non-shoe category is acceptable
    match = 'partial';
    warnings.push(`Blueprint suggests adding: ${missingCategories.join(', ')}`);
  } else if (missingCategories.includes('sho')) {
    // Missing shoes is a significant issue
    match = 'degraded';
    warnings.push('Missing footwear - outfit incomplete');
  } else if (missingCategories.length >= 2) {
    match = 'degraded';
    warnings.push(`Missing multiple categories: ${missingCategories.join(', ')}`);
  } else {
    match = 'partial';
  }
  
  return { match, missingCategories, warnings };
}

/**
 * Calculate overall quality score for an outfit
 */
function calculateQualityScore(
  existenceValid: boolean,
  blueprintMatch: 'full' | 'partial' | 'degraded' | 'failed',
  warnings: string[],
  originalConfidence?: number
): number {
  let score = 100;
  
  // Hallucination penalty (critical)
  if (!existenceValid) {
    score -= 50;
  }
  
  // Blueprint match penalties
  switch (blueprintMatch) {
    case 'full':
      break; // No penalty
    case 'partial':
      score -= 10;
      break;
    case 'degraded':
      score -= 25;
      break;
    case 'failed':
      score -= 40;
      break;
  }
  
  // Warning penalties
  score -= warnings.length * 5;
  
  // Factor in original AI confidence if available
  if (originalConfidence !== undefined && originalConfidence > 0) {
    // Blend with AI confidence (give it 20% weight)
    score = Math.round(score * 0.8 + (originalConfidence * 100) * 0.2);
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Validate a single outfit
 */
export function validateOutfitStructure(
  outfit: any,
  wardrobeItemIds: Set<string>,
  occasion: string | null,
  gender: 'male' | 'female' | null
): StructuralValidationResult {
  const warnings: string[] = [];
  
  // Get blueprint for context
  const blueprint = getBlueprintFor(occasion, gender);
  
  // Anti-hallucination check
  const existenceResult = validateItemExistence(outfit, wardrobeItemIds);
  if (!existenceResult.valid) {
    warnings.push(`Hallucinated items detected: ${existenceResult.invalidIds.join(', ')}`);
  }
  
  // Blueprint structure check
  const blueprintResult = validateAgainstBlueprint(outfit, blueprint);
  warnings.push(...blueprintResult.warnings);
  
  // Calculate quality score
  const score = calculateQualityScore(
    existenceResult.valid,
    blueprintResult.match,
    warnings,
    outfit.confidence
  );
  
  return {
    isValid: existenceResult.valid && blueprintResult.match !== 'failed',
    outfitId: outfit.outfitId || `outfit_${Date.now()}`,
    score,
    warnings,
    missingRequiredCategories: blueprintResult.missingCategories,
    invalidItemIds: existenceResult.invalidIds,
    blueprintMatch: blueprintResult.match
  };
}

/**
 * Validate and optionally filter a batch of outfits
 * Prioritizes quality over quantity
 */
export function validateOutfitBatch(
  outfits: any[],
  wardrobeItems: any[],
  occasion: string | null,
  gender: 'male' | 'female' | null,
  options: {
    maxOutfits?: number;
    minQualityScore?: number;
    dropInvalidItems?: boolean;
  } = {}
): BatchValidationResult {
  const {
    maxOutfits = 5,
    minQualityScore = 40,
    dropInvalidItems = true
  } = options;
  
  const wardrobeItemIds = new Set(wardrobeItems.map(i => i.id));
  const validatedResults: { outfit: any; validation: StructuralValidationResult }[] = [];
  const totalWarnings: string[] = [];
  
  // Validate each outfit
  for (const outfit of outfits) {
    const validation = validateOutfitStructure(outfit, wardrobeItemIds, occasion, gender);
    
    // Remove hallucinated items if enabled
    if (dropInvalidItems && validation.invalidItemIds.length > 0) {
      const cleanedPieces = outfit.pieces.filter(
        (p: any) => !validation.invalidItemIds.includes(p.wardrobeItemId)
      );
      
      if (cleanedPieces.length > 0) {
        // Re-validate cleaned outfit
        const cleanedOutfit = { ...outfit, pieces: cleanedPieces };
        const cleanedValidation = validateOutfitStructure(cleanedOutfit, wardrobeItemIds, occasion, gender);
        
        validatedResults.push({
          outfit: {
            ...cleanedOutfit,
            warnings: [...(outfit.warnings || []), ...cleanedValidation.warnings, 'Some items were removed due to validation']
          },
          validation: cleanedValidation
        });
        
        totalWarnings.push(`Outfit cleaned: removed ${validation.invalidItemIds.length} invalid items`);
      } else {
        totalWarnings.push(`Outfit dropped: all items were invalid`);
      }
    } else {
      validatedResults.push({
        outfit: {
          ...outfit,
          warnings: [...(outfit.warnings || []), ...validation.warnings]
        },
        validation
      });
    }
  }
  
  // Sort by quality score
  validatedResults.sort((a, b) => b.validation.score - a.validation.score);
  
  // Filter by minimum quality and limit count
  const qualityFiltered = validatedResults.filter(r => r.validation.score >= minQualityScore);
  const kept = qualityFiltered.slice(0, maxOutfits);
  const dropped = validatedResults.filter(r => 
    r.validation.score < minQualityScore || 
    qualityFiltered.indexOf(r) >= maxOutfits
  );
  
  // Determine overall quality
  const avgScore = kept.length > 0 
    ? kept.reduce((sum, r) => sum + r.validation.score, 0) / kept.length 
    : 0;
  
  let overallQuality: 'high' | 'medium' | 'low';
  if (avgScore >= 80) {
    overallQuality = 'high';
  } else if (avgScore >= 60) {
    overallQuality = 'medium';
  } else {
    overallQuality = 'low';
  }
  
  // Log validation summary
  console.log('[STRUCTURAL VALIDATOR] Batch validation complete:', {
    input: outfits.length,
    passed: kept.length,
    dropped: dropped.length,
    avgScore: Math.round(avgScore),
    overallQuality
  });
  
  return {
    validatedOutfits: kept.map(r => r.outfit),
    droppedOutfits: dropped.map(r => r.outfit),
    overallQuality,
    totalWarnings
  };
}

/**
 * Internal quality cap for Gemini requests
 * Limits outfits requested from AI to ensure quality over quantity
 */
export function getQualityAdjustedMaxOutfits(requestedMax: number): number {
  // Cap at 7 for quality, never go below 5 (Feedback #4)
  const QUALITY_CAP = 7;
  const MIN_OUTFITS = 5;
  
  return Math.max(MIN_OUTFITS, Math.min(QUALITY_CAP, requestedMax));
}
