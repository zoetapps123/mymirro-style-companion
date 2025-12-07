/**
 * Accessories Intelligence Engine - Phase 6.2 + 6.5
 * Plans and scores accessory selection based on occasion, style, and outfit context
 * 
 * PHASE 6.5 PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - Works only on in-memory data passed as arguments
 * - No Supabase queries, no Gemini calls
 * - Simple arithmetic scoring only
 */

import { OutfitBlueprint, StyleKey } from './outfit_blueprints.ts';

export type FormalityCode = 'cas' | 'smc' | 'bsc' | 'frm';

export interface AccessoryMeta {
  id: string;
  name?: string;
  typeTags: string[];
  formalityCode: FormalityCode;
  category?: string;
  color?: string;
}

export interface ScoredAccessory extends AccessoryMeta {
  score: number;
  priority: 'primary' | 'secondary' | 'optional';
  scoreBreakdown?: string[];
}

export interface AccessorySelectionPlan {
  primary: ScoredAccessory | null;
  secondary: ScoredAccessory | null;
  all: ScoredAccessory[];
  maxRecommended: number;
}

// Accessory type categories
const JEWELRY_ACCESSORIES = ['necklace', 'earrings', 'ring', 'bracelet', 'bangle', 'anklet', 'chain', 'pendant', 'choker', 'body_chain'];
const FORMAL_ACCESSORIES = ['watch', 'tie', 'pocket_square', 'cufflinks', 'brooch', 'tie_pin', 'belt'];
const BAG_ACCESSORIES = ['bag', 'handbag', 'tote', 'clutch', 'potli', 'crossbody', 'sling_bag', 'messenger_bag', 'laptop_bag', 'briefcase'];
const BACKPACK_TYPES = ['backpack', 'rucksack'];
const ETHNIC_ACCESSORIES = ['maang_tikka', 'matha_patti', 'nose_ring', 'payal', 'kamarbandh', 'dupatta', 'stole', 'safa', 'turban', 'pagdi'];
const STREETWEAR_ACCESSORIES = ['cap', 'beanie', 'bucket_hat', 'snapback', 'chain', 'rings', 'crossbody', 'fanny_pack', 'sunglasses'];
const CASUAL_ACCESSORIES = ['sunglasses', 'scarf', 'hat', 'hair_accessories', 'scrunchie', 'headband'];

// Occasion-specific banned accessories
const BANNED_FOR_WEDDING = ['backpack', 'rucksack', 'fanny_pack', 'sports_bag', 'gym_bag'];
const BANNED_FOR_OFFICE = ['body_chain', 'anklet', 'fanny_pack'];
const BANNED_FOR_INTERVIEW = ['backpack', 'cap', 'beanie', 'snapback', 'body_chain', 'chunky_jewelry', 'statement_necklace'];

/**
 * Extract accessory type tags from wardrobe item data
 */
