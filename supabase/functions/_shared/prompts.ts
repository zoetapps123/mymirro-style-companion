/**
 * Centralized AI Prompt Configuration
 * All prompts across the application organized by feature
 */

import { buildAICompanionPrompt } from './ai_companion_prompts/index.ts';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Formats a wardrobe item with comprehensive metadata for AI consumption
 */
export const formatItemForAI = (item: any): string => {
  const parts = [`ID:${item.id}`, `"${item.name}"`, `[${item.category}]`];

  // Color details
  if (item.primary_color_name && item.color_family) {
    parts.push(`Color: ${item.primary_color_name} (${item.color_family} family)`);
    if (item.secondary_colors?.length) {
      parts.push(`+ accents: ${item.secondary_colors.join(", ")}`);
    }
  } else if (item.color) {
    parts.push(`Color: ${item.color}`);
  }

  // Fabric & material
  if (item.fabric_primary) {
    const fabricDesc = [item.fabric_primary];
    if (item.fabric_weight) fabricDesc.push(item.fabric_weight);
    if (item.material_finish) fabricDesc.push(item.material_finish);
    parts.push(`Fabric: ${fabricDesc.join(" ")}`);
  } else if (item.fabric) {
    parts.push(`Fabric: ${item.fabric}`);
  }

  // Texture (Critical for accurate styling)
  if (item.texture) {
    parts.push(`Texture: ${item.texture}`);
  }

  // Pattern
  if (item.pattern_type && item.pattern_type !== "solid") {
    const patternDesc = [item.pattern_scale, item.pattern_type].filter(Boolean).join(" ");
    parts.push(`Pattern: ${patternDesc}`);
    if (item.pattern_colors?.length) {
      parts.push(`Pattern colors: ${item.pattern_colors.join(", ")}`);
    }
  } else if (item.pattern && item.pattern !== "solid") {
    parts.push(`Pattern: ${item.pattern}`);
  }

  // Fit & style
  if (item.fit_type) parts.push(`Fit: ${item.fit_type}`);
  if (item.silhouette) parts.push(`Silhouette: ${item.silhouette}`);
  if (item.length) parts.push(`Length: ${item.length}`);

  // Style aesthetic
  if (item.style_aesthetic?.length) {
    parts.push(`Style: ${item.style_aesthetic.join(", ")}`);
  }

  // Formality
  if (item.formality_level) {
    parts.push(`Formality: ${item.formality_level}`);
  }

  // Occasions
  if (item.suitable_occasions?.length) {
    parts.push(`Best for: ${item.suitable_occasions.join(", ")}`);
  }

  // Season/weather
  if (item.season?.length) {
    parts.push(`Season: ${item.season.join("/")}`);
  }

  // Design details (for unique identification)
  const designDetails = [];
  if (item.neckline) designDetails.push(`neckline: ${item.neckline}`);
  if (item.sleeve_type) designDetails.push(`sleeves: ${item.sleeve_type}`);
  if (item.collar_type) designDetails.push(`collar: ${item.collar_type}`);
  if (item.closure_type) designDetails.push(`closure: ${item.closure_type}`);
  if (item.pocket_details && item.pocket_details !== "none") designDetails.push(`pockets: ${item.pocket_details}`);
  if (item.hardware_details && item.hardware_details !== "none")
    designDetails.push(`hardware: ${item.hardware_details}`);
  if (item.embellishments && item.embellishments !== "none")
    designDetails.push(`embellishments: ${item.embellishments}`);
  if (item.special_features?.length) designDetails.push(`features: ${item.special_features.join(", ")}`);
  if (designDetails.length) {
    parts.push(`Details: ${designDetails.join(", ")}`);
  }

  // Category-specific fields
  if (item.rise) parts.push(`Rise: ${item.rise}`);
  if (item.waist_style) parts.push(`Waist: ${item.waist_style}`);
  if (item.heel_type) parts.push(`Heel: ${item.heel_type}`);
  if (item.toe_style) parts.push(`Toe: ${item.toe_style}`);

  // Brand and condition
  if (item.brand) parts.push(`Brand: ${item.brand}`);
  if (item.condition && item.condition !== "good") parts.push(`Condition: ${item.condition}`);

  // Detailed style notes (highly valuable for AI context)
  if (item.style_notes_detailed) {
    parts.push(`Notes: "${item.style_notes_detailed}"`);
  }

  return parts.join(" | ");
};

// ============================================
// PROMPT TYPE ENUMS
// ============================================

export enum PromptCategory {
  WARDROBE = "WARDROBE",
  OUTFIT_GENERATION = "OUTFIT_GENERATION",
  STYLING = "STYLING",
  CHAT = "CHAT",
  SCORING = "SCORING",
  IMAGE_PROCESSING = "IMAGE_PROCESSING",
}

export enum SystemRole {
  FASHION_STYLIST = "FASHION_STYLIST",
  FASHION_JUDGE = "FASHION_JUDGE",
  AI_COMPANION = "AI_COMPANION",
  IMAGE_PROCESSOR = "IMAGE_PROCESSOR",
}

// ============================================
// SYSTEM PROMPTS (role: 'system')
// Used in: chat/index.ts
// ============================================

