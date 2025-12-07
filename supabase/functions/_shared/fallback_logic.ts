/**
 * Fallback Logic Engine - Phase 7
 * Handles cases where wardrobe lacks required structures for proper outfit generation.
 * Instead of forcing bad outfits, returns structured fallback responses.
 * 
 * PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - Works only on in-memory data
 * - No Supabase queries, no Gemini calls
 */

import { OutfitBlueprint } from './outfit_blueprints.ts';
import { parseProductTypeFromName, shouldBlockForOccasion } from './product_type_parser.ts';

export interface FallbackResponse {
  outfits: any[];
  requiresExternal: boolean;
  missingCategories: string[];
  suggestedExternal?: string[];
  fallbackReason?: string;
}

export interface WardrobeAnalysis {
  hasTops: boolean;
  hasBottoms: boolean;
  hasShoes: boolean;
  hasOuterwear: boolean;
  hasDresses: boolean;
  hasEthnic: boolean;
  hasAccessories: boolean;
  hasFormalbottomwear: boolean;
  hasEthnicBottomwear: boolean;
  hasFormalShoes: boolean;
  hasEthnicShoes: boolean;
  viableTopCount: number;
  viableBottomCount: number;
  viableShoeCount: number;
}

// ============================================
// SILHOUETTE CONFLICT RULES
// ============================================

export interface SilhouetteConflict {
  topType: string;
  bottomType: string;
  reason: string;
  penalty: number;
}

/**
 * Silhouette conflicts that should NEVER be paired
 * Returns -100 penalty (effectively blocking the combination)
 */
export const FORBIDDEN_SILHOUETTE_PAIRS: SilhouetteConflict[] = [
  // Long tops with wrong bottoms
  { topType: 'kurta', bottomType: 'cargo', reason: 'Kurta cannot pair with cargo pants', penalty: -100 },
  { topType: 'kurta', bottomType: 'shorts', reason: 'Kurta cannot pair with shorts', penalty: -100 },
  { topType: 'kurta', bottomType: 'joggers', reason: 'Kurta cannot pair with joggers', penalty: -100 },
  { topType: 'longline_top', bottomType: 'cargo', reason: 'Longline top cannot pair with cargo pants', penalty: -100 },
  { topType: 'longline_top', bottomType: 'shorts', reason: 'Longline top cannot pair with shorts', penalty: -100 },
  { topType: 'ethnic_top', bottomType: 'cargo', reason: 'Ethnic top cannot pair with cargo pants', penalty: -100 },
  { topType: 'ethnic_top', bottomType: 'joggers', reason: 'Ethnic top cannot pair with joggers', penalty: -100 },
  
  // Heavy ethnic with casual
  { topType: 'sherwani', bottomType: 'jeans', reason: 'Sherwani cannot pair with jeans', penalty: -100 },
  { topType: 'sherwani', bottomType: 'cargo', reason: 'Sherwani cannot pair with cargo pants', penalty: -100 },
  { topType: 'sherwani', bottomType: 'shorts', reason: 'Sherwani cannot pair with shorts', penalty: -100 },
  { topType: 'bandhgala', bottomType: 'jeans', reason: 'Bandhgala cannot pair with jeans', penalty: -100 },
  { topType: 'bandhgala', bottomType: 'cargo', reason: 'Bandhgala cannot pair with cargo pants', penalty: -100 },
  
  // Oversized with oversized (avoid boxy silhouette)
  { topType: 'oversized_top', bottomType: 'baggy_jeans', reason: 'Oversized top + baggy bottom creates poor silhouette', penalty: -50 },
  { topType: 'oversized_tshirt', bottomType: 'wide_leg', reason: 'Oversized tee + wide leg creates unbalanced silhouette', penalty: -30 },
];

/**
 * Silhouette rules for good pairings (positive scores)
 */
export const GOOD_SILHOUETTE_PAIRS = [
  // Long tops with slim bottoms
  { topType: 'kurta', bottomType: 'churidar', reason: 'Classic kurta-churidar pairing', bonus: 5 },
  { topType: 'kurta', bottomType: 'straight_pant', reason: 'Kurta with straight pants works well', bonus: 4 },
  { topType: 'kurta', bottomType: 'formal_trouser', reason: 'Kurta with formal trousers for fusion look', bonus: 3 },
  { topType: 'sherwani', bottomType: 'churidar', reason: 'Traditional sherwani-churidar', bonus: 6 },
  { topType: 'sherwani', bottomType: 'dhoti_pants', reason: 'Modern sherwani with dhoti pants', bonus: 5 },
  
  // Cropped tops with high-rise
  { topType: 'crop_top', bottomType: 'high_rise_jeans', reason: 'Crop top with high-rise jeans', bonus: 4 },
  { topType: 'crop_top', bottomType: 'skirt', reason: 'Crop top with skirt', bonus: 4 },
  { topType: 'crop_top', bottomType: 'palazzo', reason: 'Crop top with palazzo', bonus: 3 },
  
  // Oversized with fitted
  { topType: 'oversized_tshirt', bottomType: 'slim_jeans', reason: 'Balanced oversized top with slim bottom', bonus: 3 },
  { topType: 'oversized_shirt', bottomType: 'chinos', reason: 'Oversized shirt with fitted chinos', bonus: 3 },
];

