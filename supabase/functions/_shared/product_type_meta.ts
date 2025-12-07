/**
 * Product Type Metadata Engine - Phase 6.3 + 6.5
 * Extracts detailed product type flags from wardrobe item data
 * Used for blueprint-aware filtering and scoring
 * 
 * PHASE 6.5 PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - String matching is O(n) where n is keyword count (small constant)
 * - No Supabase queries, no Gemini calls
 * - Works only on in-memory data
 */

export interface ProductTypeMeta {
  productType?: string;
  // Tops
  isTshirt?: boolean;
  isShirt?: boolean;
  isBlouse?: boolean;
  isPolo?: boolean;
  isCropTop?: boolean;
  isHoodie?: boolean;
  isSweatshirt?: boolean;
  isTankTop?: boolean;
  // Bottoms
  isJeans?: boolean;
  isCargo?: boolean;
  isChinos?: boolean;
  isFormalTrouser?: boolean;
  isShorts?: boolean;
  isSkirt?: boolean;
  isLeggings?: boolean;
  isJoggers?: boolean;
  isPalazzo?: boolean;
  // Dresses
  isDress?: boolean;
  isGown?: boolean;
  isMiniDress?: boolean;
  isMidiDress?: boolean;
  isMaxiDress?: boolean;
  isBodycon?: boolean;
  // Ethnic
  isEthnic?: boolean;
  isKurta?: boolean;
  isSaree?: boolean;
  isLehenga?: boolean;
  isSherwani?: boolean;
  isAnarkali?: boolean;
  isSalwarSet?: boolean;
  // Outerwear
  isBlazer?: boolean;
  isJacket?: boolean;
  isCardigan?: boolean;
  isNehruJacket?: boolean;
  isBomber?: boolean;
  isDenimJacket?: boolean;
  isLeatherJacket?: boolean;
  isHoodieJacket?: boolean;
  // Footwear
  isSneaker?: boolean;
  isFormalShoe?: boolean;
  isHeel?: boolean;
  isLoafer?: boolean;
  isMojariJutti?: boolean;
  isFlipFlop?: boolean;
  isSportsShoe?: boolean;
  isSandal?: boolean;
  isBoots?: boolean;
  // Accessories
  isBackpack?: boolean;
  isClutchOrSmallBag?: boolean;
  isOfficeBag?: boolean;
  isToteBag?: boolean;
  isWatch?: boolean;
  isJewelry?: boolean;
  isBelt?: boolean;
  isTie?: boolean;
  isSunglasses?: boolean;
  isCap?: boolean;
}

/**
 * Extract product type metadata from a wardrobe item
 * Uses category, item_type, name, style_aesthetic, and other fields
 */
