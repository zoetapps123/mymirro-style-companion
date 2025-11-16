/**
 * visualSchema.ts
 * 
 * Role: Zod validation schema for outfit metadata extraction (API Call #2)
 * 
 * Used by: supabase/functions/score-outfit/index.ts
 * Purpose: Validates AI response from EXTRACTION_PROMPT to ensure type safety
 * 
 * Schema Structure:
 * - Every extracted field follows {value, confidence, reason?} pattern
 * - value: The actual detected value (enum or string)
 * - confidence: 0-1 score indicating AI's certainty
 * - reason: Optional explanation for the value
 * 
 * This structured format allows downstream code to:
 * 1. Filter low-confidence detections
 * 2. Provide transparency about AI uncertainty
 * 3. Debug extraction issues by reviewing reasons
 * 
 * Sections:
 * - fit: Physical garment parameters (silhouette, hemline, sleeves, etc.)
 * - fabric: Material properties (texture, weight, type)
 * - color: Color harmony and palette analysis
 * - styling: Overall styling choices (footwear, accessories, polish)
 * - aesthetics: High-level classification (style aesthetic, price tier)
 * - scores: Numerical ratings (0-5) for fit, color, styling, material, overall
 * - missing_features: Array of parameters AI couldn't detect from image
 */
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Helper: field()
 * 
 * Creates consistent schema for extracted fields with confidence tracking.
 * 
 * Why this pattern?
 * - Standardizes all extracted values to include confidence
 * - Enables filtering of low-confidence detections
 * - Provides optional reasoning for transparency
 * - Type-safe at compile time via Zod + TypeScript
 * 
 * Example usage:
 * sleeve_length: field(z.enum(["mid-bicep", "elbow", "forearm", "unknown"]))
 * 
 * Results in validation for:
 * { value: "mid-bicep", confidence: 0.85, reason: "Clearly visible in image" }
 */
const field = (value: z.ZodTypeAny) => z.object({
  value,
  confidence: z.number().min(0).max(1),
  reason: z.string().optional()
});

/**
 * Main Schema: VisualSchema
 * 
 * Validates complete outfit extraction response from EXTRACTION_PROMPT.
 * Each section represents different aspects of outfit analysis.
 */
