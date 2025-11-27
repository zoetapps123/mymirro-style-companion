/**
 * Centralized wardrobe item deduplication logic
 * Updated for 12-field visual metadata system
 */

export interface WardrobeItemForDedup {
  name?: string | null;
  category?: string | null;
  
  // New 12-field system
  item_type?: string | null;
  primary_color_hex?: string | null;
  secondary_palette?: string[] | null;
  pattern_type?: string | null;
  pattern_geometry?: string | null;
  fit_silhouette?: string | null;
  length?: string | null;
  fabric_family?: string | null;
  fabric_behavior?: string | null;
  
  // Legacy fields for backward compatibility
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
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Calculate color distance between two hex colors
 */
function calculateColorDistance(hex1: string, hex2: string): number {
  if (!hex1 || !hex2) return 999;
  
  // Remove # prefix if present
  const h1 = hex1.replace('#', '');
  const h2 = hex2.replace('#', '');
  
  const r1 = parseInt(h1.slice(0, 2), 16);
  const g1 = parseInt(h1.slice(2, 4), 16);
  const b1 = parseInt(h1.slice(4, 6), 16);
  
  const r2 = parseInt(h2.slice(0, 2), 16);
  const g2 = parseInt(h2.slice(2, 4), 16);
  const b2 = parseInt(h2.slice(4, 6), 16);
  
  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Check if two colors match using hex comparison
 */
function doColorsMatch(item1: WardrobeItemForDedup, item2: WardrobeItemForDedup): boolean {
  const hex1 = item1.primary_color_hex;
  const hex2 = item2.primary_color_hex;
  
  if (!hex1 || !hex2) {
    // Fallback to legacy color matching
    const color1 = normalizeString(item1.primary_color || item1.color);
    const color2 = normalizeString(item2.primary_color || item2.color);
    if (!color1 || !color2) return false;
    return color1 === color2;
  }
  
  return calculateColorDistance(hex1, hex2) < 30; // Within 30 RGB distance
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
}

/**
 * Determine if a candidate item is likely a duplicate using 12-field system
 */
export function isLikelyDuplicateWardrobeItem(
  existing: WardrobeItemForDedup,
  candidate: WardrobeItemForDedup
): DuplicateCheckResult {
  // Must be same category
  const existingCategory = normalizeString(existing.category);
  const candidateCategory = normalizeString(candidate.category);
  
  if (!existingCategory || !candidateCategory) {
    return { isDuplicate: false };
  }
  
  if (existingCategory !== candidateCategory) {
    return { isDuplicate: false };
  }
  
  // Count matching fields from 12-field system
  const matchingFields = [
    existing.item_type && candidate.item_type && 
      normalizeString(existing.item_type) === normalizeString(candidate.item_type),
    
    existing.fit_silhouette && candidate.fit_silhouette &&
      normalizeString(existing.fit_silhouette) === normalizeString(candidate.fit_silhouette),
    
    existing.length && candidate.length &&
      normalizeString(existing.length) === normalizeString(candidate.length),
    
    existing.pattern_type && candidate.pattern_type &&
      normalizeString(existing.pattern_type) === normalizeString(candidate.pattern_type),
    
    existing.pattern_geometry && candidate.pattern_geometry &&
      normalizeString(existing.pattern_geometry) === normalizeString(candidate.pattern_geometry),
    
    existing.fabric_family && candidate.fabric_family &&
      normalizeString(existing.fabric_family) === normalizeString(candidate.fabric_family),
    
    existing.fabric_behavior && candidate.fabric_behavior &&
      normalizeString(existing.fabric_behavior) === normalizeString(candidate.fabric_behavior),
    
    doColorsMatch(existing, candidate)
  ].filter(Boolean);
  
  // Need at least 5 matching fields to consider duplicate
  if (matchingFields.length >= 5) {
    return {
      isDuplicate: true,
      reason: `Similar ${existing.category} with ${matchingFields.length}/8 matching attributes`
    };
  }
  
  // Fallback to legacy name matching if insufficient new field data
  if (!existing.item_type && !candidate.item_type) {
    const name1 = normalizeString(existing.name || '');
    const name2 = normalizeString(candidate.name || '');
    
    if (name1 && name2 && (name1 === name2 || name1.includes(name2) || name2.includes(name1))) {
      if (doColorsMatch(existing, candidate)) {
        return {
          isDuplicate: true,
          reason: `Similar name and color in ${existing.category}`
        };
      }
    }
  }
  
  return { isDuplicate: false };
}

/**
 * Filter out duplicate items from a list based on existing wardrobe items
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
