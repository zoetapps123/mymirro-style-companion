import { FullExtraction } from "../extraction/types";
import { WEIGHTS } from "./weightage";

/**
 * Now scores:
 * - core (color/category etc.)
 * - fit attributes (proportion, silhouette, stacking)
 * - fabric attributes (material, texture, weight)
 *
 * Missing = "unknown" → contributes 0, never negative
 */
export function scoreFeatures(f: FullExtraction): number {
  const safe = (value: string, map: any) =>
    value === "unknown" ? 0 : map[value] ?? 0;

  let score = 0;

  // Core scoring
  score += safe(f.core.color, WEIGHTS.color);
  score += safe(f.core.category, WEIGHTS.category);
  score += safe(f.core.neckline, WEIGHTS.neckline);
  score += safe(f.core.brand_and_tier, WEIGHTS.brand);

  // Fit scoring
  score += safe(f.fit.t_shirt_sleeve_length, WEIGHTS.t_shirt_sleeve_length);
  score += safe(f.fit.body_volume_ratio, WEIGHTS.body_volume_ratio);
  score += safe(f.fit.hemline_placement, WEIGHTS.hemline_placement);
  score += safe(f.fit.pant_stacking, WEIGHTS.pant_stacking);
  score += safe(f.fit.waist_visibility, WEIGHTS.waist_visibility);
  score += safe(f.fit.shoulder_structure, WEIGHTS.shoulder_structure);
  score += safe(f.fit.silhouette, WEIGHTS.silhouette);

  // Fabric scoring
  score += safe(f.fabric.t_shirt_material, WEIGHTS.t_shirt_material);
  score += safe(f.fabric.fabric_weight, WEIGHTS.fabric_weight);
  score += safe(f.fabric.texture, WEIGHTS.texture);
  score += safe(f.fabric.denim_type, WEIGHTS.denim_type);

  return score;
}
