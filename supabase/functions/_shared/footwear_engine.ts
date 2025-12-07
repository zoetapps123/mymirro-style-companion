// Footwear Intelligence Engine - Phase 6.2
// Scores and ranks footwear based on occasion, style, and blueprint rules

import { OutfitBlueprint, StyleKey } from './outfit_blueprints.ts';

export type FormalityCode = 'cas' | 'smc' | 'bsc' | 'frm';

export interface FootwearMeta {
  id: string;
  name?: string;
  styleTags: string[];
  formalityCode: FormalityCode;
  category?: string;
  color?: string;
}

export interface ScoredFootwear extends FootwearMeta {
  score: number;
  scoreBreakdown?: string[];
}

// Footwear tag categories for matching
const FORMAL_FOOTWEAR = ['formal_shoes', 'oxford', 'derby', 'brogue', 'monk_strap', 'patent_leather', 'dress_shoes'];
const SEMI_FORMAL_FOOTWEAR = ['loafers', 'mules', 'pumps', 'block_heels', 'kitten_heels', 'ballet_flats', 'boat_shoes'];
const SMART_CASUAL_FOOTWEAR = ['clean_sneakers', 'white_sneakers', 'chelsea_boots', 'ankle_boots', 'espadrilles', 'moccasins'];
const CASUAL_FOOTWEAR = ['sneakers', 'canvas_shoes', 'sandals', 'slides', 'flip_flops', 'slippers', 'running_shoes', 'sports_shoes', 'gym_shoes', 'high_tops'];
const ETHNIC_FOOTWEAR = ['mojari', 'juttis', 'kolhapuri', 'kohlapuri', 'jutti', 'mojri', 'embellished_flats'];
const HEELS = ['heels', 'stilettos', 'platform_heels', 'wedges', 'strappy_heels', 'block_heels', 'kitten_heels'];
const BOOTS = ['boots', 'ankle_boots', 'chelsea_boots', 'combat_boots', 'knee_boots', 'cowboy_boots'];

// Occasion-specific penalties
const BANNED_FOR_WEDDING = ['flip_flops', 'slides', 'slippers', 'sports_shoes', 'gym_shoes', 'running_shoes', 'crocs'];
const BANNED_FOR_OFFICE = ['flip_flops', 'slides', 'slippers', 'sports_shoes', 'gym_shoes', 'running_shoes', 'crocs', 'beach_sandals'];
const BANNED_FOR_PARTY = ['flip_flops', 'slippers', 'crocs', 'sports_shoes', 'running_shoes'];
const BANNED_FOR_INTERVIEW = ['flip_flops', 'slides', 'slippers', 'sports_shoes', 'gym_shoes', 'running_shoes', 'sneakers', 'canvas_shoes', 'crocs'];

/**
 * Extract footwear style tags from wardrobe item data
 */
