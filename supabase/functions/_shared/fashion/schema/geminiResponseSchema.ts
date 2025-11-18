/**
 * geminiResponseSchema.ts
 * 
 * Simplified, flat schema for Gemini structured output (response_schema)
 * 
 * Key changes from VisualSchema:
 * - NO {value, confidence} wrappers (too complex for Gemini)
 * - Direct string/number/boolean types
 * - Flatter structure (reduced nesting)
 * - All fields required for frontend + constraint logic
 * - Strict enums for validation
 * 
 * This schema is passed to Gemini API's response_schema parameter
 * to guarantee correct JSON structure output.
 */

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "overall_score",
    "components",
    "outfit_name",
    "what_works",
    "what_doesnt_work",
    "quick_fixes",
    "editorial",
    "fit",
    "fabric",
    "color",
    "styling",
    "body_visibility",
    "aesthetics"
  ],
  properties: {
    // ===================================
    // CORE SCORES
    // ===================================
    overall_score: {
      type: "number",
      minimum: 0,
      maximum: 5,
      description: "Overall outfit rating (0-5)"
    },
    
    // Component scores - simplified structure
    components: {
      type: "object",
      required: ["fit", "color", "styling", "material"],
      properties: {
        fit: {
          type: "object",
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 5 },
            reason: { type: "string", maxLength: 200 }
          }
        },
        color: {
          type: "object",
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 5 },
            reason: { type: "string", maxLength: 200 }
          }
        },
        styling: {
          type: "object",
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 5 },
            reason: { type: "string", maxLength: 200 }
          }
        },
        material: {
          type: "object",
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 5 },
            reason: { type: "string", maxLength: 200 }
          }
        }
      }
    },

    // ===================================
    // FEEDBACK ARRAYS
    // ===================================
    outfit_name: {
      type: "string",
      minLength: 5,
      maxLength: 50,
      description: "Creative name for the outfit"
    },
    
    what_works: {
      type: "array",
      items: { type: "string", maxLength: 150 },
      minItems: 2,
      maxItems: 5,
      description: "Positive aspects of the outfit"
    },
    
    what_doesnt_work: {
      type: "array",
      items: { type: "string", maxLength: 150 },
      minItems: 1,
      maxItems: 4,
      description: "Areas that need improvement"
    },
    
    quick_fixes: {
      type: "array",
      items: { type: "string", maxLength: 100 },
      minItems: 3,
      maxItems: 6,
      description: "Actionable tips (12-15 words each)"
    },
    
    editorial: {
      type: "string",
      minLength: 80,
      maxLength: 300,
      description: "Supportive summary (25-45 words)"
    },

    // ===================================
    // EXTRACTION - FIT ANALYSIS
    // ===================================
    fit: {
      type: "object",
      required: ["top_sleeve_length", "bottom_length", "top_fit", "bottom_fit", "silhouette"],
      properties: {
        top_sleeve_length: {
          type: "string",
          enum: ["sleeveless", "cap_sleeve", "short", "elbow", "three_quarter", "full", "unknown"]
        },
        bottom_length: {
          type: "string",
          enum: ["shorts", "knee", "midi", "ankle", "maxi", "floor", "unknown"]
        },
        top_fit: {
          type: "string",
          enum: ["oversized", "relaxed", "regular", "slim", "fitted", "bodycon", "unknown"]
        },
        bottom_fit: {
          type: "string",
          enum: ["wide", "straight", "tapered", "slim", "skinny", "unknown"]
        },
        silhouette: {
          type: "string",
          enum: ["boxy", "tapered", "wide", "straight", "oversized", "unknown"]
        },
        pant_stacking: {
          type: "string",
          enum: ["none", "light", "medium", "heavy", "unknown"]
        },
        hemline: {
          type: "string",
          enum: ["above_hip", "at_hip", "mid_hip", "low_hip", "below_hip", "unknown"]
        },
        waist_visibility: {
          type: "string",
          enum: ["hidden", "partial_tuck", "tucked", "untucked", "layered", "unknown"]
        },
        top_type: {
          type: "string",
          enum: ["tshirt", "shirt", "sweatshirt", "sweater", "jacket", "unknown"]
        },
        pant_hem_style: {
          type: "string",
          enum: ["none", "single_cuff", "double_cuff", "raw_hem", "cropped", "stacked", "unknown"]
        }
      }
    },

    // ===================================
    // EXTRACTION - FABRIC
    // ===================================
    fabric: {
      type: "object",
      required: ["tshirt_material", "tshirt_weight", "tshirt_texture", "denim_type"],
      properties: {
        tshirt_material: {
          type: "string",
          enum: ["cotton", "jersey", "knit", "tech", "silk_blend", "unknown"]
        },
        tshirt_weight: {
          type: "string",
          enum: ["light", "mid", "heavy", "unknown"]
        },
        tshirt_texture: {
          type: "string",
          enum: ["smooth", "ribbed", "matte", "sheen", "unknown"]
        },
        denim_type: {
          type: "string",
          enum: ["rigid", "stretch", "washed", "raw", "unknown"]
        }
      }
    },

    // ===================================
    // EXTRACTION - COLOR
    // ===================================
    color: {
      type: "object",
      required: ["top_color", "bottom_color", "harmony", "color_confidence"],
      properties: {
        top_color: { type: "string", maxLength: 50 },
        bottom_color: { type: "string", maxLength: 50 },
        harmony: {
          type: "string",
          enum: ["monochrome", "analogous", "complementary", "contrasting", "clashing", "unknown"]
        },
        color_confidence: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        contrast_level: {
          type: "string",
          enum: ["low", "medium", "high", "unknown"]
        }
      }
    },

    // ===================================
    // EXTRACTION - STYLING
    // ===================================
    styling: {
      type: "object",
      required: ["footwear_type", "accessory_presence", "polish_level"],
      properties: {
        footwear_type: {
          type: "string",
          enum: ["sneakers", "loafers", "boots", "heels", "sandals", "unknown"]
        },
        accessory_presence: {
          type: "string",
          enum: ["none", "minimal", "moderate", "heavy", "unknown"]
        },
        layering_present: { type: "boolean" },
        polish_level: {
          type: "number",
          minimum: 1,
          maximum: 5
        }
      }
    },

    // ===================================
    // EXTRACTION - BODY VISIBILITY
    // ===================================
    body_visibility: {
      type: "object",
      required: ["person_detected", "upper_body_visible", "lower_body_visible", "arms_visible", "wrists_visible", "legs_visible"],
      properties: {
        person_detected: { type: "boolean" },
        upper_body_visible: {
          type: "string",
          enum: ["high", "medium", "low", "not_visible"]
        },
        lower_body_visible: {
          type: "string",
          enum: ["high", "medium", "low", "not_visible"]
        },
        arms_visible: {
          type: "string",
          enum: ["high", "medium", "low", "not_visible"]
        },
        wrists_visible: {
          type: "string",
          enum: ["high", "medium", "low", "not_visible"]
        },
        legs_visible: {
          type: "string",
          enum: ["high", "medium", "low", "not_visible"]
        }
      }
    },

    // ===================================
    // AESTHETICS (for constraint logic)
    // ===================================
    aesthetics: {
      type: "object",
      required: ["proportion_balance", "silhouette_desc"],
      properties: {
        proportion_balance: {
          type: "string",
          enum: ["balanced", "top_heavy", "bottom_heavy", "unknown"]
        },
        silhouette_desc: { type: "string", maxLength: 200 }
      }
    },

    // ===================================
    // OPTIONAL: WARDROBE OPPORTUNITIES
    // ===================================
    wardrobe_opportunities: {
      type: "array",
      items: { type: "string", maxLength: 150 },
      description: "Wardrobe-aware suggestions if user wardrobe provided"
    },

    // ===================================
    // CONSTRAINT DETECTION
    // ===================================
    constraints: {
      type: "object",
      properties: {
        sleeves_rollable: { type: "boolean" },
        hem_tuckable: { type: "boolean" },
        bottom_wash_specific: { type: "string", maxLength: 50 }
      }
    }
  }
};
