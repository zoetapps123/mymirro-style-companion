/**
 * Centralized wardrobe item deduplication logic
 * Ensures consistent duplicate detection across all wardrobe upload flows
 */

interface WardrobeItemForDedup {
  name?: string | null;
  category?: string | null;
  color?: string | null;
  primary_color?: string | null;
  brand?: string | null;
}

/**
 * Normalize a string for comparison (lowercase, trim, strip punctuation)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if two names are strongly similar
 * Returns true if:
 * - Exact match after normalization
 * - One contains the other (bidirectional substring match)
 */
function areNamesStronglySimilar(name1: string, name2: string): boolean {
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  
  if (!n1 || !n2) return false;
  
  // Exact match
  if (n1 === n2) return true;
  
  // Bidirectional substring (one contains the other)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  return false;
}

/**
 * Check if two names are moderately similar
 * More lenient than strong similarity
 */
function areNamesModeratelySimilar(name1: string, name2: string): boolean {
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  
  if (!n1 || !n2) return false;
  
  // Use strong similarity as base
  if (areNamesStronglySimilar(name1, name2)) return true;
  
  // Check if names have significant word overlap
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const commonWords = words1.filter(w => words2.includes(w));
  const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
  
  return overlapRatio >= 0.5; // At least 50% word overlap
}

/**
 * Get the effective color for an item (prefer primary_color, fallback to color)
 */
function getEffectiveColor(item: WardrobeItemForDedup): string {
  return normalizeString(item.primary_color || item.color);
}

/**
 * Check if two colors match (only when both are present)
 */
function doColorsMatch(item1: WardrobeItemForDedup, item2: WardrobeItemForDedup): boolean {
  const color1 = getEffectiveColor(item1);
  const color2 = getEffectiveColor(item2);
  
  // Only match if BOTH colors are present
  if (!color1 || !color2) return false;
  
  return color1 === color2;
}

/**
 * Check if two brands match (only when both are present)
 */
function doBrandsMatch(item1: WardrobeItemForDedup, item2: WardrobeItemForDedup): boolean {
  const brand1 = normalizeString(item1.brand);
  const brand2 = normalizeString(item2.brand);
  
  // Only match if BOTH brands are present
  if (!brand1 || !brand2) return false;
  
  return brand1 === brand2;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
}

/**
 * Determine if a candidate item is likely a duplicate of an existing item
 * 
 * Logic:
 * 1. Category must match (normalized)
 * 2. Then one of:
 *    - Names are strongly similar (exact or substring match)
 *    - Names are moderately similar AND colors match (both present)
 *    - Names are moderately similar AND brands match (both present)
 * 
 * @param existing - Item already in wardrobe
 * @param candidate - New item being checked
 * @returns Object with isDuplicate flag and reason string
 */
export function isLikelyDuplicateWardrobeItem(
  existing: WardrobeItemForDedup,
  candidate: WardrobeItemForDedup
): DuplicateCheckResult {
  // Category must match
  const existingCategory = normalizeString(existing.category);
  const candidateCategory = normalizeString(candidate.category);
  
  if (!existingCategory || !candidateCategory) {
    return { isDuplicate: false };
  }
  
  if (existingCategory !== candidateCategory) {
    return { isDuplicate: false };
  }
  
  const existingName = existing.name || '';
  const candidateName = candidate.name || '';
  
  // Check strong name similarity first
  if (areNamesStronglySimilar(existingName, candidateName)) {
    return {
      isDuplicate: true,
      reason: 'dup[name-exact]'
    };
  }
  
  // Check moderate name similarity with color match
  if (areNamesModeratelySimilar(existingName, candidateName)) {
    if (doColorsMatch(existing, candidate)) {
      return {
        isDuplicate: true,
        reason: 'dup[name+color]'
      };
    }
    
    if (doBrandsMatch(existing, candidate)) {
      return {
        isDuplicate: true,
        reason: 'dup[name+brand]'
      };
    }
  }
  
  return { isDuplicate: false };
}

/**
 * Filter out duplicate items from a list based on existing wardrobe items
 * 
 * @param candidates - New items to check
 * @param existingItems - Items already in wardrobe
 * @returns Object with unique items and skipped items with reasons
 */
export function filterDuplicateWardrobeItems(
  candidates: WardrobeItemForDedup[],
  existingItems: WardrobeItemForDedup[]
): {
  uniqueItems: WardrobeItemForDedup[];
  skippedItems: Array<{ item: WardrobeItemForDedup; reason: string }>;
} {
  const uniqueItems: WardrobeItemForDedup[] = [];
  const skippedItems: Array<{ item: WardrobeItemForDedup; reason: string }> = [];
  
  for (const candidate of candidates) {
    let foundDuplicate = false;
    
    for (const existing of existingItems) {
      const result = isLikelyDuplicateWardrobeItem(existing, candidate);
      if (result.isDuplicate) {
        skippedItems.push({
          item: candidate,
          reason: result.reason || 'duplicate'
        });
        foundDuplicate = true;
        break;
      }
    }
    
    if (!foundDuplicate) {
      uniqueItems.push(candidate);
    }
  }
  
  return { uniqueItems, skippedItems };
}
