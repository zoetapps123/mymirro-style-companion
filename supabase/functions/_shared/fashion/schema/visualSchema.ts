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
  /**
   * FIT: Physical garment parameters
   * Describes how the outfit fits the body
   */
  fit: z.object({
    sleeve_length: field(z.enum(["mid-bicep", "elbow", "forearm", "unknown"])),
    shoulder_structure: field(z.enum(["natural", "dropped", "extended", "unknown"])),
    silhouette: field(z.enum(["boxy", "tapered", "wide", "straight", "oversized", "unknown"])),
    hemline: field(z.enum(["above_hip", "mid_hip", "below_hip", "unknown"])),
    waist_visibility: field(z.enum(["tucked", "partial_tuck", "untucked", "unknown"])),
    pant_stacking: field(z.enum(["none", "light", "medium", "heavy", "unknown"]))
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
    polish_level: field(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("unknown")]))
  }),
  /**
   * AESTHETICS: High-level style classification
   * Identifies overall style aesthetic and quality tier
   */
  aesthetics: z.object({
    cultural_aesthetic: field(z.enum(["kfashion", "jfashion", "western_streetwear", "classic", "quiet_luxury", "techwear", "unknown"])),
    brand_guess: field(z.string()),
    price_tier: field(z.enum(["fast_fashion", "mid_range", "premium", "luxury", "unknown"]))
  }),
  /**
   * SCORES: Numerical ratings (0-5 scale)
   * AI-generated scores for each component plus overall rating
   * Each score includes confidence and reasoning
   */
  scores: z.object({
    fit: field(z.number().min(0).max(5)),
    color: field(z.number().min(0).max(5)),
    styling: field(z.number().min(0).max(5)),
    material: field(z.number().min(0).max(5)),
    overall: field(z.number().min(1).max(5))
  }),
  /**
   * MISSING_FEATURES: Detection gaps
   * 
   * Array of strings listing features AI couldn't detect from the image.
   * Common reasons:
   * - Poor image quality/lighting
   * - Partial body crop (can't see shoes, full outfit)
   * - Obstructed view (arms crossed, sitting down)
   * 
   * Used by:
   * - buildMetadataContext: Adds low-confidence warnings
   * - StyleCheckHub: Shows "Limited visibility" in what_didnt_work
   * 
   * Example: ["footwear", "full hemline", "lower body"]
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
