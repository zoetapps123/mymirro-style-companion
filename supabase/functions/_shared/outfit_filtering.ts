/**
 * Outfit Filtering Module - Phase 1
 * 
 * Deterministic, fashion-intelligent filtering layer for outfit generation.
 * This module scores and groups wardrobe items by relevance before AI processing.
 * 
 * PHASE 1: Only computes and returns structured results - NOT yet integrated into pipeline.
 */

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
 * This function NEVER throws and NEVER filters - it only computes a number.
 */
export function scoreWardrobeItemForFiltering(
  item: any,
  normalizedCategory: NormalizedCategory | null,
  input: WardrobeFilterInput
): number {
  try {
    let score = 0;

    // 1) Base score - every item gets at least 1 point
    score += 1;

    // 2) Formality match for occasion-based generation
    if (input.occasion) {
      const allowedFormalities = getAllowedFormalitiesForOccasion(input.occasion);
      const itemFormality = getCompactFormality(item?.formality_level);
      
      if (allowedFormalities && itemFormality) {
        const formalityIndex = allowedFormalities.indexOf(itemFormality);
        if (formalityIndex === 0) {
          score += 5; // Best match
        } else if (formalityIndex === 1) {
          score += 3; // Good match
        } else if (formalityIndex >= 2) {
          score += 1; // Acceptable
        }
        // No penalty for non-match in Phase 1
      }
      
      // Bonus if occasion appears in suitable_occasions
      const suitableOccasions = item?.suitable_occasions || [];
      if (Array.isArray(suitableOccasions)) {
        const occasionLower = input.occasion.toLowerCase();
        if (suitableOccasions.some((o: string) => 
          o?.toLowerCase?.().includes(occasionLower) || occasionLower.includes(o?.toLowerCase?.() || '')
        )) {
          score += 4;
        }
      }
    }

    // 3) Style match for style-based generation
    if (input.generationType === 'style' && input.style) {
      const styleLower = input.style.toLowerCase();
      const itemStyles = item?.style_aesthetic || [];
      
      if (Array.isArray(itemStyles)) {
        const hasStyleMatch = itemStyles.some((s: string) => 
          s?.toLowerCase?.().includes(styleLower) || styleLower.includes(s?.toLowerCase?.() || '')
        );
        if (hasStyleMatch) {
          score += 5;
        }
      }
    }

    // 4) Anchor item compatibility for anchor-based generation
    if (input.generationType === 'anchor' && input.anchorItem) {
      // If this IS the anchor item, give huge score
      if (item?.id === input.anchorItem?.id) {
        score += 100;
      } else {
        // Check formality compatibility
        const anchorFormality = getCompactFormality(input.anchorItem?.formality_level);
        const itemFormality = getCompactFormality(item?.formality_level);
        
        if (anchorFormality && itemFormality && anchorFormality === itemFormality) {
          score += 3;
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
            score += 3;
          }
        }
      }
    }

    // 5) Metadata completeness bonus
    let metadataScore = 0;
    if (item?.color || item?.primary_color) metadataScore++;
    if (item?.formality_level) metadataScore++;
    if (item?.fit_type) metadataScore++;
    if (item?.style_aesthetic?.length > 0) metadataScore++;
    if (item?.suitable_occasions?.length > 0) metadataScore++;
    
    if (metadataScore >= 4) {
      score += 3; // Rich metadata
    } else if (metadataScore >= 2) {
      score += 1; // Moderate metadata
    }

    // 6) Neutral/versatile color bonus
    const itemColor = (item?.color || item?.primary_color || '').toString().toLowerCase();
    if (NEUTRAL_COLORS.has(itemColor)) {
      score += 1;
    }

    // 7) Climate/temperature hints
    if (input.temperatureC !== null && input.temperatureC !== undefined) {
      const seasons = item?.season || [];
      const weatherSuitability = (item?.weather_suitability || '').toLowerCase();
      
      // Hot weather (>26°C)
      if (input.temperatureC > 26) {
        if (seasons.includes('summer') || weatherSuitability.includes('hot') || weatherSuitability.includes('warm')) {
          score += 2;
        }
        if (seasons.includes('winter') || weatherSuitability.includes('cold') || weatherSuitability.includes('cool')) {
          score -= 1; // Slight penalty for winter items in hot weather
        }
        // Outerwear penalty in hot weather
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
          score += 2; // Bonus for outerwear in cold weather
        }
      }
    }

    return score;
  } catch {
    // Never throw - return base score on any error
    return 1;
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
 * PHASE 2: Applies category caps and global limits.
 * - Caps each category to max items (highest-scoring kept)
 * - Enforces global max of 20 items
 * - NEVER removes the anchor item
 */
export function filterWardrobeForOutfits(input: WardrobeFilterInput): WardrobeFilterOutput {
  const scored: ScoredWardrobeItem[] = [];
  const anchorItemId = input.anchorItem?.id;

  for (const item of input.wardrobeItems || []) {
    // 1) Normalize category
    const normalizedCategory = normalizeCategoryForFiltering(item);
    
    if (!normalizedCategory) {
      // Skip items with unknown categories
      continue;
    }

    // 2) Compute score
    const score = scoreWardrobeItemForFiltering(item, normalizedCategory, input);

    scored.push({ item, normalizedCategory, score });
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
  };
}
