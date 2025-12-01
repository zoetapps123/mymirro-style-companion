export interface ExtractedFashionFeatures {
  color: string;
  category: string;
  neckline: string;
  brand_and_tier: string | "unknown";
  sleeve_length: string;
  pattern: string;
}

export interface FitAttributes {
  t_shirt_sleeve_length: string;
  body_volume_ratio: string;
  hemline_placement: string;
  pant_stacking: string;
  waist_visibility: string;
  shoulder_structure: string;
  silhouette: string;
}

export interface FabricAttributes {
  t_shirt_material: string;
  fabric_weight: string;
  texture: string;
  denim_type: string;
}

export interface FullExtraction {
  core: ExtractedFashionFeatures;
  fit: FitAttributes;
  fabric: FabricAttributes;
}
