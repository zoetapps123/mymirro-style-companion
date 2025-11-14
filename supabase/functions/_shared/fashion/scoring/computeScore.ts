import { COMPONENT_WEIGHTS } from "./weights.ts";
import { VisualData } from "../schema/visualSchema.ts";

function safeVal(f: any) {
  return (!f || f.value === "unknown")
    ? { v: "unknown", c: 0 }
    : { v: f.value, c: f.confidence ?? 1 };
}

function scoreFit(fit: any, occasion: string) {
  const sil = safeVal(fit.silhouette);
  const hem = safeVal(fit.hemline);
  const stack = safeVal(fit.pant_stacking);
  const waist = safeVal(fit.waist_visibility);
  const occasionLower = occasion.toLowerCase();

  let score = 3;
  
  // Occasion-aware silhouette scoring
  if (occasionLower === "formal" || occasionLower === "work") {
    if (sil.v === "tapered") score += 1;
    if (sil.v === "straight") score += 0.7;
    if (sil.v === "oversized") score -= 0.3;
  } else if (occasionLower === "casual") {
    if (sil.v === "tapered") score += 0.5;
    if (sil.v === "boxy") score += 0.5;
    if (sil.v === "oversized") score += 0.3;
  } else if (occasionLower === "party" || occasionLower === "date") {
    if (sil.v === "tapered") score += 0.8;
    if (sil.v === "oversized") score += 0.5;
  }
  
  if (hem.v === "mid_hip") score += 0.3;
  
  // Pant stacking - only penalize for formal
  if (stack.v === "heavy" && (occasionLower === "formal" || occasionLower === "work")) {
    score -= 0.4;
  }
  
  // Waist visibility - context matters
  if ((occasionLower === "formal" || occasionLower === "work") && waist.v === "tucked") {
    score += 0.5;
  }

  score = Math.max(0, Math.min(5, score));
  return { score, conf: Math.min(sil.c, hem.c, stack.c, waist.c) };
}

function scoreColor(color: any) {
  const h = safeVal(color.harmony);
  const base: Record<string, number> = {
    monochrome: 5,
    analogous: 4,
    complementary: 4.5,
    contrasting: 3.5,
    clashing: 1,
    unknown: 3
  };
  return { score: base[h.v] ?? 3, conf: h.c };
}

function scoreStyling(styling: any, occasion: string) {
  const polish = safeVal(styling.polish_level);
  const acc = safeVal(styling.accessory_presence);
  const occasionLower = occasion.toLowerCase();

  let score = (polish.v === "unknown" ? 3 : Number(polish.v));
  
  // Context-aware accessory scoring
  if (occasionLower === "formal" || occasionLower === "party" || occasionLower === "date") {
    if (acc.v === "heavy") score += 0.5;
    if (acc.v === "moderate") score += 0.3;
  } else if (occasionLower === "casual") {
    if (acc.v === "minimal") score += 0.2;
    if (acc.v === "heavy") score -= 0.2;
  } else if (occasionLower === "work") {
    if (acc.v === "minimal" || acc.v === "moderate") score += 0.3;
    if (acc.v === "heavy") score -= 0.3;
  }

  return { score: Math.max(0, Math.min(5, score)), conf: Math.min(polish.c, acc.c) };
}

function scoreMaterials(fabric: any, aesthetics: any, occasion: string) {
  const mat = safeVal(fabric.tshirt_material);
  const priceTier = safeVal(aesthetics.price_tier);
  const occasionLower = occasion.toLowerCase();
  
  let score = 3;

  if (mat.v === "cotton") score = 4;
  if (mat.v === "knit") score = 4.2;
  if (mat.v === "silk_blend") score = 4.5;
  
  // Occasion-based material expectations
  if (occasionLower === "formal" || occasionLower === "party") {
    if (priceTier.v === "luxury") score += 0.8;
    if (priceTier.v === "premium") score += 0.5;
    if (priceTier.v === "fast_fashion") score -= 0.3;
  } else if (occasionLower === "casual") {
    if (priceTier.v === "luxury") score += 0.3;
    if (priceTier.v === "mid_range") score += 0.2;
  } else if (occasionLower === "work") {
    if (priceTier.v === "premium" || priceTier.v === "luxury") score += 0.5;
  }

  return { score: Math.max(0, Math.min(5, score)), conf: mat.c };
}

export function computeScore(data: VisualData, occasion: string = "Casual") {
  const fit = scoreFit(data.fit, occasion);
  const color = scoreColor(data.color);
  const styling = scoreStyling(data.styling, occasion);
  const material = scoreMaterials(data.fabric, data.aesthetics, occasion);

  const components = {
    fit: fit.score,
    color: color.score,
    styling: styling.score,
    material: material.score,
  };

  // Occasion-aware weighting
  let weights = { ...COMPONENT_WEIGHTS };
  const occasionLower = occasion.toLowerCase();
  
  if (occasionLower === "formal" || occasionLower === "party") {
    weights.material_quality = 0.15;
    weights.styling_execution = 0.20;
    weights.fit_and_proportion = 0.25;
    weights.color_harmony = 0.20;
  } else if (occasionLower === "casual") {
    weights.fit_and_proportion = 0.35;
    weights.color_harmony = 0.25;
    weights.styling_execution = 0.10;
    weights.material_quality = 0.10;
  }

  const raw =
    fit.score * weights.fit_and_proportion +
    color.score * weights.color_harmony +
    styling.score * weights.styling_execution +
    material.score * weights.material_quality;

  let confidence = Math.min(fit.conf, color.conf, styling.conf, material.conf);

  if (data.missing_features.length >= 4) confidence -= 0.2;

  const normalized = Math.max(1, Math.min(5, Number(raw.toFixed(2))));

  return {
    overall_score: Math.round(normalized * 4) / 4,
    components,
    confidence,
    missing_features: data.missing_features
  };
}