export function extractProductTypeMeta(item: any): ProductTypeMeta {
  const name = (item?.name || '').toLowerCase();
  const category = (item?.category || '').toLowerCase();
  const itemType = (item?.item_type || '').toLowerCase();
  const styleAesthetic = (item?.style_aesthetic || []).map((s: string) => (s || '').toLowerCase());
  const styleNotes = (item?.style_notes_detailed || '').toLowerCase();
  const fabricPrimary = (item?.fabric_primary || '').toLowerCase();
  
  const combined = `${name} ${category} ${itemType} ${styleNotes}`;
  
  const meta: ProductTypeMeta = {};
  
  // Derive primary product type
  meta.productType = deriveProductType(combined, category);
  
  // === TOPS ===
  meta.isTshirt = /t-?shirt|tee\b/.test(combined);
  meta.isShirt = /\bshirt\b/.test(combined) && !meta.isTshirt && !/t-?shirt/.test(combined);
  meta.isBlouse = /blouse/.test(combined);
  meta.isPolo = /polo/.test(combined);
  meta.isCropTop = /crop.?top|cropped/.test(combined);
  meta.isHoodie = /hoodie/.test(combined);
  meta.isSweatshirt = /sweatshirt/.test(combined);
  meta.isTankTop = /tank.?top|tank\b/.test(combined);
  
  // === BOTTOMS ===
  meta.isJeans = /jeans|denim.?(pant|trouser)/.test(combined) && !category.includes('jacket');
  meta.isCargo = /cargo/.test(combined);
  meta.isChinos = /chino/.test(combined);
  meta.isFormalTrouser = /formal.?(trouser|pant)|dress.?pant|tailored.?pant/.test(combined);
  meta.isShorts = /\bshorts?\b/.test(combined);
  meta.isSkirt = /skirt/.test(combined);
  meta.isLeggings = /legging/.test(combined);
  meta.isJoggers = /jogger|track.?pant/.test(combined);
  meta.isPalazzo = /palazzo/.test(combined);
  
  // === DRESSES ===
  meta.isDress = /\bdress\b/.test(combined);
  meta.isGown = /gown/.test(combined);
  meta.isMiniDress = /mini.?dress/.test(combined);
  meta.isMidiDress = /midi.?dress/.test(combined);
  meta.isMaxiDress = /maxi.?dress/.test(combined);
  meta.isBodycon = /bodycon/.test(combined);
  
  // === ETHNIC ===
  meta.isKurta = /kurta/.test(combined);
  meta.isSaree = /saree|sari\b/.test(combined);
  meta.isLehenga = /lehenga/.test(combined);
  meta.isSherwani = /sherwani/.test(combined);
  meta.isAnarkali = /anarkali/.test(combined);
  meta.isSalwarSet = /salwar|churidar/.test(combined);
  meta.isEthnic = meta.isKurta || meta.isSaree || meta.isLehenga || 
                  meta.isSherwani || meta.isAnarkali || meta.isSalwarSet ||
                  /ethnic|traditional|indian/.test(combined);
  
  // === OUTERWEAR ===
  meta.isBlazer = /blazer/.test(combined);
  meta.isNehruJacket = /nehru.?jacket|bandhgala|bandi/.test(combined);
  meta.isBomber = /bomber/.test(combined);
  meta.isDenimJacket = /denim.?jacket/.test(combined);
  meta.isLeatherJacket = /leather.?jacket/.test(combined);
  meta.isCardigan = /cardigan/.test(combined);
  meta.isHoodieJacket = /hoodie|hooded.?jacket/.test(combined);
  meta.isJacket = /jacket/.test(combined) && !meta.isNehruJacket && 
                  !meta.isBomber && !meta.isDenimJacket && !meta.isLeatherJacket;
  
  // === FOOTWEAR ===
  meta.isSneaker = /sneaker|trainer/.test(combined);
  meta.isFormalShoe = /formal.?shoe|oxford|derby|brogue|monk.?strap|dress.?shoe/.test(combined);
  meta.isHeel = /heel|stiletto|pump\b|wedge/.test(combined);
  meta.isLoafer = /loafer|moccasin/.test(combined);
  meta.isMojariJutti = /mojari|jutti|juti|kolhapuri/.test(combined);
  meta.isFlipFlop = /flip.?flop|slipper|slide\b/.test(combined);
  meta.isSportsShoe = /sports?.?shoe|running.?shoe|gym.?shoe|athletic/.test(combined);
  meta.isSandal = /sandal/.test(combined);
  meta.isBoots = /boot/.test(combined);
  
  // === ACCESSORIES ===
  meta.isBackpack = /backpack|rucksack/.test(combined);
  meta.isClutchOrSmallBag = /clutch|potli|minaudiere|evening.?bag/.test(combined);
  meta.isOfficeBag = /laptop.?bag|briefcase|messenger.?bag|work.?bag/.test(combined);
  meta.isToteBag = /tote/.test(combined);
  meta.isWatch = /watch\b/.test(combined);
  meta.isJewelry = /necklace|earring|bracelet|bangle|ring\b|pendant|chain\b|choker/.test(combined);
  meta.isBelt = /\bbelt\b/.test(combined);
  meta.isTie = /\btie\b/.test(combined) && !/bow.?tie/.test(combined) && !/hair/.test(combined);
  meta.isSunglasses = /sunglass|shades/.test(combined);
  meta.isCap = /\bcap\b|beanie|hat\b/.test(combined);
  
  return meta;
}

