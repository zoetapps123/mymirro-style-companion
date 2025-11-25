import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiAPI } from './ai-config.ts';
import { BRAND_RECOMMENDER_PROMPT } from './ai_companion_prompts/07_brand_recommender.ts';

export interface BrandRecommendation {
  brand_name: string;
  category: string;
  budget_tier: 'student_safe' | 'mid_range' | 'premium_non_luxury';
  style_match: string[];
  reasoning: string;
  confidence: number;
  where_to_buy: string;
}

export interface BrandRecommendationRequest {
  wardrobeGaps: any[];
  styleAesthetics: string[];
  budgetTier: 'student_safe' | 'mid_range' | 'premium_non_luxury';
  occasion?: string;
  specificRequest?: string;
}

// Enhanced brand database with purchase locations
const BRAND_DATABASE_WITH_LOCATIONS = {
  student_safe: {
    streetwear: [
      { name: 'Bewakoof', location: 'Online: bewakoof.com' },
      { name: 'The Souled Store', location: 'Online: thesouledstore.com' },
      { name: 'Campus Sutra', location: 'Online: campussutra.com, Select stores' },
      { name: 'Snitch', location: 'Online: snitch.co.in' }
    ],
    minimal: [
      { name: 'H&M Basics', location: 'H&M stores, myntra.com' },
      { name: 'Uniqlo Basics', location: 'Uniqlo stores (Delhi, Mumbai, Bangalore), ajio.com' },
      { name: 'Decathlon', location: 'Decathlon stores nationwide, decathlon.in' },
      { name: 'Westside', location: 'Westside stores, tatacliq.com' }
    ],
    ethnic: [
      { name: 'FabIndia (basics)', location: 'FabIndia stores nationwide, fabindia.com' },
      { name: 'Biba', location: 'Biba stores, myntra.com, ajio.com' },
      { name: 'Global Desi', location: 'Select stores, myntra.com, ajio.com' }
    ],
    footwear: [
      { name: 'Nike (sale)', location: 'Nike stores, nike.com, myntra.com' },
      { name: 'Adidas (sale)', location: 'Adidas stores, adidas.co.in, myntra.com' },
      { name: 'Puma', location: 'Puma stores, in.puma.com, myntra.com' },
      { name: 'Red Tape', location: 'Red Tape stores, myntra.com' },
      { name: 'Woodland', location: 'Woodland stores nationwide, myntra.com' }
    ]
  },
  mid_range: {
    streetwear: [
      { name: 'Being Human', location: 'Being Human stores, myntra.com' },
      { name: 'Alcis', location: 'Alcis stores, alcissports.com, myntra.com' },
      { name: 'Only & Sons', location: 'Only stores, ajio.com, myntra.com' },
      { name: 'Jack & Jones', location: 'Jack & Jones stores, ajio.com, myntra.com' }
    ],
    minimal: [
      { name: 'Marks & Spencer', location: 'M&S stores (major cities), marksandspencer.in' },
      { name: 'Zara', location: 'Zara stores (metros), zara.com' },
      { name: 'United Colors of Benetton', location: 'UCB stores, myntra.com, ajio.com' },
      { name: 'Allen Solly', location: 'Allen Solly stores, myntra.com, ajio.com' }
    ],
    ethnic: [
      { name: 'Manyavar', location: 'Manyavar stores nationwide, manyavar.com' },
      { name: 'Peter England', location: 'Peter England stores, myntra.com' },
      { name: 'W for Woman', location: 'W stores, myntra.com, ajio.com' }
    ],
    footwear: [
      { name: 'Clarks', location: 'Clarks stores (metros), clarks.in, myntra.com' },
      { name: 'Nike (full price)', location: 'Nike stores, nike.com' },
      { name: 'Adidas Originals', location: 'Adidas stores, adidas.co.in' },
      { name: 'Skechers', location: 'Skechers stores, skechers.in, myntra.com' }
    ]
  },
  premium_non_luxury: {
    streetwear: [
      { name: 'Tommy Hilfiger', location: 'Tommy stores (metros), tommyhilfiger.in, myntra.com' },
      { name: 'US Polo', location: 'US Polo stores, uspoloassn.in, myntra.com' },
      { name: 'Superdry', location: 'Superdry stores (metros), superdry.in' },
      { name: 'Levis Premium', location: 'Levis stores, levi.in' }
    ],
    minimal: [
      { name: 'Massimo Dutti', location: 'Massimo Dutti stores (Delhi, Mumbai, Bangalore), massimodutti.com' },
      { name: 'COS', location: 'Online: cosstores.com (ships to India)' },
      { name: 'Reiss', location: 'Select luxury stores, online retailers' },
      { name: 'Ted Baker', location: 'Select luxury stores, myntra.com, ajio.com' }
    ],
    ethnic: [
      { name: 'Fabindia Premium', location: 'FabIndia stores, fabindia.com' },
      { name: 'Good Earth', location: 'Good Earth stores (metros), goodearth.in' },
      { name: 'Anita Dongre (Grassroot)', location: 'Anita Dongre stores, anitadongre.com' }
    ],
    footwear: [
      { name: 'Cole Haan', location: 'Select stores, colehaan.com, myntra.com' },
      { name: 'Clarks Premium', location: 'Clarks flagship stores, clarks.in' },
      { name: 'Timberland', location: 'Timberland stores (metros), myntra.com' },
      { name: 'Hush Puppies', location: 'Hush Puppies stores, myntra.com' }
    ]
  }
};

