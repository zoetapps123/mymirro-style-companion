// UI-only utilities for generating outfit titles and captions

const OCCASION_TITLE_MAP: Record<string, string[]> = {
  wedding: ['Wedding Chic', 'Elegant Affair', 'Celebration Look', 'Ceremony Ready'],
  reception: ['Reception Ready', 'Evening Elegance', 'Party Mode', 'Night Glam'],
  sangeet: ['Sangeet Style', 'Festive Glow', 'Dance Night', 'Celebration Vibes'],
  office: ['Smart Clean', 'Office Sharp', 'Workday Prep', 'Professional Edge'],
  interview: ['Interview Ready', 'First Impressions', 'Pro Look', 'Career Sharp'],
  meeting: ['Meeting Mode', 'Business Clean', 'Sharp & Ready', 'Boardroom Ready'],
  party: ['Party Mode', 'Night Out', 'Statement Look', 'After Hours'],
  club: ['Club Night', 'Dance Ready', 'After Dark', 'Night Energy'],
  casual: ['Everyday Easy', 'Casual Flow', 'Laid Back', 'Effortless Style'],
  brunch: ['Brunch Minimal', 'Weekend Chill', 'Sunday Best', 'Morning Vibes'],
  daily: ['Daily Pick', 'Go-To Look', 'Easy Day', 'Everyday Fit'],
  college: ['Campus Cool', 'Class Ready', 'Student Style', 'University Vibes'],
  date: ['Date Night', 'Romance Ready', 'Evening Charm', 'Dinner Date'],
  datenight: ['Date Night', 'Romance Ready', 'Evening Charm', 'Subtle Allure'],
  formal: ['Formal Edge', 'Black Tie Ready', 'Refined Look', 'Elegant Night'],
  travel: ['Travel Ready', 'On The Go', 'Journey Style', 'Wanderlust Fit'],
};

const STYLE_TITLE_MAP: Record<string, string[]> = {
  minimal: ['Minimal Clean', 'Pure Lines', 'Less Is More', 'Clean Slate'],
  minimalist: ['Minimalist Flow', 'Simple & Chic', 'Clean Slate', 'Quiet Luxury'],
  streetwear: ['Urban Oversize', 'Street Edge', 'City Mode', 'Street Ready'],
  elegant: ['Tonal Chic', 'Refined Look', 'Polished Style', 'Classic Elegance'],
  boho: ['Boho Flow', 'Free Spirit', 'Earthy Tones', 'Bohemian Vibes'],
  preppy: ['Preppy Fresh', 'Classic Crisp', 'Campus Chic', 'Ivy League'],
  grunge: ['Dark Edge', 'Grunge Mix', 'Raw Vibes', 'Rebel Style'],
  athleisure: ['Active Blend', 'Sport Casual', 'Movement Ready', 'Comfort Edge'],
  sporty: ['Sport Mode', 'Athletic Mix', 'Active Style', 'Game Ready'],
  indie: ['Indie Mix', 'Artistic Edge', 'Unique Blend', 'Creative Flow'],
  techwear: ['Tech Urban', 'Future Fit', 'Modern Edge', 'Cyber Ready'],
  y2k: ['Y2K Retro', '2000s Vibe', 'Throwback Style', 'Nostalgic Edge'],
  vintage: ['Vintage Soul', 'Retro Charm', 'Classic Revival', 'Old School Cool'],
  edgy: ['Bold Edge', 'Statement Style', 'Dark Mode', 'Sharp Contrast'],
};

const GENERIC_TITLES = [
  'Fresh Look', 'Style Pick', 'Curated Fit', 'Smart Mix', "Today's Pick",
  'Effortless Fit', 'Easy Combo', 'Go-To Look', 'Balanced Style'
];

