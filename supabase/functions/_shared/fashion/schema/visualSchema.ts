import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const field = (value: z.ZodTypeAny) => z.object({
  value,
  confidence: z.number().min(0).max(1),
  reason: z.string().optional()
});

export const VisualSchema = z.object({
  fit: z.object({
    sleeve_length: field(z.enum(["mid-bicep", "elbow", "forearm", "unknown"])),
    shoulder_structure: field(z.enum(["natural", "dropped", "extended", "unknown"])),
    silhouette: field(z.enum(["boxy", "tapered", "wide", "straight", "oversized", "unknown"])),
    hemline: field(z.enum(["above_hip", "mid_hip", "below_hip", "unknown"])),
    waist_visibility: field(z.enum(["tucked", "partial_tuck", "untucked", "unknown"])),
    pant_stacking: field(z.enum(["none", "light", "medium", "heavy", "unknown"]))
  }),
  fabric: z.object({
    tshirt_material: field(z.enum(["cotton", "jersey", "knit", "tech", "silk_blend", "unknown"])),
    tshirt_weight: field(z.enum(["light", "mid", "heavy", "unknown"])),
    tshirt_texture: field(z.enum(["smooth", "ribbed", "matte", "sheen", "unknown"])),
    denim_type: field(z.enum(["rigid", "stretch", "washed", "raw", "unknown"]))
  }),
  color: z.object({
    top_color: field(z.string()),
    bottom_color: field(z.string()),
    harmony: field(z.enum(["monochrome", "analogous", "complementary", "contrasting", "clashing", "unknown"])),
    color_confidence: z.number()
  }),
  styling: z.object({
    footwear_type: field(z.enum(["sneakers", "loafers", "boots", "heels", "sandals", "unknown"])),
    accessory_presence: field(z.enum(["none", "minimal", "moderate", "heavy", "unknown"])),
    layering_present: field(z.union([z.boolean(), z.literal("unknown")])),
    polish_level: field(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("unknown")]))
  }),
  aesthetics: z.object({
    cultural_aesthetic: field(z.enum(["kfashion", "jfashion", "western_streetwear", "classic", "quiet_luxury", "techwear", "unknown"])),
    brand_guess: field(z.string()),
    price_tier: field(z.enum(["fast_fashion", "mid_range", "premium", "luxury", "unknown"]))
  }),
  scores: z.object({
    fit: field(z.number().min(0).max(5)),
    color: field(z.number().min(0).max(5)),
    styling: field(z.number().min(0).max(5)),
    material: field(z.number().min(0).max(5)),
    overall: field(z.number().min(1).max(5))
  }),
  missing_features: z.array(z.string())
});

export type VisualData = z.infer<typeof VisualSchema>;
