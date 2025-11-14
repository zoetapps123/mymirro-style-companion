import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeScore } from "../scoring/computeScore.ts";

Deno.test("computeScore returns valid score range", () => {
  const mockData = {
    fit: {
      sleeve_length: { value: "mid-bicep", confidence: 0.9 },
      shoulder_structure: { value: "natural", confidence: 0.85 },
      silhouette: { value: "tapered", confidence: 0.8 },
      hemline: { value: "mid_hip", confidence: 0.9 },
      waist_visibility: { value: "tucked", confidence: 0.95 },
      pant_stacking: { value: "none", confidence: 0.9 }
    },
    fabric: {
      tshirt_material: { value: "cotton", confidence: 0.8 },
      tshirt_weight: { value: "mid", confidence: 0.75 },
      tshirt_texture: { value: "smooth", confidence: 0.85 },
      denim_type: { value: "raw", confidence: 0.7 }
    },
    color: {
      top_color: { value: "navy", confidence: 0.95 },
      bottom_color: { value: "indigo", confidence: 0.9 },
      harmony: { value: "monochrome", confidence: 0.85 },
      color_confidence: 0.9
    },
    styling: {
      footwear_type: { value: "sneakers", confidence: 0.9 },
      accessory_presence: { value: "minimal", confidence: 0.8 },
      layering_present: { value: false, confidence: 0.95 },
      polish_level: { value: 4, confidence: 0.85 }
    },
    aesthetics: {
      cultural_aesthetic: { value: "kfashion", confidence: 0.75 },
      brand_guess: { value: "unknown", confidence: 0.3 },
      price_tier: { value: "mid_range", confidence: 0.7 }
    },
    missing_features: []
  };

  const result = computeScore(mockData as any);

  assertExists(result.overall_score);
  assertEquals(result.overall_score >= 1 && result.overall_score <= 5, true);
  assertExists(result.components);
  assertExists(result.confidence);
});

Deno.test("computeScore handles unknown values correctly", () => {
  const mockDataWithUnknowns = {
    fit: {
      sleeve_length: { value: "unknown", confidence: 0 },
      shoulder_structure: { value: "unknown", confidence: 0 },
      silhouette: { value: "unknown", confidence: 0 },
      hemline: { value: "unknown", confidence: 0 },
      waist_visibility: { value: "unknown", confidence: 0 },
      pant_stacking: { value: "unknown", confidence: 0 }
    },
    fabric: {
      tshirt_material: { value: "unknown", confidence: 0 },
      tshirt_weight: { value: "unknown", confidence: 0 },
      tshirt_texture: { value: "unknown", confidence: 0 },
      denim_type: { value: "unknown", confidence: 0 }
    },
    color: {
      top_color: { value: "unknown", confidence: 0 },
      bottom_color: { value: "unknown", confidence: 0 },
      harmony: { value: "unknown", confidence: 0 },
      color_confidence: 0
    },
    styling: {
      footwear_type: { value: "unknown", confidence: 0 },
      accessory_presence: { value: "unknown", confidence: 0 },
      layering_present: { value: "unknown", confidence: 0 },
      polish_level: { value: "unknown", confidence: 0 }
    },
    aesthetics: {
      cultural_aesthetic: { value: "unknown", confidence: 0 },
      brand_guess: { value: "unknown", confidence: 0 },
      price_tier: { value: "unknown", confidence: 0 }
    },
    missing_features: ["all_features"]
  };

  const result = computeScore(mockDataWithUnknowns as any);

  assertEquals(result.overall_score >= 1 && result.overall_score <= 5, true);
  assertEquals(result.confidence <= 0.35, true);
});