export function extractFootwearTags(item: any): string[] {
  const tags: string[] = [];
  const name = (item.name || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const itemType = (item.item_type || '').toLowerCase();
  const styleNotes = (item.style_notes_detailed || '').toLowerCase();
  const styleAesthetic = (item.style_aesthetic || []).map((s: string) => s.toLowerCase());
  
  // Extract from name
  const allFootwearTags = [...FORMAL_FOOTWEAR, ...SEMI_FORMAL_FOOTWEAR, ...SMART_CASUAL_FOOTWEAR, 
                           ...CASUAL_FOOTWEAR, ...ETHNIC_FOOTWEAR, ...HEELS, ...BOOTS];
  
  for (const tag of allFootwearTags) {
    const normalizedTag = tag.replace(/_/g, ' ');
    if (name.includes(normalizedTag) || name.includes(tag) || 
        itemType.includes(normalizedTag) || itemType.includes(tag) ||
        styleNotes.includes(normalizedTag) || styleNotes.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Infer from common patterns
  if (name.includes('sneaker') || name.includes('trainer')) tags.push('sneakers');
  if (name.includes('heel') && !tags.some(t => t.includes('heel'))) tags.push('heels');
  if (name.includes('boot') && !tags.some(t => t.includes('boot'))) tags.push('boots');
  if (name.includes('sandal')) tags.push('sandals');
  if (name.includes('loafer')) tags.push('loafers');
  if (name.includes('oxford')) tags.push('oxford');
  if (name.includes('jutti') || name.includes('mojari') || name.includes('mojri')) tags.push('juttis');
  if (name.includes('kolhapuri') || name.includes('kohlapuri')) tags.push('kolhapuri');
  if (name.includes('formal')) tags.push('formal_shoes');
  if (name.includes('sports') || name.includes('running') || name.includes('gym')) tags.push('sports_shoes');
  if (name.includes('flip') || name.includes('flop') || name.includes('slipper')) tags.push('flip_flops');
  if (name.includes('slide')) tags.push('slides');
  
  // Add style aesthetic tags
  styleAesthetic.forEach((s: string) => {
    if (s.includes('formal')) tags.push('formal_shoes');
    if (s.includes('casual')) tags.push('sneakers');
    if (s.includes('ethnic')) tags.push('juttis');
  });
  
  return [...new Set(tags)]; // Deduplicate
}

/**
 * Infer formality code from footwear tags
 */
export function inferFootwearFormality(tags: string[]): FormalityCode {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  // Check for formal indicators
  if (FORMAL_FOOTWEAR.some(t => tagSet.has(t))) return 'frm';
  if (ETHNIC_FOOTWEAR.some(t => tagSet.has(t))) return 'bsc'; // Ethnic can be formal or smart casual
  if (HEELS.some(t => tagSet.has(t) && !t.includes('block') && !t.includes('kitten'))) return 'bsc';
  if (SEMI_FORMAL_FOOTWEAR.some(t => tagSet.has(t))) return 'smc';
  if (SMART_CASUAL_FOOTWEAR.some(t => tagSet.has(t))) return 'smc';
  if (CASUAL_FOOTWEAR.some(t => tagSet.has(t))) return 'cas';
  
  return 'cas'; // Default to casual
}

/**
 * Score footwear for a given context
 */
export function scoreFootwearForContext(args: {
  footwear: FootwearMeta[];
  blueprint: OutfitBlueprint | null;
  occasion: string | null;
  styleKey: StyleKey | null;
}): ScoredFootwear[] {
  const { footwear, blueprint, occasion, styleKey } = args;
  const normalizedOccasion = (occasion || '').toLowerCase();
  
  const scored: ScoredFootwear[] = footwear.map(fw => {
    let score = 0;
    const breakdown: string[] = [];
    const tagSet = new Set(fw.styleTags.map(t => t.toLowerCase()));
    
    // 1. Blueprint preferred tags matching (+3 each)
    if (blueprint?.preferredFootwearTags) {
      for (const preferred of blueprint.preferredFootwearTags) {
        if (tagSet.has(preferred.toLowerCase()) || 
            fw.styleTags.some(t => t.toLowerCase().includes(preferred.toLowerCase()))) {
          score += 3;
          breakdown.push(`+3 blueprint preferred: ${preferred}`);
        }
      }
    }
    
    // 2. Formality alignment (+2 or -2)
    const formalityScore = getFormalityAlignmentScore(fw.formalityCode, normalizedOccasion, blueprint);
    score += formalityScore.score;
    if (formalityScore.reason) breakdown.push(formalityScore.reason);
    
    // 3. Occasion-specific penalties (-3 to -5)
    const penaltyResult = getOccasionPenalty(fw.styleTags, normalizedOccasion, blueprint);
    score += penaltyResult.score;
    if (penaltyResult.reason) breakdown.push(penaltyResult.reason);
    
    // 4. Style-specific bonuses (+1 to +2)
    const styleBonus = getStyleBonus(fw.styleTags, styleKey);
    score += styleBonus.score;
    if (styleBonus.reason) breakdown.push(styleBonus.reason);
    
    // 5. Ethnic footwear bonus for Indian occasions (+2)
    if (isIndianOccasion(normalizedOccasion)) {
      if (ETHNIC_FOOTWEAR.some(t => tagSet.has(t))) {
        score += 2;
        breakdown.push('+2 ethnic footwear for Indian occasion');
      }
    }
    
    // 6. Heels bonus for formal female occasions (+1)
    if (blueprint?.gender === 'female' && 
        (normalizedOccasion.includes('wedding') || normalizedOccasion.includes('party') || normalizedOccasion.includes('date'))) {
      if (HEELS.some(t => tagSet.has(t))) {
        score += 1;
        breakdown.push('+1 heels bonus for occasion');
      }
    }
    
    return { ...fw, score, scoreBreakdown: breakdown };
  });
  
  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

function getFormalityAlignmentScore(
  formalityCode: FormalityCode, 
  occasion: string, 
  blueprint: OutfitBlueprint | null
): { score: number; reason?: string } {
  const blueprintFormality = blueprint?.formalityLevel || 'casual';
  
  // Map blueprint formality to expected footwear formality
  const expectedFormality: FormalityCode[] = [];
  switch (blueprintFormality) {
    case 'formal':
    case 'black_tie':
      expectedFormality.push('frm', 'bsc');
      break;
    case 'semi_formal':
      expectedFormality.push('frm', 'bsc', 'smc');
      break;
    case 'smart_casual':
      expectedFormality.push('smc', 'bsc', 'cas');
      break;
    case 'casual':
    default:
      expectedFormality.push('cas', 'smc');
  }
  
  if (expectedFormality[0] === formalityCode) {
    return { score: 2, reason: `+2 perfect formality match` };
  } else if (expectedFormality.includes(formalityCode)) {
    return { score: 1, reason: `+1 acceptable formality` };
  } else if (formalityCode === 'cas' && (occasion.includes('wedding') || occasion.includes('interview'))) {
    return { score: -2, reason: `-2 too casual for occasion` };
  }
  
  return { score: 0 };
}

function getOccasionPenalty(
  tags: string[], 
  occasion: string, 
  blueprint: OutfitBlueprint | null
): { score: number; reason?: string } {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  // Wedding penalties
  if (occasion.includes('wedding') || occasion.includes('sangeet') || occasion.includes('reception')) {
    for (const banned of BANNED_FOR_WEDDING) {
      if (tagSet.has(banned) || tags.some(t => t.toLowerCase().includes(banned))) {
        return { score: -5, reason: `-5 ${banned} inappropriate for wedding` };
      }
    }
  }
  
  // Office penalties
  if (occasion.includes('office') || occasion.includes('work') || occasion.includes('meeting')) {
    for (const banned of BANNED_FOR_OFFICE) {
      if (tagSet.has(banned) || tags.some(t => t.toLowerCase().includes(banned))) {
        return { score: -4, reason: `-4 ${banned} inappropriate for office` };
      }
    }
  }
  
  // Interview penalties (strictest)
  if (occasion.includes('interview')) {
    for (const banned of BANNED_FOR_INTERVIEW) {
      if (tagSet.has(banned) || tags.some(t => t.toLowerCase().includes(banned))) {
        return { score: -5, reason: `-5 ${banned} inappropriate for interview` };
      }
    }
  }
  
  // Party penalties
  if (occasion.includes('party') || occasion.includes('club')) {
    for (const banned of BANNED_FOR_PARTY) {
      if (tagSet.has(banned) || tags.some(t => t.toLowerCase().includes(banned))) {
        return { score: -3, reason: `-3 ${banned} inappropriate for party` };
      }
    }
  }
  
  // Check blueprint allowGymShoes
  if (blueprint && !blueprint.allowGymShoes) {
    if (tagSet.has('sports_shoes') || tagSet.has('gym_shoes') || tagSet.has('running_shoes')) {
      return { score: -3, reason: `-3 gym shoes not allowed for this occasion` };
    }
  }
  
  return { score: 0 };
}

function getStyleBonus(tags: string[], styleKey: StyleKey | null): { score: number; reason?: string } {
  if (!styleKey) return { score: 0 };
  
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  
  switch (styleKey) {
    case 'streetwear':
      if (tagSet.has('sneakers') || tagSet.has('high_tops') || tagSet.has('chunky_sneakers')) {
        return { score: 2, reason: `+2 streetwear footwear bonus` };
      }
      break;
    case 'elegant':
    case 'formal_power':
      if (FORMAL_FOOTWEAR.some(t => tagSet.has(t)) || HEELS.some(t => tagSet.has(t))) {
        return { score: 2, reason: `+2 elegant footwear bonus` };
      }
      break;
    case 'boho':
      if (tagSet.has('sandals') || tagSet.has('espadrilles') || tagSet.has('ankle_boots')) {
        return { score: 2, reason: `+2 boho footwear bonus` };
      }
      break;
    case 'minimal':
      if (tagSet.has('clean_sneakers') || tagSet.has('white_sneakers') || tagSet.has('loafers')) {
        return { score: 2, reason: `+2 minimal footwear bonus` };
      }
      break;
    case 'athleisure':
    case 'sporty':
      if (tagSet.has('sneakers') || tagSet.has('running_shoes') || tagSet.has('sports_shoes')) {
        return { score: 2, reason: `+2 sporty footwear bonus` };
      }
      break;
    case 'ethnic_chic':
      if (ETHNIC_FOOTWEAR.some(t => tagSet.has(t))) {
        return { score: 2, reason: `+2 ethnic footwear bonus` };
      }
      break;
    case 'preppy':
      if (tagSet.has('loafers') || tagSet.has('boat_shoes') || tagSet.has('oxford')) {
        return { score: 2, reason: `+2 preppy footwear bonus` };
      }
      break;
    case 'grunge':
      if (BOOTS.some(t => tagSet.has(t))) {
        return { score: 2, reason: `+2 grunge footwear bonus` };
      }
      break;
  }
  
  return { score: 0 };
}

function isIndianOccasion(occasion: string): boolean {
  const indianOccasions = ['wedding', 'sangeet', 'mehndi', 'haldi', 'puja', 'diwali', 'eid', 'festive', 'traditional'];
  return indianOccasions.some(o => occasion.includes(o));
}

/**
 * Get top N footwear options for an outfit
 */
export function getTopFootwearOptions(args: {
  footwear: FootwearMeta[];
  blueprint: OutfitBlueprint | null;
  occasion: string | null;
  styleKey: StyleKey | null;
  maxResults?: number;
}): ScoredFootwear[] {
  const scored = scoreFootwearForContext(args);
  const max = args.maxResults || 3;
  
  // Filter out severely penalized options
  const viable = scored.filter(fw => fw.score >= -2);
  
  return viable.slice(0, max);
}

/**
 * Convert wardrobe item to FootwearMeta
 */
export function wardrobeItemToFootwearMeta(item: any): FootwearMeta {
  const styleTags = extractFootwearTags(item);
  return {
    id: item.id,
    name: item.name,
    styleTags,
    formalityCode: inferFootwearFormality(styleTags),
    category: item.category,
    color: item.color || item.primary_color
  };
}
