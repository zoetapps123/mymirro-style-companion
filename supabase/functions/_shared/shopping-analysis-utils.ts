import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BrandRecommendation, generateBrandRecommendations } from './brand-recommendation-utils.ts';

export interface WardrobeGap {
  gap_type: 'category' | 'formality' | 'occasion' | 'color' | 'season';
  gap_description: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ShoppingRecommendation {
  item_type: string;
  description: string;
  priority: 'essential' | 'nice_to_have' | 'experimental';
  occasion_fit: string[];
  budget_estimate: string;
  brand_suggestions: BrandRecommendation[];
  styling_opinion: string;
}

export interface ShoppingAnalysis {
  wardrobe_gaps: WardrobeGap[];
  recommendations: ShoppingRecommendation[];
  budget_awareness: {
    suggested_tier: string;
    reasoning: string;
  };
  immediate_needs: string[];
  long_term_needs: string[];
}

// Budget tier mapping based on Indian market
const BUDGET_TIERS = {
  student_safe: { min: 0, max: 2000, label: 'Student Safe (₹500-2000)' },
  mid_range: { min: 2000, max: 5000, label: 'Mid Range (₹2000-5000)' },
  premium_non_luxury: { min: 5000, max: 15000, label: 'Premium (₹5000-15000)' },
};

// Brand database (subset from BRAND_RECOMMENDER_PROMPT)
const BRAND_DATABASE = {
  student_safe: {
    streetwear: ['Bewakoof', 'The Souled Store', 'Campus Sutra', 'Snitch'],
    minimal: ['H&M Basics', 'Uniqlo Basics', 'Decathlon', 'Westside'],
    ethnic: ['FabIndia (basics)', 'Biba', 'Global Desi'],
    footwear: ['Nike (sale)', 'Adidas (sale)', 'Puma', 'Red Tape', 'Woodland'],
  },
  mid_range: {
    streetwear: ['Being Human', 'Alcis', 'Only & Sons', 'Jack & Jones'],
    minimal: ['Marks & Spencer', 'Zara', 'United Colors of Benetton', 'Allen Solly'],
    ethnic: ['Manyavar', 'Peter England', 'W for Woman'],
    footwear: ['Clarks', 'Nike (full price)', 'Adidas Originals', 'Skechers'],
  },
  premium_non_luxury: {
    streetwear: ['Tommy Hilfiger', 'US Polo', 'Superdry', 'Levis Premium'],
    minimal: ['Massimo Dutti', 'COS', 'Reiss', 'Ted Baker'],
    ethnic: ['Fabindia Premium', 'Good Earth', 'Anita Dongre (Grassroot)'],
    footwear: ['Cole Haan', 'Clarks Premium', 'Timberland', 'Hush Puppies'],
  },
};

export async function analyzeWardrobeGaps(
  supabase: SupabaseClient,
  userId: string
): Promise<WardrobeGap[]> {
  const { data: items, error } = await supabase
    .from('wardrobe_items')
    .select('category, formality_level, suitable_occasions, season, color_family')
    .eq('user_id', userId);

  if (error || !items) {
    console.error('Error fetching wardrobe items:', error);
    return [];
  }

  const gaps: WardrobeGap[] = [];

  // Category gaps
  const categories = new Set(items.map(i => i.category));
  const essentialCategories = ['Tops', 'Bottoms', 'Shoes', 'Outerwear'];
  
  essentialCategories.forEach(cat => {
    if (!categories.has(cat)) {
      gaps.push({
        gap_type: 'category',
        gap_description: `Missing ${cat} - essential wardrobe category`,
        priority: 'high',
        reasoning: `Every wardrobe needs at least 2-3 ${cat.toLowerCase()} items for basic outfit creation.`
      });
    }
  });

  // Formality gaps
  const formalityLevels = new Set(items.map(i => i.formality_level).filter(Boolean));
  if (!formalityLevels.has('formal') && items.length > 5) {
    gaps.push({
      gap_type: 'formality',
      gap_description: 'No formal wear detected',
      priority: 'medium',
      reasoning: 'Missing formal options for professional settings, interviews, or formal events.'
    });
  }

  // Occasion gaps
  const occasions = new Set(items.flatMap(i => i.suitable_occasions || []));
  if (!occasions.has('Party') && items.length > 8) {
    gaps.push({
      gap_type: 'occasion',
      gap_description: 'No party/evening wear detected',
      priority: 'low',
      reasoning: 'Consider adding statement pieces for social events and parties.'
    });
  }

  // Color diversity
  const colors = new Set(items.map(i => i.color_family).filter(Boolean));
  if (colors.size < 3 && items.length > 5) {
    gaps.push({
      gap_type: 'color',
      gap_description: 'Limited color palette',
      priority: 'medium',
      reasoning: 'Adding more color variety would increase outfit combinations and versatility.'
    });
  }

  // Season gaps
  const seasons = new Set(items.flatMap(i => i.season || []));
  if (!seasons.has('Winter') && items.length > 6) {
    gaps.push({
      gap_type: 'season',
      gap_description: 'Limited winter/layering pieces',
      priority: 'medium',
      reasoning: 'Winter basics like sweaters or jackets would make wardrobe more season-appropriate.'
    });
  }

  return gaps;
}

export function inferBudgetTier(
  wardrobeSize: number,
  styleAesthetics: string[]
): 'student_safe' | 'mid_range' | 'premium_non_luxury' {
  // If wardrobe is small, recommend student safe
  if (wardrobeSize < 10) return 'student_safe';
  
  // If style aesthetics include premium indicators
  const premiumStyles = ['quiet luxury', 'minimalist', 'elevated casual'];
  const hasPremiumStyle = styleAesthetics.some(s => 
    premiumStyles.some(p => s.toLowerCase().includes(p))
  );
  
  if (hasPremiumStyle && wardrobeSize > 20) return 'premium_non_luxury';
  
  // Default to mid-range for most users
  return 'mid_range';
}

export function filterBrandsByStyleAndBudget(
  budgetTier: 'student_safe' | 'mid_range' | 'premium_non_luxury',
  styleAesthetics: string[],
  itemCategory: string
): BrandRecommendation[] {
  const recommendations: BrandRecommendation[] = [];
  
  // Determine style category
  let styleCategory: 'streetwear' | 'minimal' | 'ethnic' | 'footwear' = 'minimal'; // default
  
  const streetwearKeywords = ['street', 'urban', 'oversized', 'graphic'];
  const minimalKeywords = ['minimal', 'clean', 'quiet luxury', 'elevated'];
  const ethnicKeywords = ['ethnic', 'traditional', 'desi'];
  
  if (styleAesthetics.some(s => streetwearKeywords.some(k => s.toLowerCase().includes(k)))) {
    styleCategory = 'streetwear';
  } else if (styleAesthetics.some(s => ethnicKeywords.some(k => s.toLowerCase().includes(k)))) {
    styleCategory = 'ethnic';
  } else if (styleAesthetics.some(s => minimalKeywords.some(k => s.toLowerCase().includes(k)))) {
    styleCategory = 'minimal';
  }
  
  // Special handling for footwear
  const brandCategory: 'streetwear' | 'minimal' | 'ethnic' | 'footwear' = 
    itemCategory === 'Shoes' ? 'footwear' : styleCategory;
  
  const brandsForTier = BRAND_DATABASE[budgetTier][brandCategory] || [];
  
  brandsForTier.forEach((brand: string) => {
    recommendations.push({
      brand_name: brand,
      category: itemCategory,
      budget_tier: budgetTier,
      style_match: styleAesthetics,
      reasoning: `${brand} aligns with your ${styleCategory} aesthetic and ${budgetTier.replace('_', ' ')} budget.`,
      confidence: 0.7,
      where_to_buy: 'Available at major retailers and online'
    });
  });
  
  return recommendations.slice(0, 3); // Top 3 brands
}

export async function generateShoppingRecommendations(
  supabase: SupabaseClient,
  userId: string,
  wardrobeGaps: WardrobeGap[],
  tasteProfile: any,
  occasion?: string
): Promise<ShoppingRecommendation[]> {
  const recommendations: ShoppingRecommendation[] = [];
  
  const budgetTier = inferBudgetTier(
    tasteProfile.wardrobe_size || 0,
    tasteProfile.style_aesthetic || []
  );
  
  // Generate recommendations for each high-priority gap
  const highPriorityGaps = wardrobeGaps.filter(g => g.priority === 'high');
  
  for (const gap of highPriorityGaps) {
    if (gap.gap_type === 'category') {
      const category = gap.gap_description.match(/Missing (\w+)/)?.[1] || 'Tops';
      
      const brandSuggestions = filterBrandsByStyleAndBudget(
        budgetTier,
        tasteProfile.styleAesthetics || [],
        category
      );
      
      recommendations.push({
        item_type: category,
        description: getItemDescription(category, tasteProfile.styleAesthetics),
        priority: 'essential',
        occasion_fit: getOccasionFit(category),
        budget_estimate: BUDGET_TIERS[budgetTier].label,
        brand_suggestions: brandSuggestions,
        styling_opinion: getStylingOpinion(category, tasteProfile)
      });
    }
  }
  
  // Add occasion-specific recommendations if provided
  if (occasion) {
    const occasionRec = await getOccasionSpecificRecommendation(
      occasion,
      tasteProfile,
      budgetTier
    );
    if (occasionRec) {
      recommendations.push(occasionRec);
    }
  }
  
  return recommendations;
}

function getItemDescription(category: string, styleAesthetics: string[]): string {
  const isMinimal = styleAesthetics.some(s => s.toLowerCase().includes('minimal'));
  const isStreet = styleAesthetics.some(s => s.toLowerCase().includes('street'));
  
  const descriptions: { [key: string]: string } = {
    Tops: isMinimal ? 'Clean, well-fitted basic tees or shirts in neutral colors' 
          : isStreet ? 'Graphic tees or oversized shirts for layering'
          : 'Versatile shirts that work for multiple occasions',
    Bottoms: isMinimal ? 'Tailored trousers or slim-fit jeans in classic colors'
           : isStreet ? 'Relaxed-fit cargo pants or wide-leg jeans'
           : 'Comfortable, well-fitted bottoms for daily wear',
    Shoes: isMinimal ? 'Clean white sneakers or minimalist leather shoes'
          : isStreet ? 'Chunky sneakers or high-tops'
          : 'Versatile everyday footwear',
    Outerwear: isMinimal ? 'Structured blazer or clean bomber jacket'
              : isStreet ? 'Oversized hoodie or denim jacket'
              : 'Layer pieces for weather transitions'
  };
  
  return descriptions[category] || `Essential ${category.toLowerCase()} items`;
}

function getOccasionFit(category: string): string[] {
  const occasionMap: { [key: string]: string[] } = {
    Tops: ['Casual', 'College', 'Office Casual'],
    Bottoms: ['Casual', 'College', 'Office Casual'],
    Shoes: ['Casual', 'College', 'Date'],
    Outerwear: ['Casual', 'College', 'Evening Out']
  };
  
  return occasionMap[category] || ['Casual'];
}

function getStylingOpinion(category: string, tasteProfile: any): string {
  const opinions: { [key: string]: string } = {
    Tops: 'This is the foundation of your wardrobe. Invest in quality basics that you can style multiple ways.',
    Bottoms: 'Get the fit right first. A well-fitted bottom makes any outfit look 10x better.',
    Shoes: 'This will be your most-worn item. Go for comfort AND style - do not compromise.',
    Outerwear: 'Layering pieces instantly elevate any outfit. Start with one versatile piece.'
  };
  
  return opinions[category] || 'This will add versatility to your wardrobe.';
}

async function getOccasionSpecificRecommendation(
  occasion: string,
  tasteProfile: any,
  budgetTier: 'student_safe' | 'mid_range' | 'premium_non_luxury'
): Promise<ShoppingRecommendation | null> {
  const occasionLower = occasion.toLowerCase();
  
  if (occasionLower.includes('date') || occasionLower.includes('dinner')) {
    const brandSuggestions = await generateBrandRecommendations({
      wardrobeGaps: [],
      styleAesthetics: tasteProfile.style_aesthetic || [],
      budgetTier: budgetTier,
      occasion: 'date',
      specificRequest: 'Statement pieces for romantic settings'
    });
    
    return {
      item_type: 'Outfit Piece',
      description: 'Statement top or well-fitted shirt for romantic settings',
      priority: 'nice_to_have',
      occasion_fit: ['Date', 'Dinner', 'Evening Out'],
      budget_estimate: BUDGET_TIERS[budgetTier].label,
      brand_suggestions: brandSuggestions,
      styling_opinion: 'For dates, focus on pieces that make YOU feel confident. That energy matters more than the outfit.'
    };
  }
  
  if (occasionLower.includes('interview') || occasionLower.includes('formal')) {
    const brandSuggestions = await generateBrandRecommendations({
      wardrobeGaps: [],
      styleAesthetics: ['minimal', 'formal'],
      budgetTier: budgetTier,
      occasion: 'formal',
      specificRequest: 'Professional formal wear'
    });
    
    return {
      item_type: 'Formal Wear',
      description: 'Formal shirt and trousers combo for professional settings',
      priority: 'essential',
      occasion_fit: ['Interview', 'Office', 'Formal Event'],
      budget_estimate: BUDGET_TIERS[budgetTier].label,
      brand_suggestions: brandSuggestions,
      styling_opinion: 'Formal wear is an investment. Get basics that fit perfectly - tailoring is worth it.'
    };
  }
  
  return null;
}
