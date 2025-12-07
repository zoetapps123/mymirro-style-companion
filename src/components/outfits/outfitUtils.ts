// UI-only utilities for generating outfit titles and captions

const OCCASION_TITLE_MAP: Record<string, string[]> = {
  wedding: ['Wedding Chic', 'Elegant Ceremony', 'Celebration Look'],
  reception: ['Reception Ready', 'Evening Elegance', 'Party Mode'],
  sangeet: ['Sangeet Style', 'Festive Glow', 'Dance Night'],
  office: ['Smart Clean', 'Office Sharp', 'Workday Prep'],
  interview: ['Interview Ready', 'First Impressions', 'Pro Look'],
  meeting: ['Meeting Mode', 'Business Clean', 'Sharp & Ready'],
  party: ['Party Mode', 'Night Out', 'Statement Look'],
  club: ['Club Night', 'Dance Ready', 'After Dark'],
  casual: ['Everyday Easy', 'Casual Flow', 'Laid Back'],
  brunch: ['Brunch Minimal', 'Weekend Chill', 'Sunday Best'],
  daily: ['Daily Pick', 'Go-To Look', 'Easy Day'],
  college: ['Campus Cool', 'Class Ready', 'Student Style'],
  date: ['Date Night', 'Romance Ready', 'Evening Charm'],
  datenight: ['Date Night', 'Romance Ready', 'Evening Charm'],
};

const STYLE_TITLE_MAP: Record<string, string[]> = {
  minimal: ['Minimal Clean', 'Pure Lines', 'Less Is More'],
  minimalist: ['Minimalist Flow', 'Simple & Chic', 'Clean Slate'],
  streetwear: ['Urban Oversize', 'Street Edge', 'City Mode'],
  elegant: ['Tonal Chic', 'Refined Look', 'Polished Style'],
  boho: ['Boho Flow', 'Free Spirit', 'Earthy Tones'],
  preppy: ['Preppy Fresh', 'Classic Crisp', 'Campus Chic'],
  grunge: ['Dark Edge', 'Grunge Mix', 'Raw Vibes'],
  athleisure: ['Active Blend', 'Sport Casual', 'Movement Ready'],
  sporty: ['Sport Mode', 'Athletic Mix', 'Active Style'],
  indie: ['Indie Mix', 'Artistic Edge', 'Unique Blend'],
  techwear: ['Tech Urban', 'Future Fit', 'Modern Edge'],
  y2k: ['Y2K Retro', '2000s Vibe', 'Throwback Style'],
};

const GENERIC_TITLES = [
  'Fresh Look', 'Style Pick', 'Curated Fit', 'Smart Mix', 'Today\'s Pick'
];

const OCCASION_CAPTIONS: Record<string, string[]> = {
  wedding: ['Elegant ensemble for a memorable celebration', 'Dressed to celebrate in refined style'],
  office: ['Sharp and structured for a confident day', 'Professional polish with comfort in mind'],
  casual: ['Effortless comfort for everyday moments', 'Relaxed fit with subtle style details'],
  party: ['Statement pieces for a standout evening', 'Bold mix for after-hours energy'],
  brunch: ['Laid-back layers for weekend vibes', 'Easy elegance for slow mornings'],
  date: ['Refined charm for an evening connection', 'Subtle sophistication for special moments'],
};

const STYLE_CAPTIONS: Record<string, string[]> = {
  minimal: ['Clean lines with a neutral palette', 'Simple sophistication, zero distractions'],
  streetwear: ['Urban layers with oversized attitude', 'Street-ready mix of comfort and edge'],
  elegant: ['Polished tones in refined silhouettes', 'Timeless pieces with modern structure'],
  boho: ['Flowy textures in earthy harmony', 'Free-spirited layers with natural warmth'],
  preppy: ['Classic structure with crisp details', 'Campus-ready with polished accents'],
  athleisure: ['Performance meets everyday style', 'Active comfort with casual polish'],
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
 * Generate an outfit title based on occasion/style
 * Returns a 6-16 character title
 */
export function generateOutfitTitle(
  occasion?: string | null,
  style?: string | null,
  existingName?: string | null
): string {
  // If there's already a good name, use it
  if (existingName && existingName.length >= 6 && existingName.length <= 20) {
    return existingName;
  }

  const normOccasion = normalizeKey(occasion);
  const normStyle = normalizeKey(style);

  // Try occasion-based title first
  for (const [key, titles] of Object.entries(OCCASION_TITLE_MAP)) {
    if (normOccasion.includes(key) || key.includes(normOccasion)) {
      return getRandomItem(titles);
    }
  }

  // Try style-based title
  for (const [key, titles] of Object.entries(STYLE_TITLE_MAP)) {
    if (normStyle.includes(key) || key.includes(normStyle)) {
      return getRandomItem(titles);
    }
  }

  // Fallback to generic
  return getRandomItem(GENERIC_TITLES);
}

/**
 * Generate a micro-caption (6-12 words)
 */
export function generateOutfitCaption(
  occasion?: string | null,
  style?: string | null
): string {
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
