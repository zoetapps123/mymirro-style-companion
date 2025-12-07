/**
 * Product Type Parser - Phase 7
 * Robust NLP-based parsing of product names to extract dominant type,
 * colors, patterns, and textures.
 * 
 * PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - String matching is O(n) where n is keyword count (small constant)
 * - No Supabase queries, no Gemini calls
 * - Works only on in-memory data
 */

export interface ParsedProductType {
  dominantType: string;
  allDetectedTypes: string[];
  extractedColor: string | null;
  extractedPattern: string | null;
  extractedTexture: string | null;
}

// ============================================
// KEYWORD PRIORITY LISTS (highest → lowest priority)
// ============================================

// Priority 1: Cargo pants
const CARGO_KEYWORDS = ['cargo pants', 'cargo pant', 'cargo'];

// Priority 2: Formal trousers
const FORMAL_TROUSER_KEYWORDS = ['formal trouser', 'dress pants', 'dress pant', 'tailored pant', 'tailored trouser'];

// Priority 3: Jeans/Denim
const JEANS_KEYWORDS = ['jeans', 'denim pant', 'denim trouser', 'wide_leg', 'wide leg', 'bootcut', 'straight_fit', 'straight fit', 'skinny jean', 'slim jean', 'flared jean', 'baggy jean', 'mom jean', 'boyfriend jean'];

// Priority 4: Ethnic wear
const ETHNIC_KEYWORDS = ['kurta', 'kurti', 'sherwani', 'lehenga', 'saree', 'sari', 'anarkali', 'choli', 'blouse', 'dupatta', 'salwar', 'churidar', 'palazzo', 'sharara', 'gharara', 'bandhgala', 'nehru jacket', 'achkan', 'pathani', 'dhoti'];

// Priority 5: Tops
const TOP_KEYWORDS = ['tshirt', 't-shirt', 'tee', 'tank', 'tank top', 'crop top', 'halter', 'corset', 'camisole', 'cami', 'bodysuit', 'tube top', 'peplum', 'off shoulder', 'one shoulder'];

// Priority 6: Outerwear
const OUTERWEAR_KEYWORDS = ['jacket', 'blazer', 'overshirt', 'shrug', 'coat', 'cardigan', 'bomber', 'denim jacket', 'leather jacket', 'hoodie', 'windbreaker', 'parka', 'trench', 'cape', 'poncho'];

// Priority 7: Footwear
const FOOTWEAR_KEYWORDS = ['heels', 'heel', 'pumps', 'pump', 'loafers', 'loafer', 'sneakers', 'sneaker', 'juttis', 'jutti', 'mojari', 'kolhapuri', 'oxford', 'derby', 'brogue', 'stiletto', 'wedge', 'mule', 'sandal', 'boot', 'espadrille', 'flat', 'slipper', 'flip flop'];

// Priority 8: Dresses
const DRESS_KEYWORDS = ['dress', 'gown', 'midi', 'maxi', 'slip dress', 'bodycon', 'co-ord dress', 'coord dress', 'sheath', 'shift dress', 'wrap dress', 'a-line dress', 'romper', 'jumpsuit'];

// Priority 9: Bags/Accessories
const BAG_KEYWORDS = ['bag', 'backpack', 'tote', 'clutch', 'potli', 'sling bag', 'crossbody', 'messenger', 'briefcase', 'handbag', 'purse', 'satchel'];

// Bottom keywords (not in priority order, used for detection)
const BOTTOM_KEYWORDS = ['pants', 'pant', 'trouser', 'trousers', 'shorts', 'short', 'skirt', 'legging', 'leggings', 'jogger', 'joggers', 'chino', 'chinos', 'culottes', 'cigarette pant', 'parallel pant', 'pleated trouser', 'track pant'];