const OCCASION_CAPTIONS: Record<string, string[]> = {
  wedding: ['Elegant ensemble for a memorable celebration', 'Dressed to celebrate in refined style'],
  office: ['Sharp and structured for a confident day', 'Professional polish with comfort in mind'],
  casual: ['Effortless comfort for everyday moments', 'Relaxed fit with subtle style details'],
  party: ['Statement pieces for a standout evening', 'Bold mix for after-hours energy'],
  brunch: ['Laid-back layers for weekend vibes', 'Easy elegance for slow mornings'],
  date: ['Refined charm for an evening connection', 'Subtle sophistication for special moments'],
  interview: ['Confident silhouette for lasting impressions', 'Polished look for career moments'],
  travel: ['Comfortable layers for on-the-go style', 'Versatile pieces for any destination'],
};

const STYLE_CAPTIONS: Record<string, string[]> = {
  minimal: ['Clean lines with a neutral palette', 'Simple sophistication, zero distractions'],
  streetwear: ['Urban layers with oversized attitude', 'Street-ready mix of comfort and edge'],
  elegant: ['Polished tones in refined silhouettes', 'Timeless pieces with modern structure'],
  boho: ['Flowy textures in earthy harmony', 'Free-spirited layers with natural warmth'],
  preppy: ['Classic structure with crisp details', 'Campus-ready with polished accents'],
  athleisure: ['Performance meets everyday style', 'Active comfort with casual polish'],
  vintage: ['Retro-inspired pieces with modern flair', 'Nostalgic charm meets current trends'],
  edgy: ['Bold contrasts with statement pieces', 'Sharp silhouettes with attitude'],
};

