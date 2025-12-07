/**
 * Outfit Filtering Module - Phase 6.3 + 6.5
 * 
 * Blueprint-aware, fashion-intelligent filtering layer for outfit generation.
 * Uses occasion blueprints, product type metadata, and contextual scoring.
 * 
 * PHASE 6.3: Scoring-based filtering with blueprint integration
 * PHASE 6.5: Performance guarantees:
 *   - All functions are PURE (no external calls, no network requests)
 *   - Scoring runs ONCE per item on already-filtered data
 *   - No extra Supabase queries or Gemini calls
 *   - All heavy work (normalization, scoring) is in-memory only
 */

import { OutfitBlueprint, StyleKey, getBlueprintFor, isCategoryValidForBlueprint } from './outfit_blueprints.ts';
import { ProductTypeMeta, extractProductTypeMeta, isProductTypeAllowed, inferFormalityFromProductMeta, canBeElevatedByBlazer, isStructuredPiece } from './product_type_meta.ts';
import { FootwearMeta, wardrobeItemToFootwearMeta, scoreFootwearForContext } from './footwear_engine.ts';
import { AccessoryMeta, wardrobeItemToAccessoryMeta, planAccessories } from './accessories_engine.ts';

// ============================================
// TYPES
// ============================================

export type NormalizedCategory =
  | 'tops'
  | 'bottoms'
  | 'shoes'
  | 'outerwear'
  | 'dresses'
  | 'ethnic'
  | 'accessories';

export type CompactFormality = 'cas' | 'smc' | 'bsc' | 'frm';

export interface WardrobeFilterInput {
  generationType: 'occasion' | 'style' | 'anchor';
  occasion?: string | null;
  style?: string | null;
  anchorItem?: any | null;
  wardrobeItems: any[];
  userGender?: string | null;
  ageRange?: string | null;
  temperatureC?: number | null;
}

export interface ScoredWardrobeItem {
  item: any;
  normalizedCategory: NormalizedCategory;
  score: number;
  productMeta?: ProductTypeMeta;
  blueprintScore?: number;
}

export interface WardrobeFilterOutput {
  allScoredItems: ScoredWardrobeItem[];
  groupedByCategory: {
    tops: ScoredWardrobeItem[];
    bottoms: ScoredWardrobeItem[];
    shoes: ScoredWardrobeItem[];
    outerwear: ScoredWardrobeItem[];
    dresses: ScoredWardrobeItem[];
    ethnic: ScoredWardrobeItem[];
    accessories: ScoredWardrobeItem[];
  };
  summary: {
    totalItems: number;
    tops: number;
    bottoms: number;
    shoes: number;
    outerwear: number;
    dresses: number;
    ethnic: number;
    accessories: number;
  };
  blueprint?: OutfitBlueprint | null;
  hasStructuredPieces?: boolean;
}

// ============================================
// CATEGORY NORMALIZATION
// ============================================

/**
 * Normalizes a wardrobe item's category to a standard set of categories.
 * Uses both `category` and `item_type` fields for robust detection.
 * Returns null if category cannot be determined.
 */
