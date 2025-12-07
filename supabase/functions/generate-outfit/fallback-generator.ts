// ============================================
// DIVERSE FALLBACK OUTFIT GENERATOR
// Replaces modulo cycling with intelligent diversity
// ============================================

const norm = (s: any) => (s || '').toString().toLowerCase();

const isTop = (c: string) => ['shirt','top','tee','t-shirt','blouse','polo','kurta','kurti','tank'].some(k => c.includes(k));
const isBottom = (c: string) => ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom','legging'].some(k => c.includes(k));
const isShoe = (c: string) => ['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper'].some(k => c.includes(k));
const isLayer = (c: string) => ['jacket','blazer','coat','cardigan','sweater','hoodie','outerwear','layer'].some(k => c.includes(k));
const isAccessory = (c: string) => ['accessor','watch','belt','bag','handbag','sunglass','hat','scarf','jewelry'].some(k => c.includes(k));

export function generateDiverseFallbackOutfits(
  wardrobeItems: any[],
  maxOutfits: number,
  occasion?: string,
  style?: string,
  userLocation?: any
): any[] {
  // Categorize items
  const tops = wardrobeItems.filter(i => isTop(norm(i.category)));
  const bottoms = wardrobeItems.filter(i => isBottom(norm(i.category)));
  const shoes = wardrobeItems.filter(i => isShoe(norm(i.category)));
  const layers = wardrobeItems.filter(i => isLayer(norm(i.category)));
  const accessories = wardrobeItems.filter(i => isAccessory(norm(i.category)));
  
  if (!tops.length || !bottoms.length || !shoes.length) return [];
  
  // Shuffle arrays to introduce randomness
  const shuffledTops = shuffleArray([...tops]);
  const shuffledBottoms = shuffleArray([...bottoms]);
  const shuffledShoes = shuffleArray([...shoes]);
  const shuffledLayers = shuffleArray([...layers]);
  const shuffledAccessories = shuffleArray([...accessories]);
  
  const want = Math.min(maxOutfits || 7, 7);
  const combos: any[] = [];
  
  // Track used items to enforce diversity
  const usedTops = new Set<string>();
  const usedBottoms = new Set<string>();
  const usedShoes = new Set<string>();
  
  for (let i = 0; i < want; i++) {
    // Find unused items first, then cycle if necessary
    const top = findUnusedOrCycle(shuffledTops, usedTops, i);
    const bottom = findUnusedOrCycle(shuffledBottoms, usedBottoms, i);
    const shoe = findUnusedOrCycle(shuffledShoes, usedShoes, i);
    
    usedTops.add(top.id);
    usedBottoms.add(bottom.id);
    usedShoes.add(shoe.id);
    
    // Temperature-aware layering
    const needsLayer = userLocation?.temp !== undefined && userLocation.temp < 20;
    const layer = needsLayer && shuffledLayers.length > 0 
      ? shuffledLayers[i % shuffledLayers.length] 
      : undefined;
    
    // Accessories
    const accessory = shuffledAccessories.length > 0 
      ? shuffledAccessories[i % shuffledAccessories.length] 
      : undefined;
    
    const pieces: any[] = [
      { wardrobeItemId: top.id, category: top.category, role: 'upperwear' },
      { wardrobeItemId: bottom.id, category: bottom.category, role: 'lowerwear' },
      { wardrobeItemId: shoe.id, category: shoe.category, role: 'footwear' },
    ];
    if (layer) pieces.push({ wardrobeItemId: layer.id, category: layer.category, role: 'layer' });
    if (accessory) pieces.push({ wardrobeItemId: accessory.id, category: accessory.category, role: 'accessory' });
    
    // Generate style tag based on items
    const styleTag = generateStyleTag(top, bottom, shoe, style);
    
    // Determine boldness based on outfit position
    const boldnessLevel = i === want - 1 ? 'bold' : (i === 0 ? 'safe' : 'balanced');
    
    combos.push({
      outfitId: `fallback-${i + 1}`,
      pieces,
      reasoning: generateFallbackReasoning(top, bottom, shoe, layer, occasion, style),
      styleTag,
      confidence: 0.65 - (i * 0.05), // Slightly lower confidence for fallbacks
      boldness_level: boldnessLevel,
      estimated_formality: determineFormalityFromItems([top, bottom, shoe])
    });
  }
  
  return combos;
}

// Helper: Find unused item or cycle if all used
function findUnusedOrCycle(items: any[], usedIds: Set<string>, index: number): any {
  // Try to find unused first
  const unused = items.find(i => !usedIds.has(i.id));
  if (unused) return unused;
  // All used, cycle through
  return items[index % items.length];
}

// Helper: Shuffle array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Generate contextual style tag
function generateStyleTag(top: any, bottom: any, shoe: any, requestedStyle?: string): string {
  if (requestedStyle) return requestedStyle;
  
  const styles = [
    top.style_aesthetic?.[0],
    bottom.style_aesthetic?.[0],
    shoe.style_aesthetic?.[0]
  ].filter(Boolean);
  
  return styles[0] || 'versatile';
}

// Helper: Generate meaningful reasoning
function generateFallbackReasoning(top: any, bottom: any, shoe: any, layer: any, occasion?: string, style?: string): string {
  const context = occasion || style || 'everyday';
  const layerNote = layer ? `, with ${layer.name} for layering` : '';
  return `Balanced ${context} look pairing ${top.name} with ${bottom.name} and ${shoe.name}${layerNote}.`;
}

// Helper: Determine formality from items
function determineFormalityFromItems(items: any[]): string {
  const formalities = items.map(i => i.formality_level).filter(Boolean);
  if (formalities.includes('formal')) return 'formal';
  if (formalities.includes('business_casual')) return 'business_casual';
  if (formalities.includes('smart_casual')) return 'smart_casual';
  return 'casual';
}

// Helper: Shuffle wardrobe within categories to prevent positional bias
export function shuffleWardrobeInput(items: any[]): any[] {
  // Group by category
  const groups: Record<string, any[]> = {};
  
  for (const item of items) {
    const catKey = normalizeCategory(item.category);
    if (!groups[catKey]) groups[catKey] = [];
    groups[catKey].push(item);
  }
  
  // Shuffle each category group
  for (const key of Object.keys(groups)) {
    groups[key] = shuffleArray(groups[key]);
  }
  
  // Recombine in shuffled order
  const categoryOrder = shuffleArray(Object.keys(groups));
  const result: any[] = [];
  for (const cat of categoryOrder) {
    result.push(...groups[cat]);
  }
  
  return result;
}

function normalizeCategory(category: string): string {
  const cat = norm(category);
  if (isTop(cat)) return 'tops';
  if (isBottom(cat)) return 'bottoms';
  if (isShoe(cat)) return 'shoes';
  if (isLayer(cat)) return 'layers';
  if (isAccessory(cat)) return 'accessories';
  return 'other';
}
