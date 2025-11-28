/**
 * Wardrobe Item Deduplication - Simplified 15-Field System
 * Uses core styling fields for accurate duplicate detection
 */

// ============================================
// WARDROBE ITEM INTERFACE (15-FIELD SYSTEM)
// ============================================

export interface WardrobeItemForDedup {
  category?: string | null;
  item_type?: string | null;
  color?: string | null;
  pattern_type?: string | null;
  pattern_description?: string | null;
  fabric_primary?: string | null;
  texture?: string | null;
  fit_type?: string | null;
  length?: string | null;
  formality_level?: string | null;
  suitable_occasions?: string[] | null;
  style_aesthetic?: string[] | null;
  season?: string[] | null;
  weather_suitability?: string | null;
  style_notes_detailed?: string | null;
}

// ============================================
// STRING NORMALIZATION
// ============================================

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================
// DUPLICATE CHECK RESULT
// ============================================

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchCount?: number;
}

// ============================================
// 15-FIELD DEDUPLICATION LOGIC
// ============================================

/**
 * Check if two items are duplicates based on 15-field styling signature
 * 
 * Logic:
 * 1. Category must match (exact)
 * 2. Then 4+ of the following must match:
 *    - item_type
 *    - color
 *    - pattern_type
 *    - fabric_primary
 *    - fit_type
 *    - length
 *    - texture
 * 
 * @param existing - Item already in wardrobe
 * @param candidate - New item being checked
 * @returns Object with isDuplicate flag, reason, and match count
 */
export function isLikelyDuplicateWardrobeItem(
  existing: WardrobeItemForDedup,
  candidate: WardrobeItemForDedup
): DuplicateCheckResult {
  // Step 1: Category must match
  const existingCategory = normalizeString(existing.category);
  const candidateCategory = normalizeString(candidate.category);
  
  if (!existingCategory || !candidateCategory) {
    return { isDuplicate: false, matchCount: 0 };
  }
  
  if (existingCategory !== candidateCategory) {
    return { isDuplicate: false, matchCount: 0 };
  }
  
  // Step 2: Count matching fields (need 4+ matches)
  let matchCount = 0;
  const matches: string[] = [];
  
  // Check item_type
  if (existing.item_type && candidate.item_type) {
    if (normalizeString(existing.item_type) === normalizeString(candidate.item_type)) {
      matchCount++;
      matches.push('item_type');
    }
  }
  
  // Check color
  if (existing.color && candidate.color) {
    if (normalizeString(existing.color) === normalizeString(candidate.color)) {
      matchCount++;
      matches.push('color');
    }
  }
  
  // Check pattern_type
  if (existing.pattern_type && candidate.pattern_type) {
    if (normalizeString(existing.pattern_type) === normalizeString(candidate.pattern_type)) {
      matchCount++;
      matches.push('pattern');
    }
  }
  
  // Check fabric_primary
  if (existing.fabric_primary && candidate.fabric_primary) {
    if (normalizeString(existing.fabric_primary) === normalizeString(candidate.fabric_primary)) {
      matchCount++;
      matches.push('fabric');
    }
  }
  
  // Check fit_type
  if (existing.fit_type && candidate.fit_type) {
    if (normalizeString(existing.fit_type) === normalizeString(candidate.fit_type)) {
      matchCount++;
      matches.push('fit');
    }
  }
  
  // Check length
  if (existing.length && candidate.length) {
    if (normalizeString(existing.length) === normalizeString(candidate.length)) {
      matchCount++;
      matches.push('length');
    }
  }
  
  // Check texture
  if (existing.texture && candidate.texture) {
    if (normalizeString(existing.texture) === normalizeString(candidate.texture)) {
      matchCount++;
      matches.push('texture');
    }
  }
  
  // Duplicate if 4+ fields match
  const isDuplicate = matchCount >= 4;
  
  return {
    isDuplicate,
    matchCount,
    reason: isDuplicate ? `dup[${matches.join('+')}]` : undefined
  };
}

// ============================================
// BATCH FILTERING
// ============================================

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
  skippedItems: Array<{ item: WardrobeItemForDedup; reason: string; matchCount: number }>;
} {
  const uniqueItems: WardrobeItemForDedup[] = [];
  const skippedItems: Array<{ item: WardrobeItemForDedup; reason: string; matchCount: number }> = [];
  
  for (const candidate of candidates) {
    let foundDuplicate = false;
    
    for (const existing of existingItems) {
      const result = isLikelyDuplicateWardrobeItem(existing, candidate);
      if (result.isDuplicate) {
        skippedItems.push({
          item: candidate,
          reason: result.reason || 'duplicate',
          matchCount: result.matchCount || 0
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

// ============================================
// LEGACY SUPPORT (BACKWARD COMPATIBILITY)
// ============================================

/**
 * Legacy interface for backward compatibility
 * @deprecated Use WardrobeItemForDedup with 15-field system
 */
interface LegacyWardrobeItem {
  name?: string | null;
  category?: string | null;
  color?: string | null;
}

/**
 * Legacy deduplication function - deprecated
 * @deprecated Use isLikelyDuplicateWardrobeItem with 15-field system
 */
export function isLikelyDuplicateLegacy(
  existing: LegacyWardrobeItem,
  candidate: LegacyWardrobeItem
): DuplicateCheckResult {
  // Simple category + name matching for legacy support
  const existingCategory = normalizeString(existing.category);
  const candidateCategory = normalizeString(candidate.category);
  
  if (!existingCategory || !candidateCategory || existingCategory !== candidateCategory) {
    return { isDuplicate: false, matchCount: 0 };
  }
  
  const existingName = normalizeString(existing.name);
  const candidateName = normalizeString(candidate.name);
  
  if (existingName && candidateName && existingName === candidateName) {
    return { isDuplicate: true, reason: 'dup[name-exact]', matchCount: 2 };
  }
  
  return { isDuplicate: false, matchCount: 1 };
}