export function normalizeCategoryForFiltering(item: any): NormalizedCategory | null {
  try {
    const rawCategory = (item?.category || '').toString().toLowerCase().trim();
    const itemType = (item?.item_type || '').toString().toLowerCase().trim();
    const itemName = (item?.name || '').toString().toLowerCase().trim();
    const combined = `${rawCategory} ${itemType} ${itemName}`;

    // 1. Ethnic wear (check first to catch kurta sets, sarees, etc.)
    const ethnicKeywords = [
      'saree', 'sari', 'lehenga', 'salwar', 'anarkali', 'ethnic', 
      'sherwani', 'kurta set', 'kurta-set', 'nehru jacket', 'bandhgala',
      'dhoti', 'lungi', 'churidar', 'ghagra', 'sharara', 'palazzo set',
      'dupatta', 'stole'
    ];
    if (ethnicKeywords.some(k => combined.includes(k))) {
      return 'ethnic';
    }

    // 2. Dresses & one-pieces (check before tops to avoid false positives)
    const dressKeywords = [
      'dress', 'gown', 'jumpsuit', 'romper', 'one-piece', 'onepiece',
      'co-ord dress', 'maxi', 'midi dress', 'mini dress', 'bodycon',
      'a-line dress', 'shift dress', 'wrap dress'
    ];
    if (dressKeywords.some(k => combined.includes(k))) {
      return 'dresses';
    }

    // 3. Shoes / Footwear
    const shoeKeywords = [
      'shoe', 'shoes', 'sneaker', 'trainer', 'loafer', 'heel', 'heels',
      'flat', 'flats', 'sandal', 'boot', 'boots', 'oxford', 'brogue',
      'moccasin', 'espadrille', 'wedge', 'stiletto', 'pump', 'pumps',
      'slip-on', 'slipon', 'flip flop', 'flip-flop', 'slipper',
      'jutti', 'mojari', 'kolhapuri', 'juti', 'footwear'
    ];
    if (shoeKeywords.some(k => combined.includes(k)) || itemType === 'footwear') {
      return 'shoes';
    }

    // 4. Outerwear / Layers
    const outerwearKeywords = [
      'jacket', 'coat', 'blazer', 'overcoat', 'cardigan', 'shrug',
      'parka', 'windbreaker', 'bomber', 'denim jacket', 'leather jacket',
      'trench', 'puffer', 'down jacket', 'vest', 'gilet', 'waistcoat',
      'anorak', 'peacoat', 'cape', 'poncho', 'outerwear', 'layer'
    ];
    if (outerwearKeywords.some(k => combined.includes(k))) {
      return 'outerwear';
    }

    // 5. Accessories
    const accessoryKeywords = [
      'accessor', 'accessory', 'accessories', 'belt', 'scarf', 'scarves',
      'stole', 'cap', 'hat', 'beanie', 'jewellery', 'jewelry',
      'necklace', 'chain', 'earring', 'bracelet', 'watch', 'watches',
      'ring', 'bangle', 'anklet', 'brooch', 'tie', 'bow tie', 'bowtie',
      'pocket square', 'cufflink', 'sunglasses', 'sunglass', 'glasses',
      'bag', 'handbag', 'purse', 'clutch', 'wallet', 'backpack',
      'tote', 'satchel', 'crossbody', 'sling bag'
    ];
    if (accessoryKeywords.some(k => combined.includes(k))) {
      return 'accessories';
    }

    // 6. Bottoms
    const bottomKeywords = [
      'bottom', 'bottoms', 'jean', 'jeans', 'pant', 'pants', 'trouser', 'trousers',
      'short', 'shorts', 'skirt', 'legging', 'leggings', 'cargo', 'chino', 'chinos',
      'jogger', 'joggers', 'track pant', 'sweatpant', 'culottes', 'palazzo',
      'capri', 'bermuda', 'lower', 'lowers', 'pajama', 'pyjama'
    ];
    if (bottomKeywords.some(k => combined.includes(k))) {
      return 'bottoms';
    }

    // 7. Tops (check last as it's the most common)
    const topKeywords = [
      'top', 'tops', 't-shirt', 'tshirt', 'tee', 'shirt', 'blouse',
      'polo', 'kurta', 'kurti', 'tank', 'tank top', 'camisole', 'cami',
      'tunic', 'crop top', 'croptop', 'halter', 'bodysuit', 'sweater',
      'pullover', 'sweatshirt', 'hoodie', 'henley', 'button-down',
      'button down', 'oxford shirt', 'flannel', 'upper', 'upperwear'
    ];
    if (topKeywords.some(k => combined.includes(k))) {
      return 'tops';
    }

    // Fallback: check raw category for common patterns
    if (rawCategory.includes('upper') || rawCategory.includes('top')) return 'tops';
    if (rawCategory.includes('lower') || rawCategory.includes('bottom')) return 'bottoms';
    if (rawCategory.includes('foot')) return 'shoes';

    // Could not determine category
    return null;
  } catch {
    // Never throw - return null for unknown categories
    return null;
  }
}

// ============================================
// FORMALITY MAPPING
// ============================================

/**
 * Maps an occasion string to allowed formality levels.
 * Returns null if no specific formality restriction applies.
 */