// ============================================
// COLOR KEYWORDS
// ============================================
const COLOR_KEYWORDS = [
  'black', 'white', 'off-white', 'off white', 'ivory', 'beige', 'cream', 
  'navy', 'blue', 'sky-blue', 'sky blue', 'royal blue', 'cobalt', 'teal',
  'red', 'maroon', 'wine', 'burgundy', 'crimson', 'scarlet',
  'pink', 'baby-pink', 'baby pink', 'hot-pink', 'hot pink', 'blush', 'rose', 'coral', 'salmon', 'fuchsia', 'magenta',
  'purple', 'lavender', 'lilac', 'violet', 'plum', 'mauve',
  'orange', 'rust', 'terracotta', 'tangerine', 'peach', 'apricot',
  'brown', 'tan', 'camel', 'chocolate', 'coffee', 'taupe', 'mocha',
  'yellow', 'mustard', 'gold', 'golden', 'lemon', 'canary',
  'mint', 'green', 'olive', 'forest-green', 'forest green', 'sage', 'emerald', 'hunter green', 'khaki',
  'grey', 'gray', 'charcoal', 'silver', 'slate',
  'nude', 'champagne', 'copper', 'bronze'
];

// ============================================
// PATTERN KEYWORDS
// ============================================
const PATTERN_KEYWORDS = [
  'striped', 'stripes', 'stripe',
  'checkered', 'checked', 'check', 'plaid', 'gingham', 'tartan',
  'dotted', 'polka', 'polka dot', 'polka-dot',
  'floral', 'flower', 'botanical',
  'embroidered', 'embroidery', 'chikankari', 'zari', 'zardozi', 'sequin', 'sequined',
  'printed', 'print', 'graphic', 'abstract',
  'paisley', 'ikat', 'batik', 'tie-dye', 'tie dye',
  'geometric', 'animal print', 'leopard', 'zebra', 'camo', 'camouflage',
  'brocade', 'jacquard', 'damask', 'houndstooth', 'herringbone',
  'solid', 'plain'
];

// ============================================
// TEXTURE KEYWORDS
// ============================================
const TEXTURE_KEYWORDS = [
  'ribbed', 'rib',
  'knit', 'knitted', 'cable knit',
  'wool', 'woolen', 'cashmere', 'merino',
  'denim',
  'leather', 'faux leather', 'vegan leather', 'suede',
  'corduroy', 'cord',
  'silk', 'silky', 'satin', 'sateen',
  'linen', 'linen blend',
  'cotton', 'jersey', 'pique',
  'velvet', 'velour',
  'tweed', 'boucle',
  'chiffon', 'georgette', 'organza', 'tulle', 'net', 'lace', 'crochet',
  'fleece', 'terry', 'sherpa',
  'polyester', 'nylon', 'spandex', 'lycra'
];

// ============================================
// PARSER FUNCTION
// ============================================

/**
 * Parse product type from name with robust NLP-style matching
 * Uses priority-based keyword detection
 */
