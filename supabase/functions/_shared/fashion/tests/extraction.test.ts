import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { VisualSchema } from "../schema/visualSchema.ts";

Deno.test("VisualSchema validates correct structure", () => {
  const validData = {
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

  const result = VisualSchema.safeParse(validData);
  assertEquals(result.success, true);
});

Deno.test("VisualSchema rejects invalid structure", () => {
  const invalidData = {
    fit: {
      sleeve_length: { value: "invalid_value", confidence: 0.9 }
    }
  };

  const result = VisualSchema.safeParse(invalidData);
  assertEquals(result.success, false);
});