export function getAllowedFormalitiesForOccasion(occasion?: string | null): CompactFormality[] | null {
  if (!occasion) return null;

  const lower = occasion.toLowerCase();

  // Weddings / receptions / sangeet / festive
  if (
    lower.includes('wedding') ||
    lower.includes('reception') ||
    lower.includes('sangeet') ||
    lower.includes('mehendi') ||
    lower.includes('haldi') ||
    lower.includes('festive') ||
    lower.includes('festival') ||
    lower.includes('diwali') ||
    lower.includes('eid') ||
    lower.includes('puja') ||
    lower.includes('celebration')
  ) {
    return ['frm', 'bsc', 'smc'];
  }

  // Office / interview / business / formal meeting
  if (
    lower.includes('office') ||
    lower.includes('interview') ||
    lower.includes('business') ||
    lower.includes('formal') ||
    lower.includes('meeting') ||
    lower.includes('presentation') ||
    lower.includes('conference') ||
    lower.includes('corporate')
  ) {
    return ['bsc', 'frm', 'smc'];
  }

  // Date night / party / club
  if (
    lower.includes('date') ||
    lower.includes('party') ||
    lower.includes('club') ||
    lower.includes('night out') ||
    lower.includes('nightout') ||
    lower.includes('cocktail') ||
    lower.includes('drinks') ||
    lower.includes('dinner')
  ) {
    return ['smc', 'bsc', 'cas'];
  }

  // College / daily / brunch / shopping / casual
  if (
    lower.includes('college') ||
    lower.includes('class') ||
    lower.includes('brunch') ||
    lower.includes('shopping') ||
    lower.includes('casual') ||
    lower.includes('everyday') ||
    lower.includes('daily') ||
    lower.includes('weekend') ||
    lower.includes('hangout') ||
    lower.includes('movie') ||
    lower.includes('outing') ||
    lower.includes('picnic') ||
    lower.includes('travel') ||
    lower.includes('vacation')
  ) {
    return ['cas', 'smc'];
  }

  // Gym / workout / sports
  if (
    lower.includes('gym') ||
    lower.includes('workout') ||
    lower.includes('exercise') ||
    lower.includes('sport') ||
    lower.includes('yoga') ||
    lower.includes('running') ||
    lower.includes('athletic')
  ) {
    return ['cas'];
  }

  // Unknown / generic → no restriction
  return null;
}

/**
 * Maps item formality_level to compact formality code.
 */
function getCompactFormality(formalityLevel?: string | null): CompactFormality | null {
  if (!formalityLevel) return null;
  
  const lower = formalityLevel.toLowerCase();
  
  if (lower.includes('casual') && !lower.includes('smart')) return 'cas';
  if (lower.includes('smart_casual') || lower.includes('smart casual') || lower.includes('smartcasual')) return 'smc';
  if (lower.includes('business_casual') || lower.includes('business casual') || lower.includes('businesscasual')) return 'bsc';
  if (lower.includes('formal') || lower.includes('business') || lower.includes('professional')) return 'frm';
  
  return null;
}

// ============================================
// BLUEPRINT-AWARE SCORING (Phase 6.3)
// ============================================

interface BlueprintScoreInput {
  blueprint: OutfitBlueprint | null;
  productMeta: ProductTypeMeta;
  formalityCode: CompactFormality;
  styleKey: StyleKey | null;
  occasion: string | null;
  normalizedCategory: NormalizedCategory;
}

/**
 * Calculate blueprint-aware context score for an item
 */