/**
 * Check if a top-bottom combination has a silhouette conflict
 */
export function checkSilhouetteConflict(
  topName: string,
  bottomName: string
): { hasConflict: boolean; penalty: number; reason?: string } {
  const topLower = (topName || '').toLowerCase();
  const bottomLower = (bottomName || '').toLowerCase();
  
  for (const conflict of FORBIDDEN_SILHOUETTE_PAIRS) {
    const topMatches = topLower.includes(conflict.topType.replace(/_/g, ' ')) || 
                       topLower.includes(conflict.topType);
    const bottomMatches = bottomLower.includes(conflict.bottomType.replace(/_/g, ' ')) || 
                          bottomLower.includes(conflict.bottomType);
    
    if (topMatches && bottomMatches) {
      return {
        hasConflict: true,
        penalty: conflict.penalty,
        reason: conflict.reason
      };
    }
  }
  
  return { hasConflict: false, penalty: 0 };
}

/**
 * Get silhouette bonus for a good pairing
 */
export function getSilhouetteBonus(
  topName: string,
  bottomName: string
): { bonus: number; reason?: string } {
  const topLower = (topName || '').toLowerCase();
  const bottomLower = (bottomName || '').toLowerCase();
  
  for (const pair of GOOD_SILHOUETTE_PAIRS) {
    const topMatches = topLower.includes(pair.topType.replace(/_/g, ' ')) || 
                       topLower.includes(pair.topType);
    const bottomMatches = bottomLower.includes(pair.bottomType.replace(/_/g, ' ')) || 
                          bottomLower.includes(pair.bottomType);
    
    if (topMatches && bottomMatches) {
      return {
        bonus: pair.bonus,
        reason: pair.reason
      };
    }
  }
  
  return { bonus: 0 };
}

/**
 * Analyze wardrobe to determine what categories are available and viable
 */