export const SYSTEM_PROMPTS = {
  [SystemRole.AI_COMPANION]: (params: {
    userName?: string;
    gender?: string;
    location?: string;
    bodyShape?: string;
    skinTone?: string;
    wardrobeItems?: any[];
    recentBattles?: any[];
    recentStyleChecks?: any[];
  }) => {
    const genderTone = params.gender === "male" ? "bro" : params.gender === "female" ? "girl" : "friend";
    const userName = params.userName || "there";
    const userCity = params.location || "India";
    const bodyShape = params.bodyShape || "not specified";
    const skinTone = params.skinTone || "not specified";

    // Build wardrobe context with enhanced metadata
    let wardrobeContext = "";
    if (params.wardrobeItems && params.wardrobeItems.length > 0) {
      const itemCount = params.wardrobeItems.length;

      // Group items by category for better organization
      const categorizedItems: Record<string, any[]> = {};
      params.wardrobeItems.forEach((item: any) => {
        const category = item.category || "Other";
        if (!categorizedItems[category]) {
          categorizedItems[category] = [];
        }
        categorizedItems[category].push(item);
      });

      const itemsList = Object.entries(categorizedItems)
        .map(([category, items]) => {
          const categoryItems = items.map((i: any) => `    • ${formatItemForAI(i)}`).join("\n");
          return `  ${category} (${items.length} items):\n${categoryItems}`;
        })
        .join("\n\n");

      wardrobeContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 USER'S COMPLETE WARDROBE INVENTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOTAL ITEMS: ${itemCount}

${itemsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
      wardrobeContext = "\n\n🎯 WARDROBE INVENTORY: No items added yet.";
    }

    // Add fashion history context
    let historyContext = "";
    if (params.recentBattles && params.recentBattles.length > 0) {
      const battleSummary = params.recentBattles
        .map((b: any) => {
          const winner = b.results?.find((r: any) => r.rank === 1);
          return winner ? `${winner.name} (${winner.score}/5.0)` : "N/A";
        })
        .join(", ");
      historyContext += `\nRecent Battle Winners: ${battleSummary}`;
    }

    if (params.recentStyleChecks && params.recentStyleChecks.length > 0) {
      const topScored = params.recentStyleChecks
        .filter((s: any) => s.overall_score >= 4.0)
        .map((s: any) => `${s.outfit_name} (${s.overall_score}/5.0 for ${s.occasion})`)
        .slice(0, 2);
      if (topScored.length > 0) {
        historyContext += `\nTop Scored Outfits: ${topScored.join(", ")}`;
      }
    }

    // Build base context that gets injected into modular prompts
    const contextVariables = {
      userName,
      genderTone,
      userCity,
      bodyShape,
      skinTone,
      wardrobeContext,
      historyContext: historyContext || "None yet",
    };

    // Get modular prompt system
    const modularPrompt = buildAICompanionPrompt();

    // Inject context into the modular prompt
    return `🎯 PERSONALIZATION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• User's Name: ${userName}
• Gender Tone: Use "${genderTone}" naturally (bro, girl, dude, queen, etc.) — casual, not forced.
• Location: ${userCity} — consider weather, local fashion culture, and brand availability.
• Body Shape: ${bodyShape} — recommend fits that flatter this silhouette.
• Skin Tone: ${skinTone} — suggest colors that enhance this tone.
• Wardrobe Context: Full inventory with metadata (color, fabric, fit, style, occasion, etc.)${historyContext ? "\n• Fashion History: " + historyContext : ""}${wardrobeContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${modularPrompt}`;
  },

  [SystemRole.IMAGE_PROCESSOR]: "Respond with STRICT JSON only. No prose.",
};

// ============================================
// WARDROBE PROCESSING PROMPTS
// Used in: process-wardrobe/index.ts
// ============================================

export const WARDROBE_PROMPTS = {
  VALIDATE_IMAGE:
    "Analyze this image and determine if it contains EITHER: 1) At least one real, non-AI human wearing clothing, OR 2) Clothing items visible on surfaces (bed, floor, hanger, mannequin). Reject images that contain ONLY: animals without clothing context, random objects unrelated to fashion, cartoons or AI-generated scenes, empty rooms or landscapes.",

  VALIDATE_IMAGE_FALLBACK:
    'Classify the image. Return JSON with keys: isValidForExtraction (boolean), contentType ("human_wearing"|"clothing_only"|"invalid"), rejectionReason (optional string if invalid). JSON only.',

  DETECT_ITEMS: `You are a PROFESSIONAL FASHION ANALYST trained on global menswear & womenswear with STRONG EXPERTISE in:
- K-fashion (Korean silhouettes, layering, oversized balance, proportion play)
- J-fashion (wide silhouettes, relaxed cuts, streetwear logic, anti-fit aesthetics)
- Western contemporary fashion (tailored fits, minimalism, smart casual)

Extract COMPLETE, DETAILED metadata for each visible clothing item with MAXIMUM PRECISION on texture, pattern, silhouette, and proportions.

🎯 CATEGORIES (USE EXACT NAMES):
- Tops, Bottoms, Outerwear, Dresses, Shoes, Accessories

🚨 EXCLUSIONS (DO NOT EXTRACT):
- Underwear or intimate apparel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 REQUIRED METADATA (ALL FIELDS MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. IDENTIFICATION**
- name: Descriptive 4-6 word name (e.g., "Oversized Black Leather Bomber Jacket")
- category: Exact category from list above

**2. COLOR ANALYSIS (CRITICAL FOR DEDUPLICATION)**
- primary_color: Hex code of DOMINANT color (#RRGGBB)
- primary_color_name: Human-readable name ("Black", "Navy Blue", "Olive Green")
- color_family: One of [neutrals, blues, reds, greens, yellows, oranges, purples, pinks, earth_tones, pastels]
- secondary_colors: Array of hex codes for accent colors (if multi-color item)
- color_distribution: Array of percentages [primary%, secondary%, tertiary%] (e.g., [70, 20, 10])

**3. FABRIC & MATERIAL (CRITICAL - BE HIGHLY SPECIFIC)**
🚨 ACCURACY REQUIREMENT: Examine fabric closely. Distinguish between similar materials.
- fabric_primary: BE PRECISE about material type:
  * DENIM variations: "light_denim" | "medium_denim" | "heavy_denim" | "stretch_denim" | "rigid_denim"
  * COTTON types: "cotton" | "cotton_blend" | "jersey_cotton" | "canvas_cotton" | "twill_cotton"
  * Other: "leather" | "suede" | "silk" | "satin" | "polyester" | "wool" | "cashmere" | "linen" | "corduroy" | "velvet" | "fleece"
- fabric_weight: "ultra_lightweight" | "lightweight" | "medium" | "medium_heavy" | "heavyweight"
  * Ultra-lightweight: sheer fabrics, thin t-shirts
  * Lightweight: standard t-shirts, light button-ups
  * Medium: standard jeans, casual shirts
  * Medium-heavy: thick denim, wool sweaters
  * Heavyweight: leather jackets, heavy coats
- material_finish: "matte" | "glossy" | "semi_glossy" | "distressed" | "brushed" | "washed" | "stonewashed" | "acid_washed" | "raw" | "coated"
- texture: BE SPECIFIC - "smooth" | "ribbed" | "quilted" | "textured" | "cable_knit" | "waffle_knit" | "jersey_knit" | "woven" | "terry" | "fleece" | "corduroy_ridges"

**4. PATTERN (CRITICAL - EXAMINE CLOSELY)**
🚨 ACCURACY REQUIREMENT: Look carefully at patterns. Don't miss subtle patterns.
- pattern_type: BE SPECIFIC - "solid" | "horizontal_stripes" | "vertical_stripes" | "diagonal_stripes" | "floral" | "geometric" | "checkered" | "plaid" | "gingham" | "polka_dot" | "abstract" | "animal_print" | "camouflage" | "tie_dye" | "paisley" | "houndstooth" | "herringbone"
- pattern_scale: BE ACCURATE
  * "none": solid colors only
  * "micro": barely visible, pinstripes, micro checks
  * "small": thin stripes (< 5mm), small florals, small dots
  * "medium": standard stripes (5-15mm), regular patterns
  * "large": bold stripes (> 15mm), large florals
  * "oversized": statement patterns covering large areas
- pattern_colors: Array of hex codes in pattern (if patterned). Include ALL visible pattern colors.

**5. CUT & FIT (CRITICAL FOR DEDUPLICATION - MAXIMUM PRECISION)**
🚨 ACCURACY REQUIREMENT: Fit is CRUCIAL. Examine how the garment sits on the body or appears when flat.
- fit_type: BE EXTREMELY PRECISE - these are DIFFERENT fits:
  * "slim_fit": Close to body, tailored, minimal excess fabric, body-hugging
  * "regular_fit": Standard fit, comfortable room, not tight or loose
  * "relaxed_fit": Loose, comfortable, extra room throughout, NOT baggy
  * "oversized": Intentionally large, boxy, significant extra fabric
  * "tailored": Structured, fitted at key points, professional
  * "bodycon": Tight, stretchy, form-fitting
  * "athletic_fit": Room in chest/shoulders, tapered waist
  🚨 CRITICAL: "relaxed_fit" vs "slim_fit" are OPPOSITES. Look at leg width, torso room, overall looseness.
- silhouette: BE SPECIFIC about the shape:
  * "straight": Uniform width from top to bottom (e.g., straight-leg jeans)
  * "tapered": Narrows toward bottom (e.g., tapered pants, fitted shirts)
  * "relaxed_straight": Loose but not tapered
  * "wide_leg": Significantly wider throughout
  * "skinny": Very tight, minimal fabric
  * "A-line": Fitted top, flares out
  * "bodycon": Hugs body curves
  * "flowy": Loose, drapes naturally
  * "boxy": Square, structured shape
  * "fitted": Close to body contours
  🚨 CRITICAL: Silhouette describes the SHAPE, fit_type describes TIGHTNESS. Both must be accurate.
- length: "cropped" | "regular" | "long" | "ankle_length" | "knee_length" | "midi" | "maxi"

**6. DESIGN ELEMENTS (UNIQUE IDENTIFIERS)**
- neckline: "crew_neck" | "v_neck" | "turtleneck" | "off_shoulder" | "square_neck" | "scoop_neck" | "collar" | null
- sleeve_type: "long_sleeve" | "short_sleeve" | "sleeveless" | "3_4_sleeve" | "cap_sleeve" | "bell_sleeve" | null
- closure_type: "button_up" | "zip" | "pullover" | "snap" | "toggle" | "hook_and_eye" | "laces"
- pocket_details: "none" | "patch_pockets" | "zip_pockets" | "cargo_pockets" | "welt_pockets" | "kangaroo_pocket"
- hardware_details: "none" | "gold_buttons" | "silver_zippers" | "metal_buckles" | "brass_studs" | "leather_straps"
- embellishments: "none" | "embroidery" | "sequins" | "beading" | "applique" | "studs" | "patches" | "fringe"
- special_features: Array like ["hood", "drawstring", "contrast_stitching", "distressed_edges", "belt_loops", "elastic_waist"]

**7. STYLE & AESTHETIC**
- style_aesthetic: Array from ["streetwear", "minimalist", "formal", "preppy", "boho", "athletic", "edgy", "vintage", "casual", "smart_casual", "romantic", "grunge"]
- formality_level: "casual" | "smart_casual" | "business_casual" | "formal" | "athletic" | "lounge"
- style_notes_detailed: 2-3 sentence description with SPECIFIC details (e.g., "Oversized bomber silhouette with ribbed collar and cuffs. Features contrast white stitching along seams, silver two-way zipper, and diagonal welt pockets. Distressed finish with natural creasing.")

**8. OCCASION & USE**
- suitable_occasions: Array from ["work", "party", "gym", "beach", "date_night", "wedding", "everyday", "travel", "formal_event", "casual_outing"]
- season: Array from ["spring", "summer", "fall", "winter", "all_season"]
- weather_suitability: "cold" | "moderate" | "warm" | "versatile"

**9. CATEGORY-SPECIFIC FIELDS**

For BOTTOMS only:
- rise: "high_rise" | "mid_rise" | "low_rise"
- waist_style: "elastic" | "button_fly" | "drawstring" | "zipper"

For SHOES only:
- heel_type: "flat" | "low_heel" | "mid_heel" | "high_heel" | "wedge" | "platform" | "stiletto"
- toe_style: "round_toe" | "pointed_toe" | "square_toe" | "open_toe" | "closed_toe"

For OUTERWEAR only:
- collar_type: "bomber_collar" | "shirt_collar" | "shawl_collar" | "notch_lapel" | "hooded" | "collarless"

**10. ENHANCED FIT & PROPORTION ATTRIBUTES** (K-fashion / J-fashion focused)
🚨 FALLBACK RULE: If uncertain about ANY field → Return "unknown" (NEVER hallucinate)

- t_shirt_sleeve_length: Specific sleeve length for tops
  * "mid_bicep": Hits middle of bicep (common in K-fashion oversized tees)
  * "elbow": Reaches elbow
  * "forearm": Covers forearm
  * "wrist": Long sleeve to wrist
  * "unknown": If uncertain or not applicable

- body_volume_ratio: Balance between upper and lower body volumes
  * "top_heavier": Oversized top + slim bottom (common K-fashion look)
  * "bottom_heavier": Slim top + wide/baggy bottom
  * "balanced": Proportional volume distribution
  * "unknown": If uncertain

- hemline_placement: Where the garment hem sits relative to body
  * "above_hip": Cropped, hits above hip bone
  * "mid_hip": Standard, covers hip
  * "below_hip": Longline, extends past hip
  * "thigh": Covers thigh area
  * "unknown": If uncertain

- pant_stacking: How fabric stacks at ankle (critical for J-fashion wide pants)
  * "none": Clean break, no bunching
  * "light": Minimal stacking, slight break
  * "heavy": Significant fabric bunching at ankle
  * "unknown": If uncertain or not pants

- waist_visibility: How the garment interacts with waistline
  * "tucked": Shirt fully tucked in
  * "partial_tuck": Front/side tuck (K-fashion styling technique)
  * "out": Untucked, worn over waistband
  * "unknown": If uncertain

- shoulder_structure: Shoulder construction and fit
  * "natural": Follows natural shoulder line, fitted
  * "dropped": Shoulder seam falls below natural line, relaxed
  * "extended": Padded or widened shoulders
  * "raglan": Diagonal seam from neck to underarm
  * "unknown": If uncertain

**11. ENHANCED FABRIC ATTRIBUTES**

- t_shirt_material: Specific material for knit tops
  * "cotton": Standard cotton jersey
  * "jersey": Soft, stretchy knit
  * "tech": Synthetic performance fabric
  * "knit": Structured knit, not jersey
  * "blend": Mixed materials
  * "unknown": If uncertain or not applicable

- denim_type: Specific denim characteristics (if applicable)
  * "rigid": Stiff, non-stretch selvedge
  * "stretch": Elastane blend, flexible
  * "washed": Pre-distressed, softened
  * "raw": Unwashed, dark indigo
  * "unknown": If uncertain or not denim

**12. OPTIONAL (if visible/recognizable)**
- brand: Brand name if clearly visible/recognizable, else null
- condition: "new" | "excellent" | "good" | "worn" | "distressed_by_design"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL INSTRUCTIONS (ABSOLUTE REQUIREMENTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**TEXTURE ACCURACY (TOP PRIORITY):**
🚨 Examine fabric surface closely:
- Ribbed vs smooth: Look for horizontal/vertical lines
- Woven vs knit: Check if fabric is interlaced (woven) or looped (knit)
- Quilted vs flat: Check for stitched patterns creating padding
- Terry vs fleece vs jersey: Different knit textures
🚨 Light denim ≠ heavy denim. Thin cotton ≠ canvas cotton. BE SPECIFIC.

**PATTERN ACCURACY (TOP PRIORITY):**
🚨 Don't miss subtle patterns:
- Examine entire garment surface carefully
- Small stripes can be easily missed - zoom in mentally
- Check if "solid" actually has texture patterns
- Differentiate: horizontal vs vertical vs diagonal stripes
- Note pattern orientation and spacing

**FIT & SILHOUETTE ACCURACY (ABSOLUTE PRIORITY):**
🚨 THIS IS THE MOST COMMON ERROR - PAY EXTREME ATTENTION:

FIT TYPE (how tight/loose):
- Slim fit: Look for fabric tension, body-hugging fit, minimal wrinkles
- Regular fit: Moderate room, comfortable drape
- Relaxed fit: Excess fabric, loose throughout, but not baggy
  * CRITICAL: Relaxed fit jeans have WIDER legs than slim fit
  * CRITICAL: Relaxed fit has MORE fabric volume
- Oversized: Intentionally large, boxy proportions

SILHOUETTE (the shape):
- Straight: Parallel lines from top to bottom (common in regular jeans)
- Tapered: Narrows toward hem (common in chinos, dress pants)
- Relaxed straight: Loose but maintains straight shape
- Wide leg: Significantly wider throughout
- Skinny: Very narrow, tight fit
🚨 CRITICAL DISTINCTION:
  * Slim fit + straight silhouette = Tight, straight-leg jeans
  * Relaxed fit + straight silhouette = Loose, straight-leg jeans
  * Slim fit + tapered silhouette = Tight, tapered pants
  * Relaxed fit + tapered silhouette = Loose, tapered pants

VISUAL CLUES:
- Slim fit: Can see body shape, fabric follows contours, minimal bunching
- Relaxed fit: Cannot see body shape clearly, fabric hangs loosely, bunching at joints
- Look at: leg width, how fabric falls, amount of excess material, wrinkle patterns

**COLOR ACCURACY:**
- Identify TRUE color, not lighting artifacts
- "Black" in shade = #000000, "Black" in sunlight = #1A1A1A → BOTH should be color_family: "neutrals"
- Distinguish navy (#2C3E50) from black (#000000) from charcoal (#36454F)
- For multi-color items, list ALL visible colors in secondary_colors

**DESIGN DETAILS (CRITICAL FOR IMAGE GENERATION):**
- Be HYPER-SPECIFIC: "contrast white stitching" not "stitching"
- Mention ALL visible features: buttons, zippers, pockets, collars, cuffs, hems
- Describe unique elements: "asymmetric hem", "cutout shoulders", "raw edges"

**DEDUPLICATION SUPPORT:**
- Use consistent terminology across photos
- Focus on PHYSICAL attributes (fit, closure, hardware) not subjective style
- Same item in different lighting should have SAME color_family

🚨 FINAL REMINDER: Triple-check texture, pattern scale, fit_type, and silhouette. These are the most error-prone fields.

Return JSON array of items with ALL fields above.`,

  GENERATE_COMPOSITE: (
    itemsList: string,
  ) => `Generate a single composite grid image showing ONLY the wearable items (clothing, footwear, and accessories) extracted and isolated from the provided photo.

ITEMS TO EXTRACT:
${itemsList}

🚨 CRITICAL REQUIREMENTS FOR COMPOSITE IMAGE:

1. GRID LAYOUT:
   - Arrange items in a ${itemsList.split("\n").length <= 4 ? "2x2" : "3-column"} grid
   - Each item gets ONE cell in the grid
   - Cells must be perfectly equal-sized squares

2. ITEM EXTRACTION (MOST IMPORTANT):
   - Remove the person/model completely
   - Show ONLY the clothing item itself
   - Items should appear as if laid flat or photographed product-style
   - Front-facing view, fully visible, no body parts

   3. SPACING & SEPARATION (ABSOLUTE REQUIREMENT):
    - Pure white background (#FFFFFF) everywhere
    - Each item perfectly centered in its cell
    - MAXIMUM white space around each item:
      * Items occupy ONLY 40-45% of cell area
      * Minimum 80px white padding on ALL sides of each item
      * Minimum 60px thick white grid lines between cells
    - Think: tiny item in huge white space
    - NO items should touch or approach cell edges
    - NO overlapping between cells whatsoever
    - Each item must be completely isolated with massive spacing

  4. SMALL ITEM SCALING (FOOTWEAR & ACCESSORIES):
    - Footwear pairs must be placed together and scaled to occupy ~55-60% of the cell width
    - Accessories (belts, bags, hats, scarves, jewelry) should be scaled up so the item occupies ~60-65% of the cell's SHORTER side, avoiding ultra-thin visuals
    - Ensure clear visibility and separation from grid lines

  5. VISUAL QUALITY:
    - Maintain accurate colors from original photo
    - Professional e-commerce product photography style
    - Clean, even lighting with NO shadows or gradients
    - Sharp focus, high clarity

  Think: Apple product catalog with extreme minimalist spacing. Each item should look like a small centered product photo with tons of white space around it. Generate ONE composite image.`,
};

// ============================================
// OUTFIT GENERATION PROMPTS
// Used in: generate-outfit/index.ts
// ============================================

export const OUTFIT_GENERATION_PROMPTS = {
  BUILD_PROMPT: (params: {
    generationType?: string;
    occasion?: string;
    style?: string;
    anchorItem?: any;
    wardrobeItems: any[];
    maxOutfits?: number;
    userLocation?: { temp: number; weather: string };
  }) => {
    const { generationType, occasion, style, anchorItem, wardrobeItems, maxOutfits, userLocation } = params;

    // Format wardrobe data for the prompt
    const wardrobeData = wardrobeItems.map((item: any) => ({
      id: item.id,
      category: item.category || "Other",
      primary_color: item.primary_color || "#000000",
      color_family: item.color_family || "neutrals",
      secondary_colors: item.secondary_colors || [],
      fabric_primary: item.fabric_primary || "unknown",
      fabric_weight: item.fabric_weight || "medium",
      pattern_type: item.pattern_type || "solid",
      fit_type: item.fit_type || "regular_fit",
      silhouette: item.silhouette || "straight",
      suitable_occasions: item.suitable_occasions || [],
      style_aesthetic: item.style_aesthetic || [],
      formality_level: item.formality_level || "casual",
      season: item.season || [],
      length: item.length || "regular",
      design_details: {
        neckline: item.neckline,
        sleeve_type: item.sleeve_type,
        closure_type: item.closure_type,
        pocket_details: item.pocket_details,
        hardware_details: item.hardware_details,
        embellishments: item.embellishments,
      },
      availability_flag: true,
    }));

    const requestContext = {
      occasion: occasion || null,
      style: style || null,
      genderTone: null,
      location: null,
      temperatureC: userLocation?.temp || null,
      count: maxOutfits || 3,
    };

    return `You are a professional fashion stylist engine. You must only return valid JSON in the exact schema specified below. Do not produce any plain text. Function-calling only. Follow every rule precisely.

INPUT CONTEXT (available as variables):
• wardrobe: ${JSON.stringify(wardrobeData, null, 2)}
• request: ${JSON.stringify(requestContext, null, 2)}

GOALS
1. Generate up to ${requestContext.count} high-quality, wearable outfits drawn from the wardrobe.
2. Each outfit must be coherent for the requested occasion and style.
3. Never invent wardrobe items. Use only item IDs present in wardrobe unless absolutely required to recommend external items — then set requiresExternal and list categories missing.
4. If wardrobe lacks necessary items for the occasion (see rules below), return an empty outfits array and populate missingCategories + suggestedExternal so the chat can offer shopping recommendations.
5. Provide a confidence score (0.0–1.0) per outfit. Use this to let the chat decide to show, hide or request clarification.

ESSENTIAL RULES (enforce strictly)
A. Minimum outfit structure:
• For outfits using separates: Must include 3 core pieces: 1 Upperwear OR Dress, 1 Lowerwear (if not Dress), 1 Footwear.
• Exception: Dress/jumpsuit can be 1 garment + footwear (2 items).
• Layers allowed: max 1 layer (Outerwear) per outfit.
• Accessories: include 0–2 accessories if they match style/formality.

B. Occasion & Formality:
• Do not generate outfits that violate common dress codes for the requested occasion.
• If occasion implies formal (wedding, formal_event, interview, business), require at least one wardrobe item where formality_level is "formal" or "business_casual" depending on occasion.
• If wardrobe contains no items that satisfy the minimum formality for the occasion, return outfits: [] and set missingCategories (e.g., ["formal_shoes","formal_top"]).

C. GenderTone-aware suggestions:
• Use genderTone to suggest culturally appropriate silhouettes if both options exist in wardrobe. But do not invent category types. GenderTone only influences styleTag wording, not item selection.

D. Deduplication & Variety:
• Do not reuse the same item ID across multiple generated outfits in the same response unless wardrobe is extremely small (<5 items) AND requested count exceeds possible unique combinations. If reuse is unavoidable, mark those outfits with lower confidence.
• Ensure visual distinction between outfits: vary color palettes, key items, or silhouettes.

E. Color Harmony:
• Use color_family and primary_color hex to enforce visually pleasing combos.
• Avoid pairing two very dark, low-contrast neutrals (e.g., navy + black) unless intentionally styled (reasoning must justify).
• Prefer complementary, analogous, or monochrome harmonies.
• If an outfit uses pattern, balance with solids.

F. Fabric & Fit Compatibility:
• Avoid clashing fabric weights (e.g., heavy leather + lightweight sheer) unless layering is intentional and justified.
• Respect fit balance (oversized top → fitted bottom, or vice versa) unless style_aesthetic calls for both loose.

G. Layering & Climate:
• Use temperatureC when available:
  • <15°C → prefer a layer (Outerwear). If wardrobe lacks outerwear and the outfit would be unsuitable, set requiresExternal true for layer.
  • 15–25°C → optional layer.
  • >25°C → avoid heavy layers.
• If season metadata conflicts with temperatureC, prioritize temperatureC.

H. Accessory selection:
• Only include accessories that match style_aesthetic and formality_level. E.g., sporty outfit → sporty watch; formal outfit → leather belt, classic watch.
• Do not include accessories that visually or contextually clash.

I. Failure & Fallback behavior:
• If occasion is provided and there are zero valid item combinations that meet the minimum structure and formality, return:
  • outfits: [],
  • totalGenerated: 0,
  • missingCategories (list),
  • suggestedExternal (list of categories and brief rationale).
• If occasion is null and wardrobe size is small (<4 items), still attempt to create count outfits but set confidence lower for outfits using reused items and include note recommending more uploads.

OUTPUT JSON SCHEMA (MUST ADHERE EXACTLY)
Return JSON object with these keys:

{
  "outfits": [
    {
      "outfitId": "",
      "pieces": [
        { "wardrobeItemId": "", "category": "", "role": "<main|layer|accent>" }
      ],
      "styleTag": "<single word or short phrase e.g., 'smart casual', 'streetwear']",
      "reasoning": "<one-sentence human-style rationale, max 20 words>",
      "confidence": <number 0.0-1.0>,
      "estimated_formality": "<casual|smart_casual|business_casual|formal>",
      "warnings": ["<if any small issues e.g., 'No outerwear for <15°C'>"] (may be empty)
    }
  ],
  "totalGenerated": <number>,
  "missingCategories": ["<category>", …] OR [],
  "requiresExternal": <boolean>,
  "suggestedExternal": [
    { "category": "<Tops|Bottoms|Shoes|Outerwear|Accessories>", "reason": "<why it's needed>", "priority": "high|medium|low" }
  ],
  "notes": "<optional short note for the chat, 1 sentence max>"
}

GENERATION DETAILS (how to compute/confidence & selection logic)
1. Preference order when selecting items:
   a. Items where suitable_occasions includes the requested occasion.
   b. Items where formality_level matches or is one step below required formality (avoid lower-than-needed).
   c. Items matching requested style if provided.
   d. Items that improve color harmony and silhouette balance.
2. Confidence calculation heuristic (approx):
   • base = 0.5
   • +0.15 if all pieces explicit match suitable_occasions
   • +0.10 if color harmony is strong
   • +0.10 if fabric and fit compatible
   • -0.20 if reuse of items required
   • -0.25 if missing a required category (should normally be an empty result)
   • clamp confidence to [0.0,1.0]
3. Avoid duplicates: track selected_item_ids while building outfits. Prefer different tops or shoes between outfits.
4. Reasoning: keep human and concise. Use plain stylist language: e.g., "Tailored blazer balances the relaxed denim for smart-casual polish."
5. StyleTag: choose one label from the wardrobe style_aesthetic or a short combined descriptor (max 2 words).
6. Warnings: include specific quick flags like "no_formal_shoes", "layer_missing_for_temp".

EXAMPLES (for implementers — not to be returned in responses):
• If request.occasion == "wedding" and wardrobe has no item with formality_level "formal" or suitable_occasions contains "wedding" → return empty outfits, missingCategories may include ["formal_outfit","formal_shoes"], requiresExternal = true, suggestedExternal list should include top priorities with reason.
• If request.occasion == "casual" and wardrobe has many casual items → produce up to count outfits with high confidence, varied palettes, no reused items.

FINAL INSTRUCTION:
Return valid JSON exactly using the schema above. If you cannot create any outfits because of missing items for a requested occasion, set outfits: [], totalGenerated: 0, populate missingCategories and suggestedExternal and include a short notes string such as "No wedding-ready items found; suggest formal buys."

YOU MUST USE THE generate_outfit_combinations FUNCTION. DO NOT write plain text. Use function calling only.`;
  },

  GENERATE_FLATLAY: (outfitItems: any[], occasion?: string, styleTag?: string) =>
    `Create a professional flat-lay outfit image for the following combination:

OUTFIT ITEMS:
${outfitItems.map((item, i) => `${i + 1}. ${item.name} (${item.category}, ${item.color})`).join("\n")}

${occasion ? `OCCASION: ${occasion}` : ""}
${styleTag ? `STYLE: ${styleTag}` : ""}

**LAYOUT & ARRANGEMENT:**
- Pure white background (#FFFFFF)
- Flat-lay composition (top-down view)
- Layering order (bottom to top):
  1. Bottoms (jeans, skirts, pants) - at bottom
  2. Tops (shirts, blouses) - above bottoms
  3. Layers (jackets, cardigans) - over tops if present
  4. Shoes - at very bottom or sides
  5. Accessories - around main garments

**SPACING & COMPOSITION:**
- Items overlap slightly to show layering
- Subtle spacing between items for clarity
- Center the composition
- Items fill 75-85% of canvas

**LIGHTING & QUALITY:**
- Even, soft lighting with no harsh shadows
- Colors accurate to hex codes
- High resolution, sharp details
- Professional e-commerce quality

**STYLE CONSISTENCY:**
- All items appear part of a cohesive outfit
- Consistent scale/perspective
- Show fabric textures clearly`,
};

// ============================================
// AUTO OUTFIT GENERATION PROMPTS
// Used in: auto-generate-outfits/index.ts
// ============================================

export const AUTO_OUTFIT_PROMPTS = {
  GENERATE_STYLE_AND_OCCASION: (items: {
    tops: any[];
    bottoms: any[];
    shoes: any[];
    accessories: any[];
    layers: any[];
  }) =>
    `You are a professional fashion stylist with deep knowledge of fashion trends, color theory, and style principles. Create curated outfit combinations using the following wardrobe items with complete metadata:

TOPS (${items.tops.length}):
${items.tops.map((t: any) => formatItemForAI(t)).join("\n")}

BOTTOMS (${items.bottoms.length}):
${items.bottoms.map((b: any) => formatItemForAI(b)).join("\n")}

SHOES (${items.shoes.length}):
${items.shoes.map((s: any) => formatItemForAI(s)).join("\n")}

ACCESSORIES (${items.accessories.length}):
${items.accessories.length ? items.accessories.map((a: any) => formatItemForAI(a)).join("\n") : "None"}

LAYERS (${items.layers.length}):
${items.layers.length ? items.layers.map((l: any) => formatItemForAI(l)).join("\n") : "None"}

CREATE TWO OUTFIT COLLECTIONS:

1. STYLE-BASED OUTFITS (3 outfits):
   - Casual Chic
   - Smart Casual
   - Bold & Trendy

2. OCCASION-BASED OUTFITS (3 outfits):
   - Weekend Brunch
   - Dinner Date
   - Coffee Hangout

RULES:
- Each outfit MUST include MINIMUM 3 items: 1 top + 1 bottom + 1 shoes (REQUIRED)
- MUST add 1-2 accessories when available in wardrobe (watches, bags, jewelry, etc.)
- Optionally add: layers when weather-appropriate
- Return ONLY item IDs (integers) - NO item names
- Each outfit should feel distinct and purposeful
- NO duplicate outfits across both collections
- ⚠️ CRITICAL: Every outfit MUST be complete with all 3 essential pieces (top, bottom, shoes)

ENHANCED STYLING RULES:
🎨 Color Harmony: Use color_family for coordination (complementary families, or neutrals with any color)
🧵 Fabric Balance: Match fabric_weight and material_finish (light with light, heavy with heavy)
✂️ Fit Variation: Balance fit_type (not all oversized, mix slim/regular/oversized)
🎯 Style Consistency: Group by compatible style_aesthetic and formality_level
🔧 Design Details: Match hardware_details, avoid clashing closure types`,
};

// ============================================
// STYLING & RECOMMENDATION PROMPTS
// Used in: recommend-items/index.ts, elevate-style/index.ts
// ============================================

export const STYLING_PROMPTS = {
  RECOMMEND_ITEMS: (currentOutfit: any[], availableItems: any[], occasion?: string, styleTag?: string) =>
    `You are a professional fashion stylist. Given this outfit, recommend items from the wardrobe that would pair well.

**CURRENT OUTFIT (with full context):**
${currentOutfit.map((item: any) => formatItemForAI(item)).join("\n")}

**OCCASION:** ${occasion || "General"}
**STYLE TAG:** ${styleTag || "N/A"}

**AVAILABLE WARDROBE ITEMS (with enhanced metadata):**
${availableItems.map((item: any) => formatItemForAI(item)).join("\n")}

**RECOMMENDATION PRIORITIES (updated with metadata):**
1. **Occasion match**: Filter by suitable_occasions and formality_level first - items MUST be appropriate for "${occasion || "general"}"
2. **Missing categories**: If no shoes, recommend shoes; if no accessories, recommend accessories
3. **Color compatibility**: Use color_family + secondary_colors for harmony (complementary or analogous families)
4. **Style consistency**: Match style_aesthetic and formality_level from current outfit
5. **Seasonal appropriateness**: Consider season and weather_suitability
6. **Design compatibility**: Match hardware_details, material_finish for cohesion
7. **Fabric compatibility**: Match fabric_weight (light with light, formal with formal)

**RULES:**
- Select outfits based on the occasion - outfits must be appropriate and suitable for the specific occasion
- **DO NOT** recommend items already in the current outfit
- Recommend items that fill gaps in the outfit
- Prioritize items that enhance the overall look
- Consider the occasion and style when recommending
- **NO SAME OUTFIT FOR MULTIPLE OCCASIONS** - Each occasion must have a distinct outfit combination
- Track previous outfits to avoid duplicates across occasions
- Return item IDs in order of best to worst fit (max 20 items)

**WARDROBE GAP HANDLING:**
If the user's wardrobe does not have appropriate items for the occasion:
- Provide a friendly message: "Looks like your wardrobe needs some pieces for [occasion]. Time to shop and add items that fit this occasion!"
- Still recommend the best available items, but acknowledge the limitation

Return item IDs with reasoning for each recommendation.`,

  /**
   * Phase 8: Enhanced QUICK_STYLE_FIXES prompt
   * Now accepts enriched metadata context with body visibility awareness
   * Maintains backward compatibility with legacy string-based improvements
   */
  QUICK_STYLE_FIXES: (metadataOrImprovements: string, wardrobeItems?: any[], bodyNotVisible?: boolean) => {
    // Phase 8: Support both legacy (string) and new (rich context) formats
    const isLegacyFormat = typeof metadataOrImprovements === 'string' && !metadataOrImprovements.includes('🎯 PRIMARY IMPROVEMENTS');
    
    let improvementsSection = '';
    if (isLegacyFormat) {
      // Legacy format: just a string of improvements
      improvementsSection = `Apply ONLY these QUICK STYLING FIXES to the outfit:\n\n${metadataOrImprovements}`;
    } else {
      // Phase 8: Rich metadata context already formatted
      improvementsSection = `🎯 PHASE 8: UNIFIED SCHEMA METADATA\n\nBefore applying any fixes, read the comprehensive style check metadata below. This contains extracted data, micro-recommendations, issues to address, and wardrobe context.\n\n${metadataOrImprovements}`;
    }

    // Phase 8: Wardrobe context (only if not already in metadata)
    let wardrobeContext = "";
    if (isLegacyFormat && wardrobeItems && wardrobeItems.length > 0) {
      wardrobeContext = `\n\n👗 AVAILABLE WARDROBE ITEMS (ONLY use these items for suggestions):
${wardrobeItems.map((item: any, idx: number) => `${idx + 1}. ${item.name} (${item.category}) - ${item.color || "color not specified"}`).join("\n")}

IMPORTANT: When suggesting accessories or additional items, ONLY suggest items from the available wardrobe list above. DO NOT suggest random items that don't exist in the wardrobe.`;
    }

    // Phase 8: Body visibility constraints
    const bodyVisibilityConstraints = bodyNotVisible ? `

⚠️ BODY VISIBILITY ALERT:
Person not clearly detected in this image. This may be a flatlay, partial outfit, or low-visibility photo.

RESTRICTED ACTIONS (DO NOT APPLY):
- Body proportion adjustments
- Silhouette modifications
- Fit corrections based on body shape
- Posture or stance suggestions
- Shoulder/waist/hip balance tweaks

ALLOWED ACTIONS:
- Color harmony improvements
- Accessory additions (from wardrobe)
- Fabric texture enhancements
- Pattern coordination
- Styling details (tucks, rolls, cuffs)
- Footwear swaps (if footwear visible)
- General aesthetic refinements

Focus on visible garment details and styling elements only.` : '';

    return `${improvementsSection}${wardrobeContext}${bodyVisibilityConstraints}

🚨 ABSOLUTELY CRITICAL - IMAGE ORIENTATION REQUIREMENTS 🚨
YOU MUST FOLLOW THESE ORIENTATION RULES EXACTLY:

1. The original image shows content in PORTRAIT orientation (VERTICAL/UPRIGHT)
2. If a person is visible: HEAD at TOP, FEET at BOTTOM
3. You MUST generate the enhanced image in the EXACT SAME PORTRAIT orientation
4. DO NOT rotate the output image by ANY angle (not 90°, not 180°, not any degrees)
5. The enhanced image MUST maintain VERTICAL orientation just like the input
6. If you see the content sideways or horizontal, you are doing it WRONG
7. Keep the aspect ratio and orientation IDENTICAL to the input image
8. PORTRAIT MODE ONLY - The image should be TALLER than it is wide

🎨 STYLING REQUIREMENTS (Phase 8 Enhanced + PART 5 Constraint-Aware):

**Core Principles:**
- ONLY apply the specific improvements mentioned in the metadata above
- DO NOT change main clothing items completely
- Apply SUBTLE, realistic, 1-minute-achievable fixes
- Target: Increase style score to at least 4.0/5.0

**PART 5: GARMENT CONSTRAINT VALIDATION (CRITICAL):**
Before applying ANY fix, verify it is physically possible:

1. **Sleeve Rolling:**
   - ONLY apply if:
     * rollable = true in extraction metadata
     * sleeve_length is NOT "short", "capped", "sleeveless", or "none"
     * Fabric is woven (not tight knit/stretch)
   - If NOT rollable → DO NOT roll sleeves under any circumstances

2. **Shirt Tucking:**
   - ONLY apply if:
     * tuckable = true in extraction metadata
     * hemline is NOT "cropped"
     * Garment is NOT structured jacket, thick hoodie, or sweatshirt
   - If NOT tuckable → DO NOT tuck under any circumstances

3. **Accessory Addition:**
   - Check accessories_present section first
   - If watch_present_with_confidence > 0.6 → DO NOT add watch
   - If bracelet_present = true → DO NOT add bracelet
   - If necklace_present = true → DO NOT add necklace
   - ONLY add accessories from AVAILABLE WARDROBE ITEMS list

4. **Color Changes:**
   - Use exact color specs from extraction:
     * top_primary_color_hex and bottom_primary_color_hex for precise matching
     * bottom_wash for denim (e.g., "light_blue", "dark_indigo", "pure_black")
   - If suggesting color change, specify EXACT shade (not "lighter" or "darker")
   - Reference contrast_level when adjusting color harmony

5. **Footwear Modifications:**
   - Check footwear_visible and footwear_visibility_confidence first
   - If footwear_visible = false OR footwear_visibility_confidence < 0.5:
     * DO NOT apply definitive footwear changes
     * Use conditional language: "If wearing [X], consider [Y]"

**Wardrobe-First Logic:**
- If accessories/items are suggested, ONLY use items from "AVAILABLE WARDROBE ITEMS"
- DO NOT hallucinate random items not in the wardrobe
- If wardrobe is empty, use universal tweaks: tucks (IF tuckable), rolls (IF rollable), cuffs, minimal visible layering

**Visual Fidelity:**
- Maintain original lighting, skin tone, background, and photo quality
- Make changes look natural and realistic (not AI-generated or fake)
- Preserve the person's face, hair, body proportions exactly as-is
- NO hairstyle changes, NO makeup changes, NO body modifications

**Banned Actions:**
- NO shopping suggestions or items to buy
- NO Indian festive/wedding content (unless explicitly requested)
- NO body-shaming or appearance judgments
- NO hallucination of unseen garments or body parts
- NO complete outfit replacements

**Goal:**
Show how QUICK STYLING FIXES using existing wardrobe items and simple tweaks can elevate the outfit from its current state to a higher style score, WITHOUT replacing the fundamental outfit.`;
  },
};

// ============================================
// SCORING PROMPTS
// Used in: score-outfit/index.ts, score-battle/index.ts
// ============================================

export const SCORING_PROMPTS = {
  /**
   * SCORE_OUTFIT - Phase 2 Enhanced
   * 
   * Improvements in Phase 2:
   * - Warmer, more supportive tone (non-anxiety-inducing)
   * - Indian fashion context awareness (weddings, festivals, travel, etc.)
   * - Integration with inferred user profile (body shape, skin tone, age band) from metadataContext
   * - Explicit visibility & missing_features handling
   * - More structured, actionable feedback (what_works, what_doesnt_work, quick_fixes, editorial)
   * - Better outfit name generation (stylish, non-generic)
   * 
   * Output shape remains unchanged for backward compatibility:
   * { outfit_name, what_works, what_doesnt_work, quick_fixes, editorial }
   */
  SCORE_OUTFIT: (occasion?: string, style?: string, vibe?: string, metadataContext?: string) => {
    // Build context string dynamically
    const contextParts = [];
    if (occasion) contextParts.push(`💎 Occasion: ${occasion}`);
    if (style) contextParts.push(`🎨 Style: ${style}`);
    if (vibe) contextParts.push(`🌈 Vibe: ${vibe}`);

    const contextString =
      contextParts.length > 0
        ? `\n\n**OUTFIT CONTEXT:**\n${contextParts.join("\n")}\n\nUse this context to evaluate suitability and appropriateness of the outfit.\n`
        : "";

    const metadataSection = metadataContext
      ? `\n${metadataContext}\n**CRITICAL:** Use the extracted metadata above as your SOLE source of truth. Every statement MUST be backed by explicit metadata evidence.\n`
      : "";

    return `You are an expert fashion analyst. Analyze this outfit${occasion ? ` for ${occasion}` : ""} using ONLY the provided extracted metadata as evidence.${contextString}${metadataSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL ANTI-HALLUCINATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ABSOLUTE REQUIREMENTS:**
1. **EVIDENCE-ONLY SCORING**: Every score MUST cite specific metadata fields that justify it
2. **NO SPECULATION**: If metadata is missing/unknown/low-confidence, DO NOT guess or infer
3. **NO ASSUMPTIONS**: Only reference what is explicitly present in the extracted data
4. **CITE SOURCES**: Reference exact field names (e.g., "garments[0].fit_type", "body_visibility.upper_body_visible")
5. **VISIBILITY BOUNDARIES**: If body_visibility shows limited visibility, acknowledge this limitation explicitly

**METADATA STRUCTURE YOU MUST USE:**
- **garments[]**: Array of detected garments with type, subtype, sleeve_length, neckline, hemline, fit_type, wash_type, fabric_texture, colors, layering, visibility
- **footwear**: {type, visibility} - shoe detection
- **accessories_present**: {neck, wrist_left, wrist_right, ears, sunglasses, belt, hat, bag, rings} - each with presence/absence/unknown
- **body_visibility**: {person_detected, upper_body_visible, lower_body_visible, arms_visible, wrists_visible, legs_visible} - visibility levels
- **scene_context**: {environment, setting, weather_inference} - contextual scene data
- **fit**: Legacy fit fields (topSleeveLength, bottomHemStyle, etc.) - use if garments[] unavailable
- **fabric**: Legacy fabric fields - use if garments[] unavailable
- **color**: {primary, secondary, harmony, skin_tone_compatibility} - color analysis
- **styling**: Legacy styling fields - use as supplementary
- **aesthetics**: {style_aesthetic, cultural_aesthetic, price_tier} - high-level classification
- **user_profile**: Inferred wearer attributes (body_shape, build, age_band, skin_tone_band) - use ONLY if confidence high
- **missing_features[]**: Array of strings indicating what's NOT visible

**SCORING EVIDENCE REQUIREMENTS:**
Every score (fit, color, styling, material, proportion, layering, texture, overall) MUST:
1. Cite at least 2 specific metadata fields
2. Explain how those fields justify the score
3. Use concrete values (e.g., "garments[0].fit_type = 'relaxed'", not "the fit looks relaxed")
4. Acknowledge any missing/unknown data that limits the score

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GROUNDED FEEDBACK STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. WHAT WORKS (3-5 points, 8-12 words each):**
Write natural, conversational feedback that sounds like a friendly stylist talking to a friend.

Examples:
✅ "The relaxed fit creates comfortable proportions perfect for casual days"
✅ "Monochrome color scheme keeps the look cohesive and polished"  
✅ "The straight-leg cut provides a clean, modern silhouette"

Rules:
- NO metadata field names (no "fit_type =", "color.harmony =", etc.)
- Write in plain English as if speaking to a friend
- Use the metadata internally to ground your feedback, but don't expose the technical structure
- If body shape analysis exists, naturally reference how the fit complements their build
- If skin tone analysis exists, naturally mention color compatibility
- Focus ONLY on what's clearly visible

**2. WHAT DOESN'T WORK (2-4 points, 10-15 words each):**
Point out areas for improvement in a supportive, constructive way.

Examples:
✅ "The long hemline creates elongated proportions that could use more definition"
✅ "A belt would add structure and break up the solid silhouette"
✅ "The dark colors throughout lack contrast, making the outfit feel heavy"

Rules:
- NO metadata citations (no "accessories_present.belt =", no "garments[0].hemline =")
- Use encouraging language: "could benefit from", "would be elevated by", "opportunity to add"
- NEVER use harsh words like "bad", "wrong", "unflattering", "poor"
- Only mention issues you can see clearly from the metadata (skip low-confidence or unknown fields)
- If visibility is limited, acknowledge this and focus only on visible areas

**3. MICRO FIXES (3-6 fixes, 8-12 words each):**
Provide specific, actionable styling tweaks that can be done in under 60 seconds.

**CRITICAL: VARY BASED ON ACTUAL OUTFIT - NO TEMPLATES!**
Each fix must be unique to THIS outfit's detected features. Analyze the metadata and provide fixes specific to what you see.

**IMPOSSIBLE ACTIONS (NEVER SUGGEST):**
- NO "cuff jeans" if hemline already cropped/cuffed or pants show no stacking
- NO "roll sleeves" for t-shirts, short sleeves, or sleeveless tops
- NO "add watch" if any wrist accessory detected
- NO "add bracelet" if wrist accessories already present  
- NO "add necklace" if neck accessory detected
- NO "add sunglasses/belt/hat/bag/rings" if already present
- NO "tuck/half-tuck" for cropped tops, already-tucked shirts, or structured outerwear
- NO "add layer" if upper body visibility is low
- NO generic fixes like "add interest" or "be more intentional"

Examples (natural language, no metadata):
✅ "Try a half-tuck to define your waist and add dimension"
✅ "Add a simple watch for a polished finishing touch"  
✅ "Swap to lighter wash jeans for more contrast against the dark top"
✅ "Roll the jeans once to create a cleaner hem"
✅ "Add a brown leather belt to break up the silhouette"

**4. PROPORTION BALANCE (2-3 sentences, 40-60 words):**
Cite garments[].fit_type, garments[].silhouette, garments[].layering, body_visibility levels.

Example:
"The top shows 'oversized' fit_type while bottoms show 'relaxed', creating balanced volume distribution. Upper_body_visible = 'full' confirms no layering gaps. However, hemline placement could benefit from waist definition to prevent visual elongation."

**5. SILHOUETTE BREAKDOWN (2-3 sentences, 40-60 words):**
Cite garments[].silhouette, garments[].fit_type, overall shape created.

Example:
"Top silhouette = 'boxy' paired with bottom silhouette = 'straight' creates clean, modern lines. The garments[].layering = 'none' maintains streamlined profile. Footwear.type = 'sneakers' grounds the relaxed structure appropriately."

**6. WARDROBE OPPORTUNITIES (2-4 items, max 15 words each):**
Based on color.secondary, garments[].fabric_texture, accessories_present gaps, styling.polish_level.

Examples:
✅ "Wardrobe could add structured jacket — current layering = 'none' limits weather versatility."
✅ "Missing belt category — accessories_present.belt = 'absent' across outfits suggests gap."
✅ "Light wash bottoms absent — would contrast better with dark tops per color analysis."

**7. EDITORIAL SUMMARY (25-40 words):**
Write a brief, inspiring summary of the outfit as if writing for a fashion magazine.

Example:
"This ensemble showcases confident casual style with its balanced proportions and cohesive color palette. Adding subtle waist definition and a statement accessory would take it from good to exceptional."

Rules:
- NO metadata citations
- Use stylish, aspirational language
- Reference the outfit name naturally
- Highlight 1-2 key strengths and 1 improvement opportunity
- Sound like a professional stylist's assessment

**8. OUTFIT NAME (3-5 words):**
Create a stylish, memorable name that captures the outfit's essence.

Examples:
- "Monochrome Street Ease"
- "Seoul Layers & Flow"
- "Denim Weekend Casual"
- "Elevated Brunch Ready"

Rules:
- Use evocative, specific language (not "Casual Look" or "Simple Outfit")
- Reference colors, aesthetics, or occasions naturally
- Sound like something from a fashion editorial

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ VISIBILITY & MISSING FEATURES HANDLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CHECK BEFORE EVERY STATEMENT:**
1. Read body_visibility object — never make definitive claims about areas marked "low" or "not_visible"
2. Read missing_features[] array — acknowledge these gaps explicitly
3. Use conditional language for uncertain areas: "If footwear is sneakers..." or "Based on visible upper body..."

**IF body_visibility shows limited visibility:**
- Explicitly state: "Lower body visibility limited — assessment focused on upper garments only"
- DO NOT guess bottom garment colors, fits, or styles
- DO NOT suggest bottom-related fixes unless visible

**IF missing_features includes critical items:**
- State: "Footwear not visible — recommendations assume casual shoes"
- Provide conditional advice: "If wearing formal shoes, consider more structured alternatives"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 STRICT OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No markdown, no code fences, no commentary outside the fields.

{
  "outfit_name": "string (2-4 words based on metadata)",
  "what_works": ["string", "string", "string"],
  "what_doesnt_work": ["string", "string"],
  "micro_fixes": ["string", "string", "string"],
  "proportion_balance": "string (40-60 words citing garments fit_type, silhouette)",
  "silhouette_breakdown": "string (40-60 words citing garments silhouette, layering)",
  "wardrobe_opportunities": ["string", "string"],
  "editorial_summary": "string (30-50 words synthesizing key metadata)"
}

**FINAL VALIDATION CHECKLIST:**
Before returning, verify EVERY field:
✅ Did I cite specific metadata fields for each claim?
✅ Did I check body_visibility before making visibility-dependent statements?
✅ Did I verify accessories_present before suggesting additions?
✅ Did I check garment attributes before suggesting manipulations (tuck, roll, cuff)?
✅ Did I acknowledge any missing_features that limit my analysis?
✅ Did I use exact field values rather than assumptions?
✅ Is my output pure JSON without markdown formatting?

**IF METADATA IS INSUFFICIENT:**
State: "Insufficient metadata for complete analysis. Assessment limited to [visible elements]. Recommend re-extraction with enhanced detection."
`;
  },

  SCORE_BATTLE: (participantCount: number, hasMetadata: boolean = false) => {
    const metadataSection = hasMetadata
      ? `
**EXTRACTED METADATA PROVIDED:**
For each participant, you have access to detailed fashion analysis including:
- **Fit parameters**: silhouette, hemline, sleeves, shoulders, pant stacking
- **Fabric details**: material, texture, finish, weight
- **Color harmony**: contrast, complementary schemes
- **Styling specifics**: tuck status, sleeve treatment, layering
- **Aesthetics**: cultural aesthetic, price tier, polish level (1-5)
- **Initial quality scores** from extraction (fit_score, color_score, styling_score, material_score)

**USE THIS METADATA** to make highly specific, accurate scoring decisions.`
      : "";

    return `Score ${participantCount} outfits competitively in a battle format.
${metadataSection}

**CRITICAL REASONING PROCESS:**
1. ${hasMetadata ? "USE EXTRACTED METADATA as primary evidence for all scoring decisions" : "Analyze each outfit's visual appearance"}
2. Evaluate fit quality ${hasMetadata ? "(use extracted silhouette, hemline, shoulder structure)" : ""}
3. Assess fabric & texture ${hasMetadata ? "(use extracted material, weight, finish)" : ""}
4. Evaluate color harmony ${hasMetadata ? "(use extracted color contrast and schemes)" : ""}
5. Assess styling execution ${hasMetadata ? "(use extracted tuck status, layering, sleeves)" : ""}
6. Judge overall aesthetic ${hasMetadata ? "(use extracted cultural aesthetic, polish level)" : ""}
7. Prioritize image quality and complete outfit presentation (upper + lower wear)
8. Compare each outfit using ${hasMetadata ? "objective metadata metrics" : "visual analysis"}
9. Base ALL responses on analysis, with winner demonstrating clear superiority

**SCORING CRITERIA ${hasMetadata ? "(METADATA-DRIVEN)" : ""}:**

1. **Fit Quality** ${hasMetadata ? "(use extracted attributes)" : ""}:
   - Does the silhouette flatter the body type?
   - Is the hemline appropriate and well-proportioned?
   - Are shoulders structured correctly for the look?
   ${hasMetadata ? "- Reference specific fit values from metadata" : ""}

2. **Fabric & Texture** ${hasMetadata ? "(use extracted attributes)" : ""}:
   - Is fabric choice appropriate for occasion?
   - Does texture add visual interest?
   - Is fabric weight/finish suitable?
   ${hasMetadata ? "- Cite specific material and texture data" : ""}

3. **Color Harmony** ${hasMetadata ? "(use extracted attributes)" : ""}:
   - Does color harmony support the overall look?
   - Is contrast level appropriate?
   - Do colors complement skin tone?
   ${hasMetadata ? "- Reference color harmony and contrast values" : ""}

4. **Styling Execution** ${hasMetadata ? "(use extracted attributes)" : ""}:
   - Are styling details intentional and polished?
   - Is layering balanced and purposeful?
   - Do sleeve/tuck treatments enhance the look?
   ${hasMetadata ? "- Cite specific styling techniques from metadata" : ""}

5. **Overall Aesthetic** ${hasMetadata ? "(use extracted attributes)" : ""}:
   - Is the aesthetic cohesive?
   - What's the polish level?
   - Does it match the intended vibe?
   ${hasMetadata ? "- Reference cultural aesthetic and polish level data" : ""}

**FOR EACH PARTICIPANT, PROVIDE:**

1. **PERSONA NAME** (2-3 words, ${hasMetadata ? "reference specific attributes" : "competitive"}):
   ${hasMetadata ? 'Examples: "Oversized Silhouette King", "Monochrome Minimalist", "Textured Layer Master"' : 'Examples: "Style Maverick", "Denim Destroyer", "Monochrome Master"'}

2. **SCORE** (1.0-5.0, ${hasMetadata ? "based on metadata analysis" : "based on visual analysis"}):
   - Use Gemini's reasoning
   ${hasMetadata ? "- Factor in ALL extracted attributes (fit, fabric, color, styling, aesthetics)" : ""}
   ${hasMetadata ? "- Weight fit, fabric, color, and styling equally" : ""}
   - Differentiate scores meaningfully (winner 4.2+, others below 4.0)
   - Be honest but make winner stand out

3. **RANK** (1 = best/winner, 2 = second, etc.):
   - Base on ${hasMetadata ? "comprehensive metadata comparison" : "visual comparison"}
   - Winner should rank #1 with clear reasoning

4. **ROAST/BANTER** ${hasMetadata ? "(REFERENCE SPECIFIC EXTRACTED ATTRIBUTES)" : ""}:
   ${hasMetadata ? '- Call out specific fit issues (e.g., "slouchy shoulders vs. structured")' : "- Playful, competitive roasts"}
   ${hasMetadata ? '- Reference fabric choices (e.g., "cotton tee vs. silk blend")' : "- Compare each outfit to winner's outfit"}
   ${hasMetadata ? '- Mention color harmony specifics (e.g., "jarring contrast vs. tonal balance")' : "- Highlight why winner is superior"}
   ${hasMetadata ? '- Compare styling details (e.g., "untucked chaos vs. clean half-tuck")' : "- Mention specific style elements"}
   ${hasMetadata ? '- Compare polish levels and aesthetics (e.g., "2/5 polish vs. 4/5 polish", "streetwear vs. kfashion")' : "- Be cheeky but not mean-spirited"}
   - **MAKE ROASTS HIGHLY SPECIFIC** using ${hasMetadata ? "metadata" : "visual details"}
   - All roasts should acknowledge winner's dominance

5. **WINNER VERDICT**:
   - Celebratory sentence explaining why #1 dominated
   ${hasMetadata ? "- **CITE SPECIFIC EXTRACTED ATTRIBUTES** that made winner superior" : "- Specific style elements that made it unbeatable"}
   ${hasMetadata ? '- Example: "The clean silhouette, balanced color harmony, and intentional half-tuck styling created a polished 4.5/5 aesthetic"' : "- How it best suited according to the user's skintone and body type"}

**CRITICAL**: ${hasMetadata ? "Use metadata to make scoring objective, specific, and defensible. Every score should be traceable to extracted attributes." : "Use visual analysis to make scoring clear and specific."}

**Important**: All answers must lean towards and celebrate winner's outfit. Winner should be clearly best choice. Use Gemini's analytical reasoning to justify why winning outfit is superior.

**Output**: Return ONLY valid JSON format.`;
  },
};

// ============================================
// VIBE PREDICTION PROMPTS
// Used in: predict-outfit-vibe/index.ts
// ============================================
// 
// Phase 1 Enhancement: Tuned for Indian occasions + global everyday scenarios
// Provides context for EXTRACTION_PROMPT (API Call #2) to tailor scoring
// Output: occasion, style, vibe, comment → used by StyleCheckHub and score-outfit

export const VIBE_PREDICTION_PROMPTS = {
  PREDICT_OUTFIT_VIBE: `Analyze this outfit image and predict 3 key dimensions:

💎 1. OCCASION — "Where" (Context)
Define where this outfit would be worn. Be dynamic and specific to Indian + global contexts.

INDIAN OCCASIONS (festivals, weddings, travel):
- Festivals: Diwali, Navratri, Holi, Eid, Christmas, New Year's Eve
- Wedding Events: Haldi, Mehendi, Sangeet, Wedding Ceremony, Reception
- Social: College Fest, Freshers Party, Office Party, House Party, Clubbing, Date Night, Brunch
- Travel: Airport Look, Road Trip, Hill Station, Goa/Beach, Backpacking
- Winter: Light Winter (North), Heavy Winter, Layered Casual

GLOBAL EVERYDAY:
- Work: Office Formal, Office Casual, Hybrid Work, Remote Work Casual, Interview, Business Meeting
- Casual: Café Hopping, Casual Hangout, Shopping, Weekend Errands, Study Session
- Social: Brunch, Dinner Date, Party, Bar Night, Music Festival, Concert
- Active: Gym, Yoga, Running, Sports, Travel

FALLBACK RULES:
- If uncertain, use BROAD categories (e.g., "Casual Outing", "Party", "Travel") NOT hyper-specific events
- Never hallucinate specific event names (e.g., "John's Birthday") – stick to event TYPES
- For ambiguous formal wear → "Smart Casual" or "Semi-Formal"
- For home/loungewear → "Casual/Home"

Judging criteria: formality, polish, contrast, comfort, cultural appropriateness, seasonal vibes

🎨 2. STYLE — "Aesthetic Language" (Design System)
Define the visual design language: silhouette + color palette + styling approach.

STYLE CATEGORIES (with Indian context):
- Indian Fusion: Ethnic Fusion, Indo-Western, Traditional/Ethnic, Desi Streetwear
- Modern Global: Minimalist, Streetwear, Smart Casual, Y2K, Vintage, Grunge, Preppy, Athleisure
- Niche: Boho, Athletic Luxe, Techwear, Gothic/Dark, Cottagecore, E-girl/E-boy, Hypebeast, Quiet Luxury

INDIAN-SPECIFIC EXAMPLES:
- Kurta + Jeans = Ethnic Fusion or Indo-Western
- Oversized Kurta + Sneakers = Desi Streetwear  
- Saree/Lehenga = Traditional/Ethnic
- Western Crop Top + Palazzo = Indo-Western

Judging: silhouette harmony, fit proportion, theme consistency, cultural authenticity

🌈 3. VIBE — "Emotional Energy" (Feel)
Define the emotional tone this look projects. Read the energy instantly.

VIBE EXAMPLES:
- Energy: Chill/Cozy, Energetic, Vibrant, Bold/Statement, Playful/Youthful
- Mood: Elegant/Refined, Relaxed/Effortless, Sharp/Assertive, Powerful, Romantic, Edgy, Festive
- Context: Polished, Casual, Understated, Maximalist, Experimental

Judging: visual energy, layering, accessories, color vibrancy, effort level

4. A brief, friendly comment about the outfit (under 15 words)
Make it supportive and encouraging, NOT judgmental or anxiety-inducing.

Respond ONLY with valid JSON in this exact format:
{
  "occasion": "Brunch",
  "style": "Smart Casual",
  "vibe": "Chill",
  "comment": "Effortlessly polished — perfect for a relaxed weekend vibe!"
}

Be confident, dynamic, and nuanced. Don't stick to examples if the outfit suggests something else.
Default to broader categories if uncertain. Never invent specific event names.`,
};

// ============================================
// IMAGE PROCESSING PROMPTS
// Used in: complete-clothing-image/index.ts, tryon-outfit/index.ts
// ============================================

export const IMAGE_PROMPTS = {
  COMPLETE_CLOTHING_ITEM: (itemType?: string) =>
    `Complete ONLY this single clothing item by extending any cut-off or missing parts (like sleeves, full length, hem, collar). 

CRITICAL REQUIREMENTS:
- Keep ONLY the single item shown - do NOT add any other clothing pieces
- Do NOT add pants if showing a top, do NOT add tops if showing pants
- Do NOT add accessories unless they are part of the original item
- Just extend the existing item to show its complete form
- Background MUST be pure white (#FFFFFF) with NO black borders, frames, or shadows
- The item should be laid flat and photographed from above (flat lay style)
- Remove any black borders, dark edges, or shadowy areas

Complete this ${itemType || "clothing item"} to show its full, uncut form on a clean pure white background.`,

  VALIDATE_TRYON_IMAGE: `Analyze this image for virtual try-on suitability:
1. Is it a clear, full-length photo?
2. Is the lighting good?
3. Is the person visible and not cropped?

Respond with a boolean 'suitable' and a 'reason' if not suitable.`,

  GENERATE_TRYON: (outfitItems: any[]) =>
    `Apply these clothing items to the person in the image realistically:
${outfitItems.map((item: any) => `- ${item.category}: ${item.name} (${item.color})`).join("\n")}

Maintain:
- Natural fabric fit and drape
- Correct perspective and body proportions
- Original skin tone and features
- Realistic shadows and lighting
- Professional fashion photography quality`,
};