function calculateBlueprintScore(input: BlueprintScoreInput): number {
  const { blueprint, productMeta, formalityCode, styleKey, occasion, normalizedCategory } = input;
  
  if (!blueprint) return 0;
  
  let score = 0;
  const occasionLower = (occasion || '').toLowerCase();
  
  // 1. Product type in blueprint's allowed types (+3)
  const allowedTypes = blueprint.allowedProductTypes;
  if (normalizedCategory === 'tops' && isProductTypeAllowed(productMeta.productType, allowedTypes.tops)) {
    score += 3;
  } else if (normalizedCategory === 'bottoms' && isProductTypeAllowed(productMeta.productType, allowedTypes.bottoms)) {
    score += 3;
  } else if (normalizedCategory === 'dresses' && isProductTypeAllowed(productMeta.productType, allowedTypes.dresses)) {
    score += 3;
  } else if (normalizedCategory === 'ethnic' && isProductTypeAllowed(productMeta.productType, allowedTypes.ethnic)) {
    score += 3;
  } else if (normalizedCategory === 'outerwear' && isProductTypeAllowed(productMeta.productType, allowedTypes.outerwear)) {
    score += 3;
  }
  
  // 2. Formality alignment (+2 or -2)
  const blueprintFormality = blueprint.formalityLevel;
  const formalityMatch = checkFormalityAlignment(formalityCode, blueprintFormality);
  score += formalityMatch;
  
  // 3. Style alignment (+2)
  if (styleKey && blueprint.allowedStyles.includes(styleKey)) {
    score += 2;
  }
  
  // 4. Blueprint-specific rules
  
  // Cargo rules
  if (productMeta.isCargo) {
    if (!blueprint.allowCargos) {
      score -= 3; // Penalty but not hard block
    } else {
      score += 1; // Bonus if explicitly allowed
    }
  }
  
  // Jeans rules
  if (productMeta.isJeans) {
    if (!blueprint.allowJeans && !blueprint.allowJeansFusion) {
      score -= 3;
    } else if (blueprint.allowJeansFusion && !blueprint.allowJeans) {
      score -= 1; // Low priority fusion only
    } else if (blueprint.allowJeans) {
      score += 1;
    }
  }
  
  // Gym shoes rules
  if (productMeta.isSportsShoe || productMeta.isFlipFlop) {
    if (!blueprint.allowGymShoes) {
      score -= 4; // Strong penalty
    }
  }
  
  // Backpack rules
  if (productMeta.isBackpack) {
    if (!blueprint.allowBackpacks) {
      score -= 4;
    } else {
      score += 1;
    }
  }
  
  // 5. Special occasion penalties and boosts
  
  // FEEDBACK #2: Wedding - boost blazer/coat/formal shirts
  if (occasionLower.includes('wedding') || occasionLower.includes('sangeet') || occasionLower.includes('reception')) {
    // Flip flops/slides are never ok for weddings
    if (productMeta.isFlipFlop) score -= 5;
    // Sports shoes are terrible for weddings
    if (productMeta.isSportsShoe) score -= 5;
    // Ethnic items get bonus
    if (productMeta.isEthnic) score += 2;
    // Formal shoes/heels/juttis get bonus
    if (productMeta.isFormalShoe || productMeta.isHeel || productMeta.isMojariJutti) score += 2;
    
    // BOOST formal/structured outerwear for weddings
    if (productMeta.isBlazer) score += 3;
    if (productMeta.isNehruJacket) score += 3; // Very appropriate for Indian weddings
    if (productMeta.isJacket && !productMeta.isDenimJacket && !productMeta.isBomber) score += 2; // Formal coats/jackets
    // Formal shirts (non-tshirt) get bonus
    if (productMeta.isShirt && !productMeta.isTshirt) score += 2;
    if (productMeta.isBlouse) score += 2; // Formal tops for women
  }
  
  if (occasionLower.includes('interview')) {
    // No casual items
    if (productMeta.isTshirt || productMeta.isCargo || productMeta.isShorts) score -= 4;
    if (productMeta.isSneaker || productMeta.isFlipFlop) score -= 4;
    // Formal items bonus
    if (productMeta.isBlazer || productMeta.isFormalTrouser || productMeta.isShirt) score += 2;
  }
  
  if (occasionLower.includes('office') || occasionLower.includes('work')) {
    // Flip flops penalty
    if (productMeta.isFlipFlop) score -= 3;
    // Structured pieces bonus
    if (productMeta.isBlazer || productMeta.isShirt || productMeta.isBlouse) score += 1;
  }
  
  // FEEDBACK #1 & #3: Casual occasions - penalize kurta, blazer/formal jackets
  if (occasionLower.includes('casual') || occasionLower.includes('college') || 
      occasionLower.includes('hangout') || occasionLower.includes('movie') ||
      occasionLower.includes('shopping') || occasionLower.includes('brunch') ||
      occasionLower.includes('picnic') || occasionLower.includes('everyday')) {
    // FEEDBACK #1: Kurta doesn't belong in casual western outfits
    if (productMeta.isKurta) score -= 8;
    // Blazers don't belong in casual settings
    if (productMeta.isBlazer) score -= 5;
    // Formal jackets/coats (not denim or bomber) are too formal
    if (productMeta.isJacket && !productMeta.isDenimJacket && !productMeta.isBomber && !productMeta.isHoodie) {
      score -= 4;
    }
    // Nehru jackets are formal
    if (productMeta.isNehruJacket) score -= 4;
    // Formal shoes penalty
    if (productMeta.isFormalShoe) score -= 3;
  }
  
  // FEEDBACK #5: Streetwear style - penalize kurta/ethnic wear
  const styleKeyLower = (styleKey || '').toLowerCase();
  if (styleKeyLower.includes('street') || styleKeyLower.includes('urban')) {
    // Kurta and ethnic wear absolutely do NOT belong in streetwear
    if (productMeta.isKurta) score -= 10;
    if (productMeta.isEthnic) score -= 10;
    if (productMeta.isSherwani) score -= 10;
    if (productMeta.isAnarkali) score -= 10;
    if (productMeta.isSaree) score -= 10;
    if (productMeta.isNehruJacket) score -= 5; // Also not streetwear
    
    // Boost streetwear-appropriate items
    if (productMeta.isHoodie) score += 2;
    if (productMeta.isSneaker) score += 2;
    if (productMeta.isCargo) score += 2;
    if (productMeta.isBomber) score += 2;
  }
  
  // 6. Versatile items bonus (+1)
  const versatileItems = productMeta.isChinos || productMeta.isLoafer || 
    (productMeta.isSneaker && !productMeta.isSportsShoe); // Clean sneakers
  if (versatileItems) score += 1;
  
  return score;
}