export function analyzeWardrobe(
  items: any[],
  occasion: string | null
): WardrobeAnalysis {
  const analysis: WardrobeAnalysis = {
    hasTops: false,
    hasBottoms: false,
    hasShoes: false,
    hasOuterwear: false,
    hasDresses: false,
    hasEthnic: false,
    hasAccessories: false,
    hasFormalbottomwear: false,
    hasEthnicBottomwear: false,
    hasFormalShoes: false,
    hasEthnicShoes: false,
    viableTopCount: 0,
    viableBottomCount: 0,
    viableShoeCount: 0
  };
  
  for (const item of items || []) {
    const category = (item.category || '').toLowerCase();
    const itemType = (item.item_type || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const combined = `${category} ${itemType} ${name}`;
    
    // Parse the product type
    const parsed = parseProductTypeFromName(name);
    
    // Check if blocked for occasion
    const blockResult = shouldBlockForOccasion(parsed, occasion || '');
    const isViable = !blockResult.blocked;
    
    // Categorize
    if (combined.includes('top') || combined.includes('shirt') || combined.includes('blouse') || 
        combined.includes('tee') || combined.includes('polo')) {
      analysis.hasTops = true;
      if (isViable) analysis.viableTopCount++;
    }
    
    if (combined.includes('bottom') || combined.includes('pant') || combined.includes('jeans') || 
        combined.includes('trouser') || combined.includes('skirt') || combined.includes('shorts')) {
      analysis.hasBottoms = true;
      if (isViable) analysis.viableBottomCount++;
      
      // Check for formal/ethnic bottomwear
      if (combined.includes('formal') || combined.includes('trouser') || combined.includes('dress pant')) {
        analysis.hasFormalbottomwear = true;
      }
      if (combined.includes('churidar') || combined.includes('palazzo') || combined.includes('dhoti') || 
          combined.includes('salwar')) {
        analysis.hasEthnicBottomwear = true;
      }
    }
    
    if (combined.includes('shoe') || combined.includes('sneaker') || combined.includes('heel') || 
        combined.includes('loafer') || combined.includes('boot') || combined.includes('sandal') ||
        combined.includes('jutti') || combined.includes('mojari') || category.includes('footwear')) {
      analysis.hasShoes = true;
      if (isViable) analysis.viableShoeCount++;
      
      // Check for formal/ethnic shoes
      if (combined.includes('formal') || combined.includes('oxford') || combined.includes('derby') || 
          combined.includes('heel') || combined.includes('pump')) {
        analysis.hasFormalShoes = true;
      }
      if (combined.includes('jutti') || combined.includes('mojari') || combined.includes('kolhapuri')) {
        analysis.hasEthnicShoes = true;
      }
    }
    
    if (combined.includes('jacket') || combined.includes('blazer') || combined.includes('coat') || 
        combined.includes('cardigan') || combined.includes('outerwear')) {
      analysis.hasOuterwear = true;
    }
    
    if (combined.includes('dress') || combined.includes('gown') || combined.includes('jumpsuit')) {
      analysis.hasDresses = true;
    }
    
    if (combined.includes('ethnic') || combined.includes('kurta') || combined.includes('saree') || 
        combined.includes('lehenga') || combined.includes('sherwani')) {
      analysis.hasEthnic = true;
    }
    
    if (combined.includes('accessor') || combined.includes('watch') || combined.includes('bag') || 
        combined.includes('belt') || combined.includes('jewelry')) {
      analysis.hasAccessories = true;
    }
  }
  
  return analysis;
}

/**
 * Determine if we should return a fallback response instead of forcing bad outfits
 */
export function shouldReturnFallback(
  analysis: WardrobeAnalysis,
  blueprint: OutfitBlueprint | null,
  occasion: string | null
): FallbackResponse | null {
  const missingCategories: string[] = [];
  const suggestedExternal: string[] = [];
  const occasionLower = (occasion || '').toLowerCase();
  
  // Check for minimum viable wardrobe
  const hasMinimumViable = analysis.viableTopCount >= 1 && 
                           analysis.viableBottomCount >= 1 && 
                           analysis.viableShoeCount >= 1;
  
  if (!hasMinimumViable) {
    // Determine what's missing
    if (analysis.viableTopCount === 0) {
      missingCategories.push('tops');
      suggestedExternal.push('casual_top', 'nice_shirt');
    }
    if (analysis.viableBottomCount === 0) {
      missingCategories.push('bottomwear');
      suggestedExternal.push('formal_trouser', 'jeans', 'chinos');
    }
    if (analysis.viableShoeCount === 0) {
      missingCategories.push('footwear');
      suggestedExternal.push('loafers', 'clean_sneakers');
    }
    
    return {
      outfits: [],
      requiresExternal: true,
      missingCategories,
      suggestedExternal,
      fallbackReason: `Wardrobe lacks viable items for ${occasion || 'this occasion'}. Missing: ${missingCategories.join(', ')}`
    };
  }
  
  // Wedding-specific checks
  if (occasionLower.includes('wedding') || occasionLower.includes('sangeet')) {
    // Wedding requires either ethnic or formal options
    if (!analysis.hasEthnic && !analysis.hasFormalbottomwear && !analysis.hasDresses) {
      missingCategories.push('ethnic_wear');
      suggestedExternal.push('kurta_set', 'sherwani', 'saree', 'lehenga', 'formal_suit');
      
      // Don't block completely if there are some formal pieces
      if (!analysis.hasFormalShoes && !analysis.hasEthnicShoes) {
        missingCategories.push('formal_footwear');
        suggestedExternal.push('formal_shoes', 'heels', 'juttis', 'mojari');
      }
      
      // If only casual items exist, return fallback
      if (missingCategories.length >= 2) {
        return {
          outfits: [],
          requiresExternal: true,
          missingCategories,
          suggestedExternal,
          fallbackReason: 'Wedding requires ethnic or formal attire. Current wardrobe lacks appropriate options.'
        };
      }
    }
  }
  
  // Interview-specific checks
  if (occasionLower.includes('interview')) {
    if (!analysis.hasFormalbottomwear) {
      missingCategories.push('formal_bottomwear');
      suggestedExternal.push('formal_trouser', 'dress_pants');
    }
    if (!analysis.hasFormalShoes) {
      missingCategories.push('formal_footwear');
      suggestedExternal.push('oxford', 'derby', 'loafers', 'pumps');
    }
    
    if (missingCategories.length >= 2) {
      return {
        outfits: [],
        requiresExternal: true,
        missingCategories,
        suggestedExternal,
        fallbackReason: 'Interview requires formal attire. Consider adding formal trousers and dress shoes.'
      };
    }
  }
  
  // No fallback needed
  return null;
}

/**
 * Generate a structured fallback response
 */
export function generateFallbackResponse(
  reason: string,
  missingCategories: string[],
  suggestedExternal?: string[]
): FallbackResponse {
  return {
    outfits: [],
    requiresExternal: true,
    missingCategories,
    suggestedExternal,
    fallbackReason: reason
  };
}