const GENERIC_CAPTIONS = [
  'Thoughtfully curated for style and comfort',
  'Balanced pieces for a cohesive look',
  'Smart pairing with everyday versatility',
  'Clean combination with subtle details',
  'Effortless mix of form and function',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeKey(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Extract a meaningful name from AI reasoning or visual description
 */
function deriveNameFromReasoning(reasoning?: string | null, visualDesc?: string | null): string | null {
  const text = reasoning || visualDesc || '';
  if (!text || text.length < 10) return null;
  
  // Look for patterns like "clean urban look", "relaxed weekend vibe", etc.
  const patterns = [
    /(?:a\s+)?(\w+)\s+(urban|casual|elegant|relaxed|bold|refined|modern|classic|sleek|minimal|sporty)\s+(?:look|vibe|style|fit)/i,
    /(?:a\s+)?(\w+)\s+and\s+(\w+)\s+(?:look|vibe|style|outfit)/i,
    /creates?\s+(?:a\s+)?(\w+)\s+(\w+)\s+(?:aesthetic|vibe|feel)/i,
    /(\w+)\s+(chic|edge|flow|mode|ready)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Capitalize first letter of each word
      const words = match.slice(1, 3).filter(Boolean);
      if (words.length >= 2) {
        const name = words
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        if (name.length >= 6 && name.length <= 20) {
          return name;
        }
      }
    }
  }
  
  // Try to extract adjective-noun combos
  const adjectives = ['clean', 'sleek', 'bold', 'soft', 'sharp', 'warm', 'cool', 'fresh', 'dark', 'light', 'rich', 'muted'];
  const nouns = ['look', 'style', 'vibe', 'edge', 'flow', 'mode', 'mix', 'blend'];
  
  const lowerText = text.toLowerCase();
  for (const adj of adjectives) {
    if (lowerText.includes(adj)) {
      for (const noun of nouns) {
        if (lowerText.includes(noun)) {
          const name = adj.charAt(0).toUpperCase() + adj.slice(1) + ' ' + noun.charAt(0).toUpperCase() + noun.slice(1);
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * Generate an outfit title based on occasion/style/reasoning
 * Priority: existingName > derivedFromReasoning > occasion/style maps > generic
 */
export function generateOutfitTitle(
  occasion?: string | null,
  style?: string | null,
  existingName?: string | null,
  reasoning?: string | null,
  visualDesc?: string | null
): string {
  // 1. Use existing name if valid (6-20 chars, not generic fallback)
  if (existingName && existingName.length >= 6 && existingName.length <= 20) {
    const genericFallbacks = ['Look', 'Outfit', 'Style'];
    const isGenericFallback = genericFallbacks.some(g => 
      existingName.endsWith(` ${g}`) && existingName.split(' ').length <= 2
    );
    if (!isGenericFallback) {
      return existingName;
    }
  }

  // 2. Try deriving from AI reasoning/visual description
  const derivedName = deriveNameFromReasoning(reasoning, visualDesc);
  if (derivedName) {
    return derivedName;
  }

  const normOccasion = normalizeKey(occasion);
  const normStyle = normalizeKey(style);

  // 3. Try occasion-based title
  for (const [key, titles] of Object.entries(OCCASION_TITLE_MAP)) {
    if (normOccasion.includes(key) || key.includes(normOccasion)) {
      return getRandomItem(titles);
    }
  }

  // 4. Try style-based title
  for (const [key, titles] of Object.entries(STYLE_TITLE_MAP)) {
    if (normStyle.includes(key) || key.includes(normStyle)) {
      return getRandomItem(titles);
    }
  }

  // 5. Fallback to generic
  return getRandomItem(GENERIC_TITLES);
}

/**
 * Generate a micro-caption (6-12 words)
 * Now also accepts reasoning to derive captions
 */
export function generateOutfitCaption(
  occasion?: string | null,
  style?: string | null,
  aiCaption?: string | null,
  reasoning?: string | null
): string {
  // Use AI-generated caption if valid
  if (aiCaption && aiCaption.length >= 20 && aiCaption.length <= 80) {
    return aiCaption;
  }
  
  // Try to extract a good line from reasoning
  if (reasoning && reasoning.length > 30) {
    // Take first sentence if it's a good length
    const firstSentence = reasoning.split(/[.!]/)[0]?.trim();
    if (firstSentence && firstSentence.length >= 20 && firstSentence.length <= 70) {
      return firstSentence;
    }
  }

  const normOccasion = normalizeKey(occasion);
  const normStyle = normalizeKey(style);

  // Try occasion-based caption
  for (const [key, captions] of Object.entries(OCCASION_CAPTIONS)) {
    if (normOccasion.includes(key) || key.includes(normOccasion)) {
      return getRandomItem(captions);
    }
  }

  // Try style-based caption
  for (const [key, captions] of Object.entries(STYLE_CAPTIONS)) {
    if (normStyle.includes(key) || key.includes(normStyle)) {
      return getRandomItem(captions);
    }
  }

  // Fallback
  return getRandomItem(GENERIC_CAPTIONS);
}

/**
 * Get category-specific max heights for silhouette composition
 */
export function getCategoryMaxHeight(category: string): number {
  const heightMap: Record<string, number> = {
    tops: 160,
    bottoms: 180,
    shoes: 130,
    footwear: 130,
    outerwear: 180,
    dresses: 200,
    accessories: 100,
    ethnic: 180,
  };
  
  const normalizedCategory = category.toLowerCase();
  return heightMap[normalizedCategory] || 140;
}

/**
 * Order items for vertical silhouette display
 */
export function orderItemsForSilhouette<T extends { category: string }>(items: T[]): T[] {
  const categoryOrder = ['outerwear', 'tops', 'dresses', 'ethnic', 'bottoms', 'footwear', 'shoes', 'accessories'];
  
  return [...items].sort((a, b) => {
    const aIndex = categoryOrder.findIndex(c => 
      a.category.toLowerCase().includes(c) || c.includes(a.category.toLowerCase())
    );
    const bIndex = categoryOrder.findIndex(c => 
      b.category.toLowerCase().includes(c) || c.includes(b.category.toLowerCase())
    );
    
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;
    
    return aOrder - bOrder;
  });
}