function checkFormalityAlignment(itemFormality: CompactFormality, blueprintLevel: string): number {
  const formalityOrder: CompactFormality[] = ['cas', 'smc', 'bsc', 'frm'];
  const itemIndex = formalityOrder.indexOf(itemFormality);
  
  let expectedIndex = 1; // Default to smart casual
  switch (blueprintLevel) {
    case 'casual': expectedIndex = 0; break;
    case 'smart_casual': expectedIndex = 1; break;
    case 'semi_formal': expectedIndex = 2; break;
    case 'formal':
    case 'black_tie': expectedIndex = 3; break;
  }
  
  const diff = Math.abs(itemIndex - expectedIndex);
  if (diff === 0) return 2;  // Perfect match
  if (diff === 1) return 1;  // Close match
  if (diff === 2) return -1; // Mismatch
  return -2;                  // Strong mismatch
}

// ============================================
// SCORING HELPER
// ============================================

/**
 * Neutral/versatile colors that pair well with most items
 */
const NEUTRAL_COLORS = new Set([
  'black', 'white', 'navy', 'blue', 'grey', 'gray', 'beige', 
  'brown', 'denim', 'cream', 'tan', 'khaki', 'charcoal', 'ivory',
  'nude', 'taupe', 'olive', 'camel'
]);

/**
 * Calculates a relevance score for a wardrobe item.
 * Higher scores indicate better matches for the given filter input.
 * Phase 6.3: Now includes blueprint-aware scoring.
 */
