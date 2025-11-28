// ============================================
// DIVERSITY VALIDATOR (Post-Generation)
// Ensures outfit variety and prevents repetition
// ============================================

export interface DiversityReport {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  itemReuse: {
    shoes: string[];
    bottoms: string[];
    tops: string[];
  };
  silhouetteVariety: boolean;
  colorVariety: boolean;
}

const norm = (s: any) => (s || '').toString().toLowerCase();

const isTop = (c: string) => ['shirt','top','tee','t-shirt','blouse','polo','kurta','kurti','tank'].some(k => c.includes(k));
const isBottom = (c: string) => ['jeans','trouser','pants','chinos','skirt','shorts','bottoms','bottom','legging','pajama','churidar'].some(k => c.includes(k));
const isShoe = (c: string) => ['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper','jutti','mojari','kolhapuri'].some(k => c.includes(k));
const isLayer = (c: string) => ['jacket','blazer','coat','cardigan','sweater','hoodie','outerwear','layer'].some(k => c.includes(k));

export function validateOutfitDiversity(outfits: any[], wardrobeItems: any[]): DiversityReport {
  const report: DiversityReport = {
    isValid: true,
    score: 100,
    issues: [],
    itemReuse: { shoes: [], bottoms: [], tops: [] },
    silhouetteVariety: true,
    colorVariety: true
  };
  
  if (outfits.length < 2) return report; // Can't measure diversity with 1 outfit
  
  // Track item usage across outfits
  const categoryUsage: Record<string, string[]> = { shoes: [], bottoms: [], tops: [] };
  const silhouettes: string[] = [];
  const dominantColors: string[] = [];
  
  for (const outfit of outfits) {
    const pieces = outfit.pieces || [];
    
    for (const piece of pieces) {
      const id = piece.wardrobeItemId;
      const catLower = norm(piece.category);
      
      if (isShoe(catLower)) {
        categoryUsage.shoes.push(id);
      } else if (isBottom(catLower)) {
        categoryUsage.bottoms.push(id);
      } else if (isTop(catLower)) {
        categoryUsage.tops.push(id);
      }
    }
    
    // Detect silhouette
    const items = pieces.map((p: any) => wardrobeItems.find((i: any) => i.id === p.wardrobeItemId)).filter(Boolean);
    const silhouette = detectSilhouette(items);
    silhouettes.push(silhouette);
    
    // Detect dominant color
    const dominantColor = detectDominantColorFamily(items);
    dominantColors.push(dominantColor);
  }
  
  // Check shoe diversity
  const uniqueShoes = new Set(categoryUsage.shoes);
  const availableShoes = countWardrobeCategory(wardrobeItems, 'shoes');
  if (uniqueShoes.size < Math.min(categoryUsage.shoes.length, availableShoes) && availableShoes > 1) {
    const reusedShoeIds = findReusedItems(categoryUsage.shoes);
    report.itemReuse.shoes = reusedShoeIds;
    report.issues.push(`Shoe repeated: ${reusedShoeIds.length} reuses`);
    report.score -= 25;
  }
  
  // Check bottom diversity
  const uniqueBottoms = new Set(categoryUsage.bottoms);
  const availableBottoms = countWardrobeCategory(wardrobeItems, 'bottoms');
  if (uniqueBottoms.size < Math.min(categoryUsage.bottoms.length, availableBottoms) && availableBottoms > 1) {
    const reusedBottomIds = findReusedItems(categoryUsage.bottoms);
    report.itemReuse.bottoms = reusedBottomIds;
    report.issues.push(`Bottom repeated: ${reusedBottomIds.length} reuses`);
    report.score -= 20;
  }
  
  // Check top diversity
  const uniqueTops = new Set(categoryUsage.tops);
  const availableTops = countWardrobeCategory(wardrobeItems, 'tops');
  if (uniqueTops.size < Math.min(categoryUsage.tops.length, availableTops) && availableTops > 2) {
    const reusedTopIds = findReusedItems(categoryUsage.tops);
    report.itemReuse.tops = reusedTopIds;
    report.issues.push(`Top repeated: ${reusedTopIds.length} reuses`);
    report.score -= 15;
  }
  
  // Check silhouette variety
  const uniqueSilhouettes = new Set(silhouettes);
  if (uniqueSilhouettes.size === 1 && outfits.length >= 3) {
    report.silhouetteVariety = false;
    report.issues.push('All outfits have identical silhouette');
    report.score -= 15;
  }
  
  // Check color variety
  const uniqueColors = new Set(dominantColors.filter(Boolean));
  if (uniqueColors.size === 1 && outfits.length >= 3) {
    report.colorVariety = false;
    report.issues.push('All outfits have same dominant color family');
    report.score -= 10;
  }
  
  report.isValid = report.score >= 50;
  
  return report;
}

