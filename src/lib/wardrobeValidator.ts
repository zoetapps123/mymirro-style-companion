// Wardrobe Validation Utility
// Checks if user has sufficient wardrobe items for outfit generation

interface WardrobeItem {
  id: string;
  category: string;
  suitable_occasions?: string[];
  style_aesthetic?: string[];
}

interface ValidationResult {
  ok: boolean;
  missingCategories: string[];
  reason: string;
}

const CORE_CATEGORIES = {
  tops: ['Tops', 'Top'],
  bottoms: ['Bottoms', 'Bottom'],
  shoes: ['Shoes', 'Footwear'],
};

const OCCASION_REQUIREMENTS: Record<string, string[]> = {
  beach: ['shorts', 'sandals', 'swimwear'],
  formal: ['blazer', 'dress shoes', 'formal'],
  gym: ['activewear', 'sneakers'],
  party: ['dress', 'heels'],
};

export function validateWardrobe(
  items: WardrobeItem[],
  occasion?: string,
  style?: string
): ValidationResult {
  if (!items || items.length === 0) {
    return {
      ok: false,
      missingCategories: ['tops', 'bottoms', 'shoes'],
      reason: 'Your wardrobe is empty. Upload at least 1 top, 1 bottom, and 1 pair of shoes to get outfit suggestions.',
    };
  }

  // Check core categories
  const missingCore: string[] = [];
  
  const hasTop = items.some(item => 
    CORE_CATEGORIES.tops.some(cat => item.category.toLowerCase().includes(cat.toLowerCase()))
  );
  if (!hasTop) missingCore.push('tops');

  const hasBottom = items.some(item =>
    CORE_CATEGORIES.bottoms.some(cat => item.category.toLowerCase().includes(cat.toLowerCase()))
  );
  if (!hasBottom) missingCore.push('bottoms');

  const hasShoes = items.some(item =>
    CORE_CATEGORIES.shoes.some(cat => item.category.toLowerCase().includes(cat.toLowerCase()))
  );
  if (!hasShoes) missingCore.push('shoes');

  if (missingCore.length > 0) {
    return {
      ok: false,
      missingCategories: missingCore,
      reason: `To create complete outfits, you need at least 1 ${missingCore.join(', 1 ')}. Upload these items to get started!`,
    };
  }

  // Check occasion-specific requirements (optional, lenient)
  if (occasion) {
    const occasionLower = occasion.toLowerCase();
    const requiredItems = OCCASION_REQUIREMENTS[occasionLower];
    
    if (requiredItems) {
      const missingOccasion = requiredItems.filter(req => 
        !items.some(item => 
          item.category.toLowerCase().includes(req) ||
          item.suitable_occasions?.some(occ => occ.toLowerCase().includes(req)) ||
          item.style_aesthetic?.some(style => style.toLowerCase().includes(req))
        )
      );

      // Only fail if ALL occasion items are missing (lenient approach)
      if (missingOccasion.length === requiredItems.length) {
        return {
          ok: false,
          missingCategories: missingOccasion,
          reason: `For ${occasion} occasions, it's recommended to have ${missingOccasion.join(' or ')}. Upload some items to get better suggestions!`,
        };
      }
    }
  }

  // Minimum viable wardrobe: at least 3 items total
  if (items.length < 3) {
    return {
      ok: false,
      missingCategories: [],
      reason: `Your wardrobe has only ${items.length} item${items.length === 1 ? '' : 's'}. Upload a few more items to create diverse outfits!`,
    };
  }

  return {
    ok: true,
    missingCategories: [],
    reason: 'Wardrobe is sufficient for outfit generation',
  };
}

// Export for edge functions (simpler validation)
export function validateWardrobeSimple(items: any[]): boolean {
  if (!items || items.length < 3) return false;

  const categories = items.map(item => item.category?.toLowerCase() || '');
  const hasTop = categories.some(cat => cat.includes('top'));
  const hasBottom = categories.some(cat => cat.includes('bottom'));
  const hasShoes = categories.some(cat => cat.includes('shoe') || cat.includes('footwear'));

  return hasTop && hasBottom && hasShoes;
}
