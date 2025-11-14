import { COMPONENT_WEIGHTS } from "./weights.ts";
import { VisualData } from "../schema/visualSchema.ts";

function safeVal(f: any) {
  return (!f || f.value === "unknown")
    ? { v: "unknown", c: 0 }
    : { v: f.value, c: f.confidence ?? 1 };
}

function scoreFit(fit: any) {
  const sil = safeVal(fit.silhouette);
  const hem = safeVal(fit.hemline);
  const stack = safeVal(fit.pant_stacking);
  const waist = safeVal(fit.waist_visibility);

  let score = 3;
  if (sil.v === "tapered") score += 1;
  if (sil.v === "boxy") score += 0.5;
  if (hem.v === "mid_hip") score += 0.5;
  if (stack.v === "heavy") score -= 0.5;
  if (waist.v === "tucked") score += 0.5;

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

function scoreStyling(styling: any) {
  const polish = safeVal(styling.polish_level);
  const acc = safeVal(styling.accessory_presence);

  let score = (polish.v === "unknown" ? 3 : Number(polish.v));
  if (acc.v === "minimal") score += 0.3;
  if (acc.v === "heavy") score -= 0.5;

  return { score: Math.max(0, Math.min(5, score)), conf: Math.min(polish.c, acc.c) };
}

function scoreMaterials(fabric: any, aesthetics: any) {
  const mat = safeVal(fabric.tshirt_material);
  let score = 3;

  if (mat.v === "cotton") score = 4;
  if (mat.v === "knit") score = 4.2;

  if (aesthetics.price_tier.value === "luxury") score += 0.5;

  return { score: Math.max(0, Math.min(5, score)), conf: mat.c };
}

export function computeScore(data: VisualData) {
  const fit = scoreFit(data.fit);
  const color = scoreColor(data.color);
  const styling = scoreStyling(data.styling);
  const material = scoreMaterials(data.fabric, data.aesthetics);

  const components = {
    fit: fit.score,
    color: color.score,
    styling: styling.score,
    material: material.score,
  };

  const raw =
    fit.score * COMPONENT_WEIGHTS.fit_and_proportion +
    color.score * COMPONENT_WEIGHTS.color_harmony +
    styling.score * COMPONENT_WEIGHTS.styling_execution +
    material.score * COMPONENT_WEIGHTS.material_quality;

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