export function scoreWardrobeItemForFiltering(
  item: any,
  normalizedCategory: NormalizedCategory | null,
  input: WardrobeFilterInput,
  blueprint?: OutfitBlueprint | null
): { score: number; productMeta: ProductTypeMeta; blueprintScore: number } {
  try {
    let score = 0;
    const productMeta = extractProductTypeMeta(item);
    let blueprintScore = 0;

    // 1) Base score - every item gets at least 1 point
    score += 1;

    // 2) Blueprint-aware scoring (Phase 6.3)
    if (blueprint && normalizedCategory) {
      const itemFormality = inferFormalityFromProductMeta(productMeta);
      const styleKey = input.style ? (input.style.toLowerCase().replace(/\s+/g, '_') as StyleKey) : null;
      
      blueprintScore = calculateBlueprintScore({
        blueprint,
        productMeta,
        formalityCode: itemFormality,
        styleKey,
        occasion: input.occasion || null,
        normalizedCategory
      });
      
      score += blueprintScore;
    }

    // 3) Formality match for occasion-based generation (legacy - still useful)
    if (input.occasion) {
      const allowedFormalities = getAllowedFormalitiesForOccasion(input.occasion);
      const itemFormality = getCompactFormality(item?.formality_level);
      
      if (allowedFormalities && itemFormality) {
        const formalityIndex = allowedFormalities.indexOf(itemFormality);
        if (formalityIndex === 0) {
          score += 3; // Best match (reduced from 5 as blueprint handles this)
        } else if (formalityIndex === 1) {
          score += 2; // Good match
        } else if (formalityIndex >= 2) {
          score += 1; // Acceptable
        }
      }
      
      // Bonus if occasion appears in suitable_occasions
      const suitableOccasions = item?.suitable_occasions || [];
      if (Array.isArray(suitableOccasions)) {
        const occasionLower = input.occasion.toLowerCase();
        if (suitableOccasions.some((o: string) => 
          o?.toLowerCase?.().includes(occasionLower) || occasionLower.includes(o?.toLowerCase?.() || '')
        )) {
          score += 3;
        }
      }
    }

    // 4) Style match for style-based generation
    if (input.generationType === 'style' && input.style) {
      const styleLower = input.style.toLowerCase();
      const itemStyles = item?.style_aesthetic || [];
      
      if (Array.isArray(itemStyles)) {
        const hasStyleMatch = itemStyles.some((s: string) => 
          s?.toLowerCase?.().includes(styleLower) || styleLower.includes(s?.toLowerCase?.() || '')
        );
        if (hasStyleMatch) {
          score += 4;
        }
      }
    }

    // 5) Anchor item compatibility for anchor-based generation
    if (input.generationType === 'anchor' && input.anchorItem) {
      // If this IS the anchor item, give huge score
      if (item?.id === input.anchorItem?.id) {
        score += 100;
      } else {
        // Check formality compatibility
        const anchorFormality = getCompactFormality(input.anchorItem?.formality_level);
        const itemFormality = getCompactFormality(item?.formality_level);
        
        if (anchorFormality && itemFormality && anchorFormality === itemFormality) {
          score += 2;
        }
        
        // Check style aesthetic overlap
        const anchorStyles = input.anchorItem?.style_aesthetic || [];
        const itemStyles = item?.style_aesthetic || [];
        
        if (Array.isArray(anchorStyles) && Array.isArray(itemStyles)) {
          const hasOverlap = itemStyles.some((s: string) => 
            anchorStyles.some((as: string) => 
              s?.toLowerCase?.() === as?.toLowerCase?.()
            )
          );
          if (hasOverlap) {
            score += 2;
          }
        }
      }
    }

    // 6) Metadata completeness bonus
    let metadataScore = 0;
    if (item?.color || item?.primary_color) metadataScore++;
    if (item?.formality_level) metadataScore++;
    if (item?.fit_type) metadataScore++;
    if (item?.style_aesthetic?.length > 0) metadataScore++;
    if (item?.suitable_occasions?.length > 0) metadataScore++;
    
    if (metadataScore >= 4) {
      score += 2; // Rich metadata
    } else if (metadataScore >= 2) {
      score += 1; // Moderate metadata
    }

    // 7) Neutral/versatile color bonus
    const itemColor = (item?.color || item?.primary_color || '').toString().toLowerCase();
    if (NEUTRAL_COLORS.has(itemColor)) {
      score += 1;
    }

    // 8) Climate/temperature hints
    if (input.temperatureC !== null && input.temperatureC !== undefined) {
      const seasons = item?.season || [];
      const weatherSuitability = (item?.weather_suitability || '').toLowerCase();
      
      // Hot weather (>26°C)
      if (input.temperatureC > 26) {
        if (seasons.includes('summer') || weatherSuitability.includes('hot') || weatherSuitability.includes('warm')) {
          score += 2;
        }
        if (seasons.includes('winter') || weatherSuitability.includes('cold') || weatherSuitability.includes('cool')) {
          score -= 1;
        }
        if (normalizedCategory === 'outerwear') {
          score -= 2;
        }
      }
      
      // Cold weather (<18°C)
      if (input.temperatureC < 18) {
        if (seasons.includes('winter') || weatherSuitability.includes('cold') || weatherSuitability.includes('cool')) {
          score += 2;
        }
        if (normalizedCategory === 'outerwear') {
          score += 2;
        }
      }
    }

    return { score, productMeta, blueprintScore };
  } catch {
    return { score: 1, productMeta: {}, blueprintScore: 0 };
  }
}