function detectSilhouette(items: any[]): string {
  const topFit = items.find(i => isTop(norm(i.category)))?.fit_type || 'regular';
  const bottomFit = items.find(i => isBottom(norm(i.category)))?.fit_type || 'regular';
  return `${topFit}/${bottomFit}`;
}

function detectDominantColorFamily(items: any[]): string {
  const colors = items.map(i => i.color_family || i.color).filter(Boolean);
  return colors[0] || 'unknown';
}

function countWardrobeCategory(items: any[], category: string): number {
  const matchers: Record<string, string[]> = {
    shoes: ['shoe', 'sneaker', 'boot', 'heel', 'sandal', 'loafer','jutti'],
    bottoms: ['jean', 'pant', 'bottom', 'trouser', 'skirt', 'shorts','churidar'],
    tops: ['top', 'shirt', 'tee', 'blouse', 'polo','kurta','kurti']
  };
  return items.filter(i => matchers[category]?.some(k => norm(i.category).includes(k))).length;
}

function findReusedItems(ids: string[]): string[] {
  const counts: Record<string, number> = {};
  ids.forEach(id => counts[id] = (counts[id] || 0) + 1);
  return Object.entries(counts).filter(([_, count]) => count > 1).map(([id]) => id);
}

export function enhanceOutfitDiversity(
  outfits: any[], 
  wardrobeItems: any[], 
  report: DiversityReport
): any[] {
  const enhanced = [...outfits];
  
  // Fix shoe repetition
  if (report.itemReuse.shoes.length > 0) {
    const availableShoes = wardrobeItems.filter(i => isShoe(norm(i.category)));
    const usedShoeIds = new Set<string>();
    
    for (let i = 0; i < enhanced.length; i++) {
      const outfit = enhanced[i];
      const currentShoePiece = outfit.pieces.find((p: any) => isShoe(norm(p.category)));
      
      if (currentShoePiece && usedShoeIds.has(currentShoePiece.wardrobeItemId)) {
        // Find an unused shoe
        const unusedShoe = availableShoes.find(s => !usedShoeIds.has(s.id));
        if (unusedShoe) {
          // Swap the shoe
          enhanced[i] = {
            ...outfit,
            pieces: outfit.pieces.map((p: any) => 
              p.wardrobeItemId === currentShoePiece.wardrobeItemId 
                ? { ...p, wardrobeItemId: unusedShoe.id, category: unusedShoe.category }
                : p
            ),
            reasoning: outfit.reasoning + ' (footwear varied for diversity)'
          };
          usedShoeIds.add(unusedShoe.id);
        }
      } else if (currentShoePiece) {
        usedShoeIds.add(currentShoePiece.wardrobeItemId);
      }
    }
  }
  
  // Fix bottom repetition
  if (report.itemReuse.bottoms.length > 0) {
    const availableBottoms = wardrobeItems.filter(i => isBottom(norm(i.category)));
    const usedBottomIds = new Set<string>();
    
    for (let i = 0; i < enhanced.length; i++) {
      const outfit = enhanced[i];
      const currentBottomPiece = outfit.pieces.find((p: any) => isBottom(norm(p.category)));
      
      if (currentBottomPiece && usedBottomIds.has(currentBottomPiece.wardrobeItemId)) {
        const unusedBottom = availableBottoms.find(b => !usedBottomIds.has(b.id));
        if (unusedBottom) {
          enhanced[i] = {
            ...outfit,
            pieces: outfit.pieces.map((p: any) => 
              p.wardrobeItemId === currentBottomPiece.wardrobeItemId
                ? { ...p, wardrobeItemId: unusedBottom.id, category: unusedBottom.category }
                : p
            ),
            reasoning: outfit.reasoning + ' (bottom varied for diversity)'
          };
          usedBottomIds.add(unusedBottom.id);
        }
      } else if (currentBottomPiece) {
        usedBottomIds.add(currentBottomPiece.wardrobeItemId);
      }
    }
  }
  
  return enhanced;
}
