import { ClothingItem } from './detectItems.ts';
import { CompositeDetection } from './detectCompositeItems.ts';

interface MatchedItem extends ClothingItem {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Match original detections to composite detections to get correct labels + positions
 */
export function matchItems(
  originalItems: ClothingItem[],
  compositeDetections: CompositeDetection[]
): MatchedItem[] {
  console.log(`Matching ${originalItems.length} original items to ${compositeDetections.length} composite detections`);
  
  const matched: MatchedItem[] = [];
  const usedCompositeIndices = new Set<number>();

  // For each original item, find best match in composite
  for (const original of originalItems) {
    let bestMatchIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < compositeDetections.length; i++) {
      if (usedCompositeIndices.has(i)) continue;

      const composite = compositeDetections[i];
      let score = 0;

      // Category match (most important)
      if (original.category === composite.category) {
        score += 50;
      }

      // Color similarity
      const origColor = original.color.toLowerCase();
      const compColor = composite.color.toLowerCase();
      if (origColor === compColor) {
        score += 30;
      } else if (origColor.includes(compColor) || compColor.includes(origColor)) {
        score += 15;
      }

      // Name similarity (check for common words)
      const origWords = original.name.toLowerCase().split(/\s+/);
      const compWords = composite.name.toLowerCase().split(/\s+/);
      const commonWords = origWords.filter(w => compWords.includes(w));
      score += commonWords.length * 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatchIndex = i;
      }
    }

    if (bestMatchIndex >= 0 && bestScore > 40) { // Require reasonable confidence
      usedCompositeIndices.add(bestMatchIndex);
      const composite = compositeDetections[bestMatchIndex];
      
      matched.push({
        ...original, // Keep original metadata (detailed attributes)
        bbox: composite.bbox // Use composite's actual position
      });
      
      console.log(`Matched: "${original.name}" -> composite[${bestMatchIndex}] (score: ${bestScore})`);
    } else {
      console.warn(`No good match found for: ${original.name} (best score: ${bestScore})`);
    }
  }

  console.log(`Successfully matched ${matched.length}/${originalItems.length} items`);
  return matched;
}