function deriveProductType(combined: string, category: string): string {
  // Try to derive the most specific product type
  if (/t-?shirt|tee\b/.test(combined)) return 'tshirt';
  if (/polo/.test(combined)) return 'polo';
  if (/blouse/.test(combined)) return 'blouse';
  if (/crop.?top/.test(combined)) return 'crop_top';
  if (/\bshirt\b/.test(combined)) return 'shirt';
  if (/kurta/.test(combined)) return 'kurta';
  if (/hoodie/.test(combined)) return 'hoodie';
  if (/sweatshirt/.test(combined)) return 'sweatshirt';
  
  if (/jeans/.test(combined)) return 'jeans';
  if (/cargo/.test(combined)) return 'cargo';
  if (/chino/.test(combined)) return 'chinos';
  if (/formal.?trouser|dress.?pant/.test(combined)) return 'formal_trouser';
  if (/jogger/.test(combined)) return 'joggers';
  if (/palazzo/.test(combined)) return 'palazzo';
  if (/skirt/.test(combined)) return 'skirt';
  if (/\bshort/.test(combined)) return 'shorts';
  
  if (/saree/.test(combined)) return 'saree';
  if (/lehenga/.test(combined)) return 'lehenga';
  if (/sherwani/.test(combined)) return 'sherwani';
  if (/anarkali/.test(combined)) return 'anarkali';
  
  if (/blazer/.test(combined)) return 'blazer';
  if (/nehru.?jacket|bandhgala/.test(combined)) return 'nehru_jacket';
  if (/bomber/.test(combined)) return 'bomber';
  if (/denim.?jacket/.test(combined)) return 'denim_jacket';
  if (/leather.?jacket/.test(combined)) return 'leather_jacket';
  if (/cardigan/.test(combined)) return 'cardigan';
  if (/jacket/.test(combined)) return 'jacket';
  
  if (/sneaker/.test(combined)) return 'sneakers';
  if (/oxford/.test(combined)) return 'oxford';
  if (/loafer/.test(combined)) return 'loafers';
  if (/heel/.test(combined)) return 'heels';
  if (/mojari|jutti/.test(combined)) return 'juttis';
  if (/boot/.test(combined)) return 'boots';
  if (/sandal/.test(combined)) return 'sandals';
  
  if (/dress/.test(combined)) return 'dress';
  if (/gown/.test(combined)) return 'gown';
  
  // Fallback to category
  if (category.includes('top')) return 'top';
  if (category.includes('bottom')) return 'bottom';
  if (category.includes('shoe') || category.includes('foot')) return 'shoes';
  if (category.includes('accessor')) return 'accessory';
  
  return 'unknown';
}

/**
 * Check if a product type is in an allowed list (fuzzy matching)
 */
export function isProductTypeAllowed(
  productType: string | undefined,
  allowedTypes: string[] | undefined
): boolean {
  if (!allowedTypes || allowedTypes.length === 0) return true; // No restriction
  if (!productType) return true; // Unknown type - allow by default
  
  const normalized = productType.toLowerCase().replace(/_/g, '');
  
  for (const allowed of allowedTypes) {
    const normalizedAllowed = allowed.toLowerCase().replace(/_/g, '');
    if (normalized.includes(normalizedAllowed) || normalizedAllowed.includes(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get formality code from product type meta
 */
export function inferFormalityFromProductMeta(meta: ProductTypeMeta): 'cas' | 'smc' | 'bsc' | 'frm' {
  // Formal items
  if (meta.isBlazer || meta.isFormalTrouser || meta.isFormalShoe || 
      meta.isSherwani || meta.isSaree || meta.isLehenga || meta.isGown ||
      meta.isTie) {
    return 'frm';
  }
  
  // Business/smart casual
  if (meta.isShirt || meta.isBlouse || meta.isChinos || meta.isLoafer ||
      meta.isNehruJacket || meta.isDress || meta.isHeel || 
      meta.isClutchOrSmallBag || meta.isWatch) {
    return 'bsc';
  }
  
  // Smart casual
  if (meta.isPolo || meta.isKurta || meta.isMidiDress || meta.isCardigan ||
      meta.isSneaker || meta.isToteBag) {
    return 'smc';
  }
  
  // Casual
  if (meta.isTshirt || meta.isJeans || meta.isCargo || meta.isShorts ||
      meta.isFlipFlop || meta.isSportsShoe || meta.isBackpack ||
      meta.isHoodie || meta.isJoggers || meta.isCap) {
    return 'cas';
  }
  
  return 'smc'; // Default to smart casual
}

/**
 * Check if an item can be elevated by a blazer/structured outerwear
 */
export function canBeElevatedByBlazer(meta: ProductTypeMeta): boolean {
  // T-shirts, polos, and casual tops can be elevated
  return !!(meta.isTshirt || meta.isPolo || meta.isTankTop);
}

/**
 * Check if item is a structured piece that elevates an outfit
 */
export function isStructuredPiece(meta: ProductTypeMeta): boolean {
  return !!(meta.isBlazer || meta.isNehruJacket || meta.isSherwani || 
           meta.isFormalTrouser || meta.isShirt || meta.isBlouse);
}
