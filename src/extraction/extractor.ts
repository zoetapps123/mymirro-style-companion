import { FullExtraction } from "./types";
import { BASE_PROMPT } from "../prompts/prompt";

// Mock function - replace with your actual model call
async function callModel(prompt: string, image: Buffer): Promise<string> {
  // Your actual implementation here
  throw new Error("Implement callModel with your AI provider");
}

export async function extractFeatures(image: Buffer): Promise<FullExtraction> {
  const response = await callModel(BASE_PROMPT, image);
  const data = JSON.parse(response);

  // Normalize: if any value missing → "unknown"
  const normalize = (val: any) =>
    val === null || val === undefined || val === "" ? "unknown" : val;

  return {
    core: {
      color: normalize(data.core?.color),
      category: normalize(data.core?.category),
      neckline: normalize(data.core?.neckline),
      brand_and_tier: normalize(data.core?.brand_and_tier),
      sleeve_length: normalize(data.core?.sleeve_length),
      pattern: normalize(data.core?.pattern),
    },

    fit: {
      t_shirt_sleeve_length: normalize(data.fit?.t_shirt_sleeve_length),
      body_volume_ratio: normalize(data.fit?.body_volume_ratio),
      hemline_placement: normalize(data.fit?.hemline_placement),
      pant_stacking: normalize(data.fit?.pant_stacking),
      waist_visibility: normalize(data.fit?.waist_visibility),
      shoulder_structure: normalize(data.fit?.shoulder_structure),
      silhouette: normalize(data.fit?.silhouette),
    },

    fabric: {
      t_shirt_material: normalize(data.fabric?.t_shirt_material),
      fabric_weight: normalize(data.fabric?.fabric_weight),
      texture: normalize(data.fabric?.texture),
      denim_type: normalize(data.fabric?.denim_type),
    },
  };
}