// ============================================
// CATEGORY CAPS (Phase 2)
// ============================================

const CATEGORY_CAPS: Record<NormalizedCategory, number> = {
  tops: 5,
  bottoms: 4,
  shoes: 3,
  outerwear: 2,
  dresses: 2,
  ethnic: 2,
  accessories: 3,
};

const GLOBAL_MAX_ITEMS = 20;

// ============================================
// MAIN FILTER FUNCTION
// ============================================

/**
 * Filters, scores, and groups wardrobe items for outfit generation.
 * 
 * PHASE 6.3: Blueprint-aware filtering with contextual scoring.
 * PHASE 6.5: Performance guarantees:
 *   - All operations are in-memory only (no network calls)
 *   - Uses footwear_engine for intelligent shoe scoring
 *   - Uses accessories_engine for intelligent accessory scoring
 *   - Single pass through wardrobe items
 *   - NEVER removes the anchor item
 *   - Tracks structured pieces for t-shirt elevation logic
 */
export function filterWardrobeForOutfits(input: WardrobeFilterInput): WardrobeFilterOutput {
  const scored: ScoredWardrobeItem[] = [];
  const anchorItemId = input.anchorItem?.id;
  
  // Get blueprint for context-aware scoring (PURE - no external calls)
  const gender = (input.userGender?.toLowerCase() === 'male' ? 'male' : 'female') as 'male' | 'female';
  const blueprint = getBlueprintFor(input.occasion, gender);
  const styleKey = input.style ? (input.style.toLowerCase().replace(/\s+/g, '_') as StyleKey) : null;
  
  // Track if wardrobe has structured pieces (for t-shirt elevation)
  let hasStructuredPieces = false;
  
  // Collect footwear and accessories for specialized scoring
  const footwearItems: { item: any; meta: FootwearMeta; normalizedCategory: NormalizedCategory }[] = [];
  const accessoryItems: { item: any; meta: AccessoryMeta; normalizedCategory: NormalizedCategory }[] = [];

  // PHASE 6.5: Single pass through wardrobe items
  for (const item of input.wardrobeItems || []) {
    // 1) Normalize category (PURE function)
    const normalizedCategory = normalizeCategoryForFiltering(item);
    
    if (!normalizedCategory) {
      // Skip items with unknown categories
      continue;
    }

    // 2) Compute base score with blueprint awareness (PURE function)
    const scoreResult = scoreWardrobeItemForFiltering(item, normalizedCategory, input, blueprint);
    
    // Track structured pieces
    if (isStructuredPiece(scoreResult.productMeta)) {
      hasStructuredPieces = true;
    }
    
    // 3) Collect specialized items for engine scoring
    if (normalizedCategory === 'shoes') {
      footwearItems.push({
        item,
        meta: wardrobeItemToFootwearMeta(item),
        normalizedCategory
      });
    } else if (normalizedCategory === 'accessories') {
      accessoryItems.push({
        item,
        meta: wardrobeItemToAccessoryMeta(item),
        normalizedCategory
      });
    }

    scored.push({ 
      item, 
      normalizedCategory, 
      score: scoreResult.score,
      productMeta: scoreResult.productMeta,
      blueprintScore: scoreResult.blueprintScore
    });
  }
  
  // PHASE 6.5: Apply specialized engine scoring to footwear (PURE - in memory only)
  if (footwearItems.length > 0 && blueprint) {
    const footwearMetas = footwearItems.map(f => f.meta);
    const scoredFootwear = scoreFootwearForContext({
      footwear: footwearMetas,
      blueprint,
      occasion: input.occasion || null,
      styleKey
    });
    
    // Apply engine scores to main scored array
    for (const sf of scoredFootwear) {
      const scoredItem = scored.find(s => s.item.id === sf.id);
      if (scoredItem) {
        // Add footwear engine bonus (capped to prevent runaway scores)
        scoredItem.score += Math.min(sf.score, 5);
      }
    }
  }
  
  // PHASE 6.5: Apply specialized engine scoring to accessories (PURE - in memory only)
  if (accessoryItems.length > 0) {
    const accessoryMetas = accessoryItems.map(a => a.meta);
    const accessoryPlan = planAccessories({
      accessories: accessoryMetas,
      blueprint,
      occasion: input.occasion || null,
      styleKey
    });
    
    // Boost primary and secondary accessories
    if (accessoryPlan.primary) {
      const scoredItem = scored.find(s => s.item.id === accessoryPlan.primary!.id);
      if (scoredItem) scoredItem.score += 3;
    }
    if (accessoryPlan.secondary) {
      const scoredItem = scored.find(s => s.item.id === accessoryPlan.secondary!.id);
      if (scoredItem) scoredItem.score += 2;
    }
  }

  // 3) Group by category
  const grouped: WardrobeFilterOutput['groupedByCategory'] = {
    tops: [],
    bottoms: [],
    shoes: [],
    outerwear: [],
    dresses: [],
    ethnic: [],
    accessories: [],
  };

  for (const s of scored) {
    grouped[s.normalizedCategory].push(s);
  }

  // 4) Sort each category by score DESC (highest first)
  const categories: NormalizedCategory[] = ['tops', 'bottoms', 'shoes', 'outerwear', 'dresses', 'ethnic', 'accessories'];
  for (const cat of categories) {
    grouped[cat].sort((a, b) => b.score - a.score);
  }

  // 5) PHASE 2: Apply category caps (keep highest-scoring items)
  for (const cat of categories) {
    const cap = CATEGORY_CAPS[cat];
    if (grouped[cat].length > cap) {
      // Before capping, ensure anchor item is preserved if in this category
      const anchorIndex = grouped[cat].findIndex(s => s.item.id === anchorItemId);
      
      if (anchorIndex >= 0 && anchorIndex >= cap) {
        // Anchor is outside cap range - swap it into the kept range
        const anchorItem = grouped[cat][anchorIndex];
        grouped[cat].splice(anchorIndex, 1);
        grouped[cat].unshift(anchorItem); // Put at front
      }
      
      // Apply cap
      grouped[cat] = grouped[cat].slice(0, cap);
    }
  }

  // 6) PHASE 2: Enforce global max items
  let allCappedItems: ScoredWardrobeItem[] = [];
  for (const cat of categories) {
    allCappedItems.push(...grouped[cat]);
  }

  if (allCappedItems.length > GLOBAL_MAX_ITEMS) {
    // Sort all by score descending
    allCappedItems.sort((a, b) => b.score - a.score);
    
    // Keep top items, but NEVER remove anchor
    const kept: ScoredWardrobeItem[] = [];
    let anchorKept = false;
    
    for (const item of allCappedItems) {
      if (item.item.id === anchorItemId) {
        kept.push(item);
        anchorKept = true;
      } else if (kept.length < GLOBAL_MAX_ITEMS - (anchorItemId && !anchorKept ? 1 : 0)) {
        kept.push(item);
      }
    }
    
    // If anchor wasn't in top items, it was already kept via the score boost
    // Rebuild grouped from kept items
    for (const cat of categories) {
      grouped[cat] = kept.filter(s => s.normalizedCategory === cat);
    }
  }

  // 7) Summary (reflects capped items)
  const summary = {
    totalItems: categories.reduce((sum, cat) => sum + grouped[cat].length, 0),
    tops: grouped.tops.length,
    bottoms: grouped.bottoms.length,
    shoes: grouped.shoes.length,
    outerwear: grouped.outerwear.length,
    dresses: grouped.dresses.length,
    ethnic: grouped.ethnic.length,
    accessories: grouped.accessories.length,
  };

  return {
    allScoredItems: categories.flatMap(cat => grouped[cat]),
    groupedByCategory: grouped,
    summary,
    blueprint,
    hasStructuredPieces,
  };
}