export const VisualSchema = z.object({
  // ===================================
  // PART 1 & 3: GARMENT-LEVEL METADATA
  // ===================================
  garments: z.array(z.object({
    garment_type: field(z.enum(["top", "bottom", "outerwear", "dress", "shoes", "accessory", "unknown"])).optional(),
    garment_subtype: field(z.string()).optional(),
    sleeve_length: field(z.enum(["none", "sleeveless", "capped", "short", "elbow", "3/4th", "full", "unknown"])).optional(),
    neckline: field(z.string()).optional(),
    hemline: field(z.enum(["cropped", "mid-hip", "low-hip", "longline", "unknown"])).optional(),
    fit_type: field(z.enum(["oversized", "relaxed", "straight", "slim", "skinny", "unknown"])).optional(),
    wash_type: field(z.enum(["light", "mid", "dark", "raw_denim", "unknown"])).optional(),
    fabric_texture: field(z.enum(["smooth", "ribbed", "knit", "denim", "fleece", "unknown"])).optional(),
    color_primary: field(z.string()).optional(),
    color_secondary: field(z.string()).optional(),
    layering: field(z.enum(["yes", "no", "unknown"])).optional(),
    visibility: field(z.enum(["high", "medium", "low", "occluded", "not_visible", "unknown"])).optional(),
  })).optional(),
  
  footwear: z.object({
    type: field(z.string()).optional(),
    visibility: field(z.enum(["high", "medium", "low", "occluded", "not_visible", "unknown"])).optional(),
  }).optional(),

  // ACCESSORIES DETECTION (PART 1)
  accessories_present: z.object({
    neck: field(z.enum(["none", "necklace", "chain", "scarf", "unknown"])).optional(),
    wrist_left: field(z.enum(["none", "watch", "bracelet", "band", "unknown"])).optional(),
    wrist_right: field(z.enum(["none", "watch", "bracelet", "band", "unknown"])).optional(),
    ears: field(z.enum(["none", "earrings", "studs", "unknown"])).optional(),
    sunglasses: field(z.enum(["present", "absent", "unknown"])).optional(),
    belt: field(z.enum(["present", "absent", "unknown"])).optional(),
    hat: field(z.enum(["present", "absent", "unknown"])).optional(),
    bag: field(z.enum(["present", "absent", "unknown"])).optional(),
    rings: field(z.enum(["present", "absent", "unknown"])).optional(),
  }).optional(),

  // BODY VISIBILITY (PART 1)
  body_visibility: z.object({
    person_detected: field(z.boolean()),
    upper_body_visible: field(z.enum(["high", "medium", "low", "not_visible"])),
    lower_body_visible: field(z.enum(["high", "medium", "low", "not_visible"])),
    arms_visible: field(z.enum(["high", "medium", "low", "not_visible"])),
    wrists_visible: field(z.enum(["high", "medium", "low", "not_visible"])),
    legs_visible: field(z.enum(["high", "medium", "low", "not_visible"])),
  }).optional(),

  // SCENE CONTEXT (PART 1)
  scene_context: z.object({
    environment: field(z.enum(["indoor", "outdoor", "unknown"])).optional(),
    setting: field(z.enum(["travel", "party", "street", "casual", "formal", "unknown"])).optional(),
    weather_inference: field(z.enum(["hot", "humid", "mild_winter", "cool", "unknown"])).optional(),
  }).optional(),

  // ===================================
  // LEGACY FIT ANALYSIS (backward compatibility)
  // ===================================
  fit: z.object({
    top_sleeve_length: field(z.enum(["sleeveless", "cap_sleeve", "short", "elbow", "three_quarter", "full", "unknown"])),
    bottom_length: field(z.enum(["shorts", "knee", "midi", "ankle", "maxi", "floor", "unknown"])),
    top_fit: field(z.enum(["oversized", "relaxed", "regular", "slim", "fitted", "bodycon", "unknown"])),
    bottom_fit: field(z.enum(["wide", "straight", "tapered", "slim", "skinny", "unknown"])),
    pant_stacking: field(z.enum(["none", "light", "medium", "heavy", "unknown"])).optional(),
    hemline: field(z.enum(["above_hip", "at_hip", "mid_hip", "low_hip", "below_hip", "unknown"])).optional(),
    waist_visibility: field(z.enum(["hidden", "partial_tuck", "tucked", "untucked", "layered", "unknown"])).optional(),
    top_type: field(z.enum(["tshirt", "shirt", "sweatshirt", "sweater", "jacket", "unknown"])).optional(),
    pant_hem_style: field(z.enum(["none", "single_cuff", "double_cuff", "raw_hem", "cropped", "stacked", "unknown"])).optional(),
    sleeve_length: field(z.enum(["mid-bicep", "elbow", "forearm", "unknown"])).optional(),
    shoulder_structure: field(z.enum(["natural", "dropped", "extended", "unknown"])).optional(),
    silhouette: field(z.enum(["boxy", "tapered", "wide", "straight", "oversized", "unknown"])).optional(),
  }),
  /**
   * FABRIC: Material properties
   * Analyzes fabric type, texture, and quality
   */
  fabric: z.object({
    tshirt_material: field(z.enum(["cotton", "jersey", "knit", "tech", "silk_blend", "unknown"])),
    tshirt_weight: field(z.enum(["light", "mid", "heavy", "unknown"])),
    tshirt_texture: field(z.enum(["smooth", "ribbed", "matte", "sheen", "unknown"])),
    denim_type: field(z.enum(["rigid", "stretch", "washed", "raw", "unknown"]))
  }),
  /**
   * COLOR: Color analysis
   * Evaluates color harmony, contrast, and palette
   */
  color: z.object({
    top_color: field(z.string()),
    bottom_color: field(z.string()),
    harmony: field(z.enum(["monochrome", "analogous", "complementary", "contrasting", "clashing", "unknown"])),
    color_confidence: z.number()
  }),
  /**
   * STYLING: Overall styling choices
   * Captures accessories, footwear, layering, and polish level
   */
  styling: z.object({
    footwear_type: field(z.enum(["sneakers", "loafers", "boots", "heels", "sandals", "unknown"])),
    accessory_presence: field(z.enum(["none", "minimal", "moderate", "heavy", "unknown"])),
    layering_present: field(z.union([z.boolean(), z.literal("unknown")])),
    polish_level: field(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("unknown")])),
    wrist_left: field(z.enum(["none", "watch", "bracelet", "unknown"])).optional(),
    wrist_right: field(z.enum(["none", "watch", "bracelet", "unknown"])).optional(),
    accessories: z.object({
      sunglasses: field(z.enum(["present", "absent", "unknown"])).optional(),
      belt: field(z.enum(["present", "absent", "unknown"])).optional(),
      necklace: field(z.enum(["present", "absent", "unknown"])).optional(),
      rings: field(z.enum(["present", "absent", "unknown"])).optional(),
      hat: field(z.enum(["present", "absent", "unknown"])).optional(),
      bag: field(z.enum(["present", "absent", "unknown"])).optional()
    }).optional()
  }),
  /**
   * AESTHETICS: High-level style classification
   * Identifies overall style aesthetic and quality tier
   */
  aesthetics: z.object({
    cultural_aesthetic: field(z.enum(["kfashion", "jfashion", "western_streetwear", "classic", "quiet_luxury", "techwear", "boho", "preppy", "minimalist", "athleisure", "vintage", "grunge", "romantic", "edgy", "unknown"])),
    brand_guess: field(z.string()),
    price_tier: field(z.enum(["fast_fashion", "mid_range", "premium", "luxury", "unknown"]))
  }),
  /**
   * SCORES: PART 2 - Enhanced with new score categories
   */
  scores: z.object({
    overall: field(z.number().min(0).max(5)),
    fit: field(z.number().min(0).max(5)),
    color: field(z.number().min(0).max(5)),
    proportion: field(z.number().min(0).max(5)).optional(),
    layering: field(z.number().min(0).max(5)).optional(),
    texture: field(z.number().min(0).max(5)),
    occasion_alignment: field(z.number().min(0).max(5)),
    styling: field(z.number().min(0).max(5)).optional(),
    material: field(z.number().min(0).max(5)).optional(),
  }),
  /**
   * USER_PROFILE: Transient wearer context (in-memory only, NOT stored in DB)
   * 
   * Phase 1 Addition: Inferred from image when person is clearly visible.
   * Used to provide context-aware scoring (fit on body shape, color on skin tone).
   * 
   * IMPORTANT:
   * - This is NEVER persisted to style_checks table or user_profiles
   * - Only used in-memory for scoring and metadataContext generation
   * - All fields default to "unknown" if person not visible or unclear
   * 
   * Purpose: Judge how outfit works on THIS wearer, not stereotype the person
   */
  user_profile: z.object({
    body_shape: field(z.enum([
      "rectangle", "pear", "apple", "hourglass", "inverted_triangle", "straight", "unknown"
    ])),
    height_band: field(z.enum(["short", "average", "tall", "unknown"])),
    build: field(z.enum(["slim", "average", "athletic", "plus", "curvy", "unknown"])),
    skin_tone_band: field(z.enum([
      "very_fair", "fair", "medium", "wheatish", "tan", "deep", "unknown"
    ])),
    perceived_age_band: field(z.enum(["teen", "20s", "30s", "40s_plus", "unknown"])),
    gender_expression: field(z.enum(["masculine", "feminine", "androgynous", "unknown"])),
    face_visible: field(z.union([z.boolean(), z.literal("unknown")]))
  }).optional(),
  
  /**
   * MISSING_FEATURES: Detection gaps (Phase 1: explicit rules)
   * 
   * Array of lowercase snake_case strings indicating visually missing or non-visible parts.
   * 
   * Phase 1 Enhancement: Explicit rules for what qualifies as "missing":
   * - Only include features that are PHYSICALLY NOT VISIBLE in the image
   * - Do NOT include things that simply aren't part of the outfit
   * 
   * Valid values:
   * - "footwear_not_visible" - feet cropped out or hidden
   * - "lower_garment_not_visible" - bottom half cropped
   * - "upper_garment_not_visible" - top half cropped
   * - "accessories_not_visible" - hands/neck hidden, can't see jewelry
   * - "face_not_visible" - face cropped or turned away
   * - "full_body_not_visible" - only partial body shown
   * - "details_obscured_by_lighting" - poor lighting obscures details
   * - "details_obscured_by_angle" - image angle hides key features
   * 
   * INVALID (do not include):
   * - "no_accessories_worn" - this is styling choice, not missing
   * - Duplicates of "unknown" values already in structured fields
   * 
   * Used by:
   * - buildMetadataContext: Generates visibility warnings
   * - StyleCheckHub: Shows "Limited visibility: ..." in what_didnt_work
   * 
   * Example: ["footwear_not_visible", "face_not_visible"]
   */
  missing_features: z.array(z.string())
});

/**
 * Type Export: VisualData
 * 
 * TypeScript type inferred from VisualSchema for type-safe usage.
 * Use this type when working with validated extraction data.
 */
export type VisualData = z.infer<typeof VisualSchema>;