export async function generateBrandRecommendations(
  request: BrandRecommendationRequest
): Promise<BrandRecommendation[]> {
  const { wardrobeGaps, styleAesthetics, budgetTier, occasion, specificRequest } = request;

  // Build context for AI
  const context = `
USER CONTEXT:
- Style Aesthetics: ${styleAesthetics.join(', ')}
- Budget Tier: ${budgetTier.replace('_', ' ')}
- Wardrobe Gaps: ${wardrobeGaps.map(g => g.gap_description).join(', ')}
${occasion ? `- Occasion: ${occasion}` : ''}
${specificRequest ? `- Specific Request: ${specificRequest}` : ''}

TASK: Provide 3-5 personalized brand recommendations that match the user's style, budget, and wardrobe needs.
Focus on brands available in India that the user can actually purchase from.
  `.trim();

  try {
    const response = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: BRAND_RECOMMENDER_PROMPT
        },
        {
          role: 'user',
          content: context
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'recommend_brands',
          description: 'Return brand recommendations with reasoning',
          parameters: {
            type: 'object',
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    brand_name: { type: 'string' },
                    category: { type: 'string' },
                    reasoning: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 }
                  },
                  required: ['brand_name', 'category', 'reasoning', 'confidence']
                }
              }
            },
            required: ['recommendations']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'recommend_brands' } }
    });

    const result = JSON.parse(
      response.choices[0].message.tool_calls[0].function.arguments
    );

    // Enrich recommendations with location data
    const enrichedRecommendations: BrandRecommendation[] = result.recommendations.map((rec: any) => {
      const location = findBrandLocation(rec.brand_name, budgetTier);
      
      return {
        brand_name: rec.brand_name,
        category: rec.category,
        budget_tier: budgetTier,
        style_match: styleAesthetics,
        reasoning: rec.reasoning,
        confidence: rec.confidence,
        where_to_buy: location || 'Available at major retailers and online'
      };
    });

    console.log('[BRAND RECOMMENDATIONS v6]', {
      count: enrichedRecommendations.length,
      brands: enrichedRecommendations.map(r => r.brand_name)
    });

    return enrichedRecommendations;

  } catch (error) {
    console.error('Error generating brand recommendations:', error);
    
    // Fallback to rule-based recommendations
    return getFallbackBrandRecommendations(request);
  }
}

function findBrandLocation(brandName: string, budgetTier: string): string | null {
  const normalizedBrand = brandName.toLowerCase();
  
  for (const [tier, categories] of Object.entries(BRAND_DATABASE_WITH_LOCATIONS)) {
    for (const [category, brands] of Object.entries(categories)) {
      const brand = (brands as any[]).find(b => 
        b.name.toLowerCase().includes(normalizedBrand) || 
        normalizedBrand.includes(b.name.toLowerCase())
      );
      if (brand) return brand.location;
    }
  }
  
  return null;
}

function getFallbackBrandRecommendations(
  request: BrandRecommendationRequest
): BrandRecommendation[] {
  const { budgetTier, styleAesthetics } = request;
  
  // Determine style category
  let styleCategory: 'streetwear' | 'minimal' | 'ethnic' | 'footwear' = 'minimal';
  
  if (styleAesthetics.some(s => ['street', 'urban', 'oversized'].some(k => s.toLowerCase().includes(k)))) {
    styleCategory = 'streetwear';
  } else if (styleAesthetics.some(s => ['ethnic', 'traditional', 'desi'].some(k => s.toLowerCase().includes(k)))) {
    styleCategory = 'ethnic';
  }
  
  const brands = BRAND_DATABASE_WITH_LOCATIONS[budgetTier][styleCategory] || 
                 BRAND_DATABASE_WITH_LOCATIONS[budgetTier].minimal;
  
  return brands.slice(0, 3).map((brand: any) => ({
    brand_name: brand.name,
    category: 'General',
    budget_tier: budgetTier,
    style_match: styleAesthetics,
    reasoning: `${brand.name} offers quality ${styleCategory} pieces within your ${budgetTier.replace('_', ' ')} budget.`,
    confidence: 0.7,
    where_to_buy: brand.location
  }));
}

export async function getBrandRecommendationsForGap(
  supabase: SupabaseClient,
  userId: string,
  gap: any,
  wardrobePersona: any
): Promise<BrandRecommendation[]> {
  const budgetTier = inferBudgetTier(
    wardrobePersona.wardrobe_size || 0,
    wardrobePersona.style_aesthetic || []
  );
  
  const request: BrandRecommendationRequest = {
    wardrobeGaps: [gap],
    styleAesthetics: wardrobePersona.style_aesthetic || [],
    budgetTier: budgetTier,
    specificRequest: gap.gap_description
  };
  
  return await generateBrandRecommendations(request);
}

function inferBudgetTier(
  wardrobeSize: number,
  styleAesthetics: string[]
): 'student_safe' | 'mid_range' | 'premium_non_luxury' {
  if (wardrobeSize < 10) return 'student_safe';
  
  const premiumStyles = ['quiet luxury', 'minimalist', 'elevated casual'];
  const hasPremiumStyle = styleAesthetics.some(s => 
    premiumStyles.some(p => s.toLowerCase().includes(p))
  );
  
  if (hasPremiumStyle && wardrobeSize > 20) return 'premium_non_luxury';
  
  return 'mid_range';
}
