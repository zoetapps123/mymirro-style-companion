/**
 * Wardrobe Item Deduplication - 12-Field Visual Signature System
 * Uses 12 visual fields for accurate duplicate detection
 */

// ============================================
// WARDROBE ITEM INTERFACE (12-FIELD SYSTEM)
// ============================================

interface WardrobeItemForDedup {
  category?: string | null;
  item_type?: string | null;
  primary_color_hex?: string | null;
  secondary_palette?: string[] | null;
  pattern_type?: string | null;
  pattern_geometry?: string | null;
  fit_silhouette?: string | null;
  length?: string | null;
  fabric_family?: string | null;
  fabric_behavior?: string | null;
  graphic_summary?: string | null;
  sleeve_neck_summary?: string | null;
}

// ============================================
// COLOR UTILITIES
// ============================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function calculateColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 999;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
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
// 12-FIELD DEDUPLICATION LOGIC
// ============================================

/**
 * Check if two items are duplicates based on 12-field visual signature
 * 
 * Logic:
 * 1. Category must match (exact)
 * 2. Then 5+ of the following must match:
 *    - item_type
 *    - primary_color_hex (with tolerance)
 *    - secondary_palette (overlap check)
 *    - pattern_type
 *    - pattern_geometry
 *    - fit_silhouette
 *    - length
 *    - fabric_family
 *    - fabric_behavior
 *    - graphic_summary
 *    - sleeve_neck_summary
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
  
  // Step 2: Count matching fields (need 5+ matches)
  let matchCount = 0;
  const matches: string[] = [];
  
  // Check item_type
  if (existing.item_type && candidate.item_type) {
    if (normalizeString(existing.item_type) === normalizeString(candidate.item_type)) {
      matchCount++;
      matches.push('item_type');
    }
  }
  
  // Check primary_color_hex (with color distance tolerance)
  if (existing.primary_color_hex && candidate.primary_color_hex) {
    const colorDist = calculateColorDistance(existing.primary_color_hex, candidate.primary_color_hex);
    if (colorDist < 30) { // Tolerance of 30 RGB units
      matchCount++;
      matches.push('color');
    }
  }
  
  // Check secondary_palette (overlap check)
  const existingPalette = existing.secondary_palette || [];
  const candidatePalette = candidate.secondary_palette || [];
  if (existingPalette.length > 0 && candidatePalette.length > 0) {
    const hasOverlap = existingPalette.some(c1 => 
      candidatePalette.some(c2 => calculateColorDistance(c1, c2) < 30)
    );
    if (hasOverlap) {
      matchCount++;
      matches.push('palette');
    }
  }
  
  // Check pattern_type
  if (existing.pattern_type && candidate.pattern_type) {
    if (normalizeString(existing.pattern_type) === normalizeString(candidate.pattern_type)) {
      matchCount++;
      matches.push('pattern_type');
    }
  }
  
  // Check pattern_geometry
  if (existing.pattern_geometry && candidate.pattern_geometry) {
    if (normalizeString(existing.pattern_geometry) === normalizeString(candidate.pattern_geometry)) {
      matchCount++;
      matches.push('pattern_geometry');
    }
  }
  
  // Check fit_silhouette
  if (existing.fit_silhouette && candidate.fit_silhouette) {
    if (normalizeString(existing.fit_silhouette) === normalizeString(candidate.fit_silhouette)) {
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
  
  // Check fabric_family
  if (existing.fabric_family && candidate.fabric_family) {
    if (normalizeString(existing.fabric_family) === normalizeString(candidate.fabric_family)) {
      matchCount++;
      matches.push('fabric_family');
    }
  }
  
  // Check fabric_behavior
  if (existing.fabric_behavior && candidate.fabric_behavior) {
    if (normalizeString(existing.fabric_behavior) === normalizeString(candidate.fabric_behavior)) {
      matchCount++;
      matches.push('fabric_behavior');
    }
  }
  
  // Check graphic_summary
  if (existing.graphic_summary && candidate.graphic_summary) {
    if (normalizeString(existing.graphic_summary) === normalizeString(candidate.graphic_summary)) {
      matchCount++;
      matches.push('graphics');
    }
  }
  
  // Check sleeve_neck_summary
  if (existing.sleeve_neck_summary && candidate.sleeve_neck_summary) {
    if (normalizeString(existing.sleeve_neck_summary) === normalizeString(candidate.sleeve_neck_summary)) {
      matchCount++;
      matches.push('sleeve_neck');
    }
  }
  
  // Duplicate if 5+ fields match
  const isDuplicate = matchCount >= 5;
  
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
 * @deprecated Use WardrobeItemForDedup with 12-field system
 */
interface LegacyWardrobeItem {
  name?: string | null;
  category?: string | null;
  color?: string | null;
  primary_color?: string | null;
  brand?: string | null;
}

/**
 * Legacy deduplication function - deprecated
 * @deprecated Use isLikelyDuplicateWardrobeItem with 12-field system
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