export function parseProductTypeFromName(name: string): ParsedProductType {
  // Normalize: lowercase, remove extra punctuation, split by space/hyphen/underscore
  const normalized = (name || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const allDetectedTypes: string[] = [];
  let dominantType = 'unknown';
  
  // ============================================
  // PRIORITY-BASED TYPE DETECTION
  // ============================================
  
  // Priority 1: Cargo
  if (CARGO_KEYWORDS.some(k => normalized.includes(k.toLowerCase()))) {
    allDetectedTypes.push('cargo');
    if (dominantType === 'unknown') dominantType = 'cargo';
  }
  
  // Priority 2: Formal trouser
  if (FORMAL_TROUSER_KEYWORDS.some(k => normalized.includes(k.toLowerCase()))) {
    allDetectedTypes.push('formal_trouser');
    if (dominantType === 'unknown') dominantType = 'formal_trouser';
  }
  
  // Priority 3: Jeans
  if (JEANS_KEYWORDS.some(k => normalized.includes(k.toLowerCase()))) {
    allDetectedTypes.push('jeans');
    if (dominantType === 'unknown') dominantType = 'jeans';
  }
  
  // Priority 4: Ethnic
  for (const k of ETHNIC_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_');
      allDetectedTypes.push(specificType);
      if (dominantType === 'unknown') dominantType = specificType;
    }
  }
  
  // Priority 5: Tops
  for (const k of TOP_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_').replace(/-/g, '');
      if (!allDetectedTypes.includes(specificType)) {
        allDetectedTypes.push('top');
        if (dominantType === 'unknown') dominantType = 'top';
      }
      break;
    }
  }
  
  // Priority 6: Outerwear
  for (const k of OUTERWEAR_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_');
      allDetectedTypes.push(specificType);
      if (dominantType === 'unknown') dominantType = specificType;
      break;
    }
  }
  
  // Priority 7: Footwear
  for (const k of FOOTWEAR_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_');
      allDetectedTypes.push(specificType);
      allDetectedTypes.push('footwear');
      if (dominantType === 'unknown') dominantType = specificType;
      break;
    }
  }
  
  // Priority 8: Dresses
  for (const k of DRESS_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_');
      allDetectedTypes.push(specificType);
      allDetectedTypes.push('dress');
      if (dominantType === 'unknown') dominantType = specificType;
      break;
    }
  }
  
  // Priority 9: Bags/Accessories
  for (const k of BAG_KEYWORDS) {
    if (normalized.includes(k.toLowerCase())) {
      const specificType = k.replace(/\s+/g, '_');
      allDetectedTypes.push(specificType);
      allDetectedTypes.push('accessory');
      if (dominantType === 'unknown') dominantType = specificType;
      break;
    }
  }
  
  // Check for other bottoms
  for (const k of BOTTOM_KEYWORDS) {
    if (normalized.includes(k.toLowerCase()) && !allDetectedTypes.some(t => ['cargo', 'jeans', 'formal_trouser'].includes(t))) {
      allDetectedTypes.push('bottom');
      if (dominantType === 'unknown') dominantType = 'bottom';
      break;
    }
  }
  
  // ============================================
  // COLOR EXTRACTION
  // ============================================
  let extractedColor: string | null = null;
  for (const color of COLOR_KEYWORDS) {
    if (normalized.includes(color.toLowerCase())) {
      extractedColor = color.replace(/\s+/g, '-');
      break;
    }
  }
  
  // ============================================
  // PATTERN EXTRACTION
  // ============================================
  let extractedPattern: string | null = null;
  for (const pattern of PATTERN_KEYWORDS) {
    if (normalized.includes(pattern.toLowerCase())) {
      extractedPattern = pattern.replace(/\s+/g, '_');
      break;
    }
  }
  
  // ============================================
  // TEXTURE EXTRACTION
  // ============================================
  let extractedTexture: string | null = null;
  for (const texture of TEXTURE_KEYWORDS) {
    if (normalized.includes(texture.toLowerCase())) {
      extractedTexture = texture.replace(/\s+/g, '_');
      break;
    }
  }
  
  return {
    dominantType,
    allDetectedTypes: [...new Set(allDetectedTypes)],
    extractedColor,
    extractedPattern,
    extractedTexture
  };
}

/**
 * Check if a parsed type should be blocked for a given occasion
 * Returns true if the item should be blocked
 */
