export const WEIGHTS = {
  color: {
    black: 2,
    white: 1,
    navy: 1.5,
    grey: 1,
    default: 0,
  },

  // Existing
  category: { t_shirt: 1, shirt: 1.5, hoodie: 2 },
  neckline: { crew: 1, v: 1.2, polo: 1.5 },
  brand: { premium: 3, mid: 1.5, budget: 0.5 },

  // NEW FIT WEIGHTS
  t_shirt_sleeve_length: {
    "mid-bicep": 2,
    elbow: 1,
    forearm: 0.5,
  },
  body_volume_ratio: {
    balanced: 2,
    top_heavier: 1,
    bottom_heavier: 0.5,
  },
  hemline_placement: {
    mid_hip: 2,
    above_hip: 1,
    below_hip: 1,
  },
  pant_stacking: {
    light: 1.5,
    none: 1,
    heavy: 0.2,
  },
  waist_visibility: {
    tucked: 2,
    partial_tuck: 1.5,
    out: 0.5,
  },
  shoulder_structure: {
    natural: 2,
    dropped: 1,
    extended: 0.5,
  },
  silhouette: {
    boxy: 2,
    straight: 1,
    tapered: 1,
    wide: 1.2,
  },

  // NEW FABRIC WEIGHTS
  t_shirt_material: {
    cotton: 2,
    jersey: 1.5,
    tech: 1,
    knit: 1,
  },
  fabric_weight: {
    light: 2,
    mid: 1.5,
    heavy: 0.5,
  },
  texture: {
    matte: 2,
    smooth: 1.5,
    ribbed: 1,
    sheen: 0.5,
  },
  denim_type: {
    rigid: 2,
    washed: 1.5,
    raw: 1,
    stretch: 0.5,
  },
};