export function extractAccessoryTags(item: any): string[] {
  const tags: string[] = [];
  const name = (item.name || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const itemType = (item.item_type || '').toLowerCase();
  const styleNotes = (item.style_notes_detailed || '').toLowerCase();
  
  const allAccessoryTags = [...JEWELRY_ACCESSORIES, ...FORMAL_ACCESSORIES, ...BAG_ACCESSORIES, 
                            ...BACKPACK_TYPES, ...ETHNIC_ACCESSORIES, ...STREETWEAR_ACCESSORIES, ...CASUAL_ACCESSORIES];
  
  for (const tag of allAccessoryTags) {
    const normalizedTag = tag.replace(/_/g, ' ');
    if (name.includes(normalizedTag) || name.includes(tag) || 
        itemType.includes(normalizedTag) || itemType.includes(tag) ||
        category.includes(normalizedTag) || category.includes(tag) ||
        styleNotes.includes(normalizedTag) || styleNotes.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Infer from common patterns
  if (name.includes('watch')) tags.push('watch');
  if (name.includes('belt')) tags.push('belt');
  if (name.includes('ring') && !name.includes('earring')) tags.push('ring');
  if (name.includes('earring')) tags.push('earrings');
  if (name.includes('necklace') || name.includes('chain') || name.includes('pendant')) tags.push('necklace');
  if (name.includes('bracelet') || name.includes('bangle')) tags.push('bracelet');
  if (name.includes('bag') && !tags.some(t => t.includes('bag'))) {
    if (name.includes('back')) tags.push('backpack');
    else if (name.includes('clutch')) tags.push('clutch');
    else if (name.includes('tote')) tags.push('tote');
    else if (name.includes('cross')) tags.push('crossbody');
    else tags.push('bag');
  }
  if (name.includes('sunglasses') || name.includes('shades')) tags.push('sunglasses');
  if (name.includes('tie') && !name.includes('hair')) tags.push('tie');
  if (name.includes('cap') || name.includes('hat') || name.includes('beanie')) tags.push('cap');
  if (name.includes('scarf') || name.includes('stole') || name.includes('dupatta')) tags.push('stole');
  
  return [...new Set(tags)];
}

/**
 * Infer formality code from accessory tags
 */
export function inferAccessoryFormality(tags: string[]): FormalityCode {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  // Formal accessories
  if (tagSet.has('tie') || tagSet.has('pocket_square') || tagSet.has('cufflinks') || 
      tagSet.has('brooch') || tagSet.has('briefcase')) return 'frm';
  
  // Business/semi-formal
  if (tagSet.has('watch') || tagSet.has('belt') || tagSet.has('laptop_bag') || 
      tagSet.has('structured_bag') || tagSet.has('clutch')) return 'bsc';
  
  // Smart casual
  if (tagSet.has('tote') || tagSet.has('crossbody') || tagSet.has('messenger_bag') ||
      JEWELRY_ACCESSORIES.some(j => tagSet.has(j))) return 'smc';
  
  // Casual
  if (tagSet.has('backpack') || tagSet.has('cap') || tagSet.has('fanny_pack') ||
      tagSet.has('snapback')) return 'cas';
  
  return 'smc'; // Default to smart casual
}

/**
 * Score an accessory for a given context
 */
function scoreAccessory(
  accessory: AccessoryMeta,
  blueprint: OutfitBlueprint | null,
  occasion: string,
  styleKey: StyleKey | null
): ScoredAccessory {
  let score = 0;
  const breakdown: string[] = [];
  const tagSet = new Set(accessory.typeTags.map(t => t.toLowerCase()));
  
  // 1. Blueprint preferred accessories (+3 each)
  if (blueprint?.preferredAccessories) {
    for (const preferred of blueprint.preferredAccessories) {
      if (tagSet.has(preferred.toLowerCase()) || 
          accessory.typeTags.some(t => t.toLowerCase().includes(preferred.toLowerCase()))) {
        score += 3;
        breakdown.push(`+3 blueprint preferred: ${preferred}`);
        break; // Only count once
      }
    }
  }
  
  // 2. Watch is universally good (+2)
  if (tagSet.has('watch')) {
    score += 2;
    breakdown.push('+2 watch bonus');
  }
  
  // 3. Occasion-specific scoring
  const occasionScore = getOccasionAccessoryScore(accessory.typeTags, occasion, blueprint);
  score += occasionScore.score;
  if (occasionScore.reason) breakdown.push(occasionScore.reason);
  
  // 4. Style-specific bonuses
  const styleScore = getStyleAccessoryScore(accessory.typeTags, styleKey);
  score += styleScore.score;
  if (styleScore.reason) breakdown.push(styleScore.reason);
  
  // 5. Formality alignment
  const formalityScore = getAccessoryFormalityScore(accessory.formalityCode, blueprint);
  score += formalityScore.score;
  if (formalityScore.reason) breakdown.push(formalityScore.reason);
  
  // 6. Ethnic accessories for Indian occasions
  if (isIndianOccasion(occasion)) {
    if (ETHNIC_ACCESSORIES.some(t => tagSet.has(t))) {
      score += 2;
      breakdown.push('+2 ethnic accessory for Indian occasion');
    }
  }
  
  // Determine priority based on score
  let priority: 'primary' | 'secondary' | 'optional' = 'optional';
  if (score >= 4) priority = 'primary';
  else if (score >= 2) priority = 'secondary';
  
  return { ...accessory, score, priority, scoreBreakdown: breakdown };
}

function getOccasionAccessoryScore(
  tags: string[], 
  occasion: string, 
  blueprint: OutfitBlueprint | null
): { score: number; reason?: string } {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  // Wedding scoring
  if (occasion.includes('wedding') || occasion.includes('sangeet') || occasion.includes('reception')) {
    // Banned items
    for (const banned of BANNED_FOR_WEDDING) {
      if (tagSet.has(banned)) return { score: -5, reason: `-5 ${banned} inappropriate for wedding` };
    }
    // Preferred items
    if (tagSet.has('clutch') || tagSet.has('potli')) return { score: 2, reason: '+2 clutch/potli for wedding' };
    if (JEWELRY_ACCESSORIES.some(j => tagSet.has(j))) return { score: 1, reason: '+1 jewelry for wedding' };
  }
  
  // Office scoring
  if (occasion.includes('office') || occasion.includes('work') || occasion.includes('meeting')) {
    for (const banned of BANNED_FOR_OFFICE) {
      if (tagSet.has(banned)) return { score: -3, reason: `-3 ${banned} inappropriate for office` };
    }
    if (tagSet.has('watch') || tagSet.has('belt')) return { score: 2, reason: '+2 watch/belt for office' };
    if (tagSet.has('laptop_bag') || tagSet.has('tote')) return { score: 1, reason: '+1 work bag' };
  }
  
  // Interview scoring (strictest)
  if (occasion.includes('interview')) {
    for (const banned of BANNED_FOR_INTERVIEW) {
      if (tagSet.has(banned)) return { score: -5, reason: `-5 ${banned} inappropriate for interview` };
    }
    if (tagSet.has('watch')) return { score: 3, reason: '+3 watch for interview' };
    if (tagSet.has('belt')) return { score: 2, reason: '+2 belt for interview' };
  }
  
  // Date night scoring
  if (occasion.includes('date')) {
    if (tagSet.has('clutch') || tagSet.has('crossbody')) return { score: 2, reason: '+2 nice bag for date' };
    if (JEWELRY_ACCESSORIES.some(j => tagSet.has(j))) return { score: 1, reason: '+1 jewelry for date' };
  }
  
  // Party scoring
  if (occasion.includes('party') || occasion.includes('club')) {
    if (tagSet.has('clutch') || tagSet.has('chain_bag')) return { score: 2, reason: '+2 party bag' };
    if (tagSet.has('statement_earrings') || tagSet.has('body_chain')) return { score: 2, reason: '+2 statement accessory' };
  }
  
  // College/casual - backpacks are good
  if (occasion.includes('college') || occasion.includes('casual')) {
    if (tagSet.has('backpack')) return { score: 2, reason: '+2 backpack for casual/college' };
    if (tagSet.has('cap') || tagSet.has('sunglasses')) return { score: 1, reason: '+1 casual accessory' };
  }
  
  // Check blueprint allowBackpacks
  if (blueprint && !blueprint.allowBackpacks && tagSet.has('backpack')) {
    return { score: -3, reason: '-3 backpack not allowed for this occasion' };
  }
  
  return { score: 0 };
}

function getStyleAccessoryScore(tags: string[], styleKey: StyleKey | null): { score: number; reason?: string } {
  if (!styleKey) return { score: 0 };
  
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  switch (styleKey) {
    case 'streetwear':
      if (STREETWEAR_ACCESSORIES.some(t => tagSet.has(t))) {
        return { score: 2, reason: '+2 streetwear accessory' };
      }
      break;
    case 'elegant':
    case 'formal_power':
      if (tagSet.has('clutch') || tagSet.has('watch') || tagSet.has('tie') || tagSet.has('pocket_square')) {
        return { score: 2, reason: '+2 elegant accessory' };
      }
      break;
    case 'boho':
      if (tagSet.has('scarf') || tagSet.has('stole') || tagSet.has('crossbody') || 
          tagSet.has('bracelet') || tagSet.has('ring')) {
        return { score: 2, reason: '+2 boho accessory' };
      }
      break;
    case 'minimal':
      if (tagSet.has('watch') || tagSet.has('thin_chain') || tagSet.has('minimal_jewelry')) {
        return { score: 2, reason: '+2 minimal accessory' };
      }
      // Penalize statement pieces for minimal style
      if (tagSet.has('statement_necklace') || tagSet.has('chunky_jewelry')) {
        return { score: -1, reason: '-1 too bold for minimal style' };
      }
      break;
    case 'ethnic_chic':
      if (ETHNIC_ACCESSORIES.some(t => tagSet.has(t))) {
        return { score: 2, reason: '+2 ethnic accessory' };
      }
      break;
    case 'preppy':
      if (tagSet.has('belt') || tagSet.has('watch') || tagSet.has('tote')) {
        return { score: 2, reason: '+2 preppy accessory' };
      }
      break;
    case 'grunge':
      if (tagSet.has('chain') || tagSet.has('ring') || tagSet.has('choker')) {
        return { score: 2, reason: '+2 grunge accessory' };
      }
      break;
    case 'athleisure':
    case 'sporty':
      if (tagSet.has('cap') || tagSet.has('sunglasses') || tagSet.has('backpack')) {
        return { score: 2, reason: '+2 sporty accessory' };
      }
      break;
  }
  
  return { score: 0 };
}

function getAccessoryFormalityScore(
  formalityCode: FormalityCode, 
  blueprint: OutfitBlueprint | null
): { score: number; reason?: string } {
  if (!blueprint) return { score: 0 };
  
  const blueprintFormality = blueprint.formalityLevel;
  
  // Perfect match
  if ((blueprintFormality === 'formal' || blueprintFormality === 'black_tie') && formalityCode === 'frm') {
    return { score: 1, reason: '+1 formal accessory match' };
  }
  if (blueprintFormality === 'semi_formal' && (formalityCode === 'bsc' || formalityCode === 'frm')) {
    return { score: 1, reason: '+1 semi-formal accessory match' };
  }
  if (blueprintFormality === 'smart_casual' && (formalityCode === 'smc' || formalityCode === 'bsc')) {
    return { score: 1, reason: '+1 smart-casual accessory match' };
  }
  if (blueprintFormality === 'casual' && (formalityCode === 'cas' || formalityCode === 'smc')) {
    return { score: 1, reason: '+1 casual accessory match' };
  }
  
  // Mismatch penalties
  if ((blueprintFormality === 'formal' || blueprintFormality === 'black_tie') && formalityCode === 'cas') {
    return { score: -1, reason: '-1 too casual for formal occasion' };
  }
  
  return { score: 0 };
}

function isIndianOccasion(occasion: string): boolean {
  const indianOccasions = ['wedding', 'sangeet', 'mehndi', 'haldi', 'puja', 'diwali', 'eid', 'festive', 'traditional'];
  return indianOccasions.some(o => occasion.includes(o));
}

/**
 * Plan accessory selection for an outfit
 */
export function planAccessories(args: {
  accessories: AccessoryMeta[];
  blueprint: OutfitBlueprint | null;
  occasion: string | null;
  styleKey: StyleKey | null;
}): AccessorySelectionPlan {
  const { accessories, blueprint, occasion, styleKey } = args;
  const normalizedOccasion = (occasion || '').toLowerCase();
  
  // Score all accessories
  const scored = accessories.map(acc => 
    scoreAccessory(acc, blueprint, normalizedOccasion, styleKey)
  ).sort((a, b) => b.score - a.score);
  
  // Filter out severely penalized
  const viable = scored.filter(acc => acc.score >= -1);
  
  // Determine max recommended based on occasion
  let maxRecommended = 2;
  if (normalizedOccasion.includes('wedding') || normalizedOccasion.includes('party')) {
    maxRecommended = 3; // Allow more accessories for festive occasions
  } else if (normalizedOccasion.includes('interview') || normalizedOccasion.includes('office')) {
    maxRecommended = 2; // Keep it minimal for professional settings
  } else if (normalizedOccasion.includes('casual') || normalizedOccasion.includes('college')) {
    maxRecommended = 2;
  }
  
  // Select primary (usually watch or statement piece)
  const primary = viable.find(acc => acc.priority === 'primary') || 
                  (viable.length > 0 ? viable[0] : null);
  
  // Select secondary (different category from primary)
  let secondary: ScoredAccessory | null = null;
  if (primary && viable.length > 1) {
    const primaryTags = new Set(primary.typeTags);
    secondary = viable.find(acc => 
      acc.id !== primary.id && 
      !acc.typeTags.some(t => primaryTags.has(t)) && // Different category
      acc.score >= 0
    ) || null;
  }
  
  // Special rule: If watch is available and good, prefer it
  const watchAccessory = viable.find(acc => acc.typeTags.includes('watch'));
  if (watchAccessory && watchAccessory.score >= 2) {
    if (!primary || !primary.typeTags.includes('watch')) {
      secondary = primary;
      // Create a new ScoredAccessory object with primary priority
      const watchAsPrimary: ScoredAccessory = { ...watchAccessory, priority: 'primary' };
      return {
        primary: watchAsPrimary,
        secondary: secondary && secondary.id !== watchAccessory.id ? secondary : null,
        all: viable,
        maxRecommended
      };
    }
  }
  
  return {
    primary: primary ? { ...primary, priority: 'primary' } : null,
    secondary: secondary ? { ...secondary, priority: 'secondary' } : null,
    all: viable,
    maxRecommended
  };
}

/**
 * Convert wardrobe item to AccessoryMeta
 */
export function wardrobeItemToAccessoryMeta(item: any): AccessoryMeta {
  const typeTags = extractAccessoryTags(item);
  return {
    id: item.id,
    name: item.name,
    typeTags,
    formalityCode: inferAccessoryFormality(typeTags),
    category: item.category,
    color: item.color || item.primary_color
  };
}

/**
 * Check if an accessory conflicts with another (e.g., two bags)
 */
export function accessoriesConflict(acc1: AccessoryMeta, acc2: AccessoryMeta): boolean {
  const tags1 = new Set(acc1.typeTags);
  const tags2 = new Set(acc2.typeTags);
  
  // Two bags conflict
  const isBag1 = BAG_ACCESSORIES.some(b => tags1.has(b)) || BACKPACK_TYPES.some(b => tags1.has(b));
  const isBag2 = BAG_ACCESSORIES.some(b => tags2.has(b)) || BACKPACK_TYPES.some(b => tags2.has(b));
  if (isBag1 && isBag2) return true;
  
  // Two of the same jewelry type conflict
  for (const jewelry of JEWELRY_ACCESSORIES) {
    if (tags1.has(jewelry) && tags2.has(jewelry)) return true;
  }
  
  return false;
}