export function shouldBlockForOccasion(
  parsedType: ParsedProductType,
  occasion: string
): { blocked: boolean; reason?: string } {
  const occasionLower = (occasion || '').toLowerCase();
  const dominant = parsedType.dominantType;
  const allTypes = parsedType.allDetectedTypes;
  
  // ============================================
  // WEDDING BLOCKS
  // ============================================
  if (occasionLower.includes('wedding') || occasionLower.includes('sangeet') || occasionLower.includes('reception')) {
    if (dominant === 'cargo' || allTypes.includes('cargo')) {
      return { blocked: true, reason: 'Cargo pants not appropriate for wedding' };
    }
    if (allTypes.includes('joggers') || allTypes.includes('track_pant')) {
      return { blocked: true, reason: 'Joggers/track pants not appropriate for wedding' };
    }
    if (dominant === 'shorts' || allTypes.includes('shorts')) {
      return { blocked: true, reason: 'Shorts not appropriate for wedding' };
    }
    if (allTypes.includes('flip_flop') || allTypes.includes('slipper') || allTypes.includes('slides')) {
      return { blocked: true, reason: 'Flip flops/slippers not appropriate for wedding' };
    }
  }
  
  // ============================================
  // OFFICE BLOCKS
  // ============================================
  if (occasionLower.includes('office') || occasionLower.includes('work') || occasionLower.includes('business')) {
    if (dominant === 'shorts' || allTypes.includes('shorts')) {
      return { blocked: true, reason: 'Shorts not appropriate for office' };
    }
    if (allTypes.includes('track_pant') || allTypes.includes('joggers')) {
      return { blocked: true, reason: 'Track pants/joggers not appropriate for office' };
    }
    if (allTypes.includes('flip_flop') || allTypes.includes('slipper')) {
      return { blocked: true, reason: 'Flip flops/slippers not appropriate for office' };
    }
  }
  
  // ============================================
  // INTERVIEW BLOCKS (strictest)
  // ============================================
  if (occasionLower.includes('interview')) {
    if (dominant === 'jeans' || allTypes.includes('jeans')) {
      return { blocked: true, reason: 'Jeans not appropriate for interview' };
    }
    if (dominant === 'cargo' || allTypes.includes('cargo')) {
      return { blocked: true, reason: 'Cargo pants not appropriate for interview' };
    }
    if (dominant === 'shorts' || allTypes.includes('shorts')) {
      return { blocked: true, reason: 'Shorts not appropriate for interview' };
    }
    if (allTypes.includes('sneaker') || allTypes.includes('sneakers')) {
      return { blocked: true, reason: 'Sneakers not appropriate for interview' };
    }
    if (allTypes.includes('canvas')) {
      return { blocked: true, reason: 'Canvas shoes not appropriate for interview' };
    }
  }
  
  return { blocked: false };
}

/**
 * Check if jeans can be allowed for a given occasion (fallback logic)
 */
export function canAllowJeansAsException(
  occasion: string,
  hasFormalbottomwear: boolean,
  hasEthnicBottomwear: boolean
): boolean {
  const occasionLower = (occasion || '').toLowerCase();
  
  // Interview: never allow jeans
  if (occasionLower.includes('interview')) return false;
  
  // Wedding: only if no formal/ethnic options exist
  if (occasionLower.includes('wedding') || occasionLower.includes('sangeet')) {
    return !hasFormalbottomwear && !hasEthnicBottomwear;
  }
  
  // Office: allow dark/clean jeans
  if (occasionLower.includes('office') || occasionLower.includes('work')) {
    return true; // Jeans OK with smart top in office
  }
  
  // All other occasions: jeans typically OK
  return true;
}

/**
 * Check if cargo can be allowed for a given style
 */
export function canAllowCargosForStyle(
  style: string | null | undefined,
  blueprintAllowsCargos: boolean
): boolean {
  if (blueprintAllowsCargos) return true;
  
  const styleLower = (style || '').toLowerCase();
  
  // Streetwear style allows cargos
  if (styleLower.includes('street') || styleLower.includes('urban')) {
    return true;
  }
  
  // Grunge style allows cargos
  if (styleLower.includes('grunge')) {
    return true;
  }
  
  return false;
}

// Export keyword lists for external use
export const PRODUCT_TYPE_KEYWORDS = {
  CARGO_KEYWORDS,
  FORMAL_TROUSER_KEYWORDS,
  JEANS_KEYWORDS,
  ETHNIC_KEYWORDS,
  TOP_KEYWORDS,
  OUTERWEAR_KEYWORDS,
  FOOTWEAR_KEYWORDS,
  DRESS_KEYWORDS,
  BAG_KEYWORDS,
  BOTTOM_KEYWORDS,
  COLOR_KEYWORDS,
  PATTERN_KEYWORDS,
  TEXTURE_KEYWORDS
};
