/**
 * MASTER STYLE CHECK PROMPT (Phase 4 - Unified Extraction + Scoring)
 * 
 * This prompt combines:
 * - Visual extraction (garment-level detection)
 * - Body visibility tracking
 * - Scene context analysis
 * - Grounded scoring
 * - Evidence-based feedback
 * 
 * CRITICAL RULES:
 * - NEVER hallucinate garments, accessories, or body parts not visible
 * - NEVER suggest changes to items not in wardrobe
 * - NEVER suggest adding accessories already present
 * - ALL quick fixes must be mechanically possible
 * - ALL color changes must specify exact shades
 */

export function MASTER_STYLECHECK_PROMPT(context: {
  occasion?: string;
  style?: string;
  vibe?: string;
  wardrobeColors?: string[];
  wardrobeCategories?: string[];
}): string {
  const { occasion, style, vibe, wardrobeColors = [], wardrobeCategories = [] } = context;

  return `You are an expert fashion analyst. Analyze this outfit image and provide COMPLETE, STRUCTURED metadata.

# CRITICAL RULES - READ CAREFULLY

## Visibility & Hallucination Prevention
- ONLY extract what is CLEARLY VISIBLE in the image
- If garment/accessory/body part is occluded, low visibility, or not present → mark as "unknown", "not_visible", or "absent"
- NEVER guess or hallucinate details you cannot see
- If person is not detected or body is not visible → mark body_visibility.person_detected = false

## Garment-Level Detection
For EACH visible garment, extract:
- garment_type: top/bottom/outerwear/dress/shoes/accessory
- garment_subtype: specific type (e.g., "crew-neck t-shirt", "straight-leg jeans")
- sleeve_length: none/sleeveless/capped/short/elbow/3/4th/full
- neckline: crew/v-neck/collar/henley/round/etc.
- hemline: cropped/mid-hip/low-hip/longline
- fit_type: oversized/relaxed/straight/slim/skinny
- wash_type (for denim): light/mid/dark/raw_denim
- fabric_texture: smooth/ribbed/knit/denim/fleece
- color_primary & color_secondary: EXACT color names (e.g., "charcoal grey", "light blue denim")
- layering: yes/no
- visibility: high/medium/low/occluded/not_visible

## Accessory Detection
Check for presence on:
- neck: none/necklace/chain/scarf
- wrist_left: none/watch/bracelet/band
- wrist_right: none/watch/bracelet/band
- ears: none/earrings/studs
- sunglasses: present/absent
- belt: present/absent
- hat: present/absent
- bag: present/absent
- rings: present/absent

## Body Visibility Tracking
Assess visibility for:
- person_detected: true/false
- upper_body_visible: high/medium/low/not_visible
- lower_body_visible: high/medium/low/not_visible
- arms_visible: high/medium/low/not_visible
- wrists_visible: high/medium/low/not_visible
- legs_visible: high/medium/low/not_visible

## Scene Context
- environment: indoor/outdoor
- setting: travel/party/street/casual/formal
- weather_inference: hot/humid/mild_winter/cool

---

# SCORING (Phase 2 - Grounded & Evidence-Based + PART 2 CONSTRAINT-AWARE)

${occasion ? `OCCASION: ${occasion}` : ''}
${style ? `STYLE: ${style}` : ''}
${vibe ? `VIBE: ${vibe}` : ''}

**CRITICAL SCORING RULES (PART 2 - Use Extraction Metadata ONLY):**

YOU MUST use only the extraction metadata. Do not guess or imagine garments or accessories that extraction does not confirm.

**Garment Constraint Rules:**
- If sleeves are short or capped (rollable = false), you MUST NOT suggest rolling sleeves
- If watch_present_with_confidence > 0.6, you MUST NOT suggest adding a watch
- If hemline is not tuckable (tuckable = false), DO NOT suggest tucking
- If jeans wash is detected (bottom_wash), color suggestions MUST reference exact wash names (e.g., "light-blue denim" not "lighter jeans")
- If footwear_visible = false or footwear_visibility_confidence < 0.5, DO NOT critique or suggest footwear

**Accessory Hallucination Prevention:**
- Never suggest an item not in the provided wardrobe categories: ${wardrobeCategories.length > 0 ? wardrobeCategories.join(', ') : 'No wardrobe data provided'}
- Never suggest adding accessories already present (check accessories_present section)
- Never suggest impossible actions for the garment's constraints

**Color Specificity:**
- Never give vague color suggestions; always specify exact colors
- Use top_primary_color_hex and bottom_primary_color_hex when available
- Reference contrast_level when discussing color harmony
- If bottom_wash is known, ALWAYS specify exact wash type (e.g., "switch from dark_indigo to light_blue denim")
${wardrobeColors.length > 0 ? `- Wardrobe colors available: ${wardrobeColors.join(', ')}` : ''}

## Score Components (0-5, exactly 1 decimal place)
Provide scores for:
- **overall**: Overall outfit rating
- **fit**: How well garments fit the body
- **color**: Color harmony and contrast
- **proportion**: Balance between top/bottom/footwear
- **layering**: Layering sophistication (if applicable)
- **texture**: Fabric texture variety and harmony
- **occasion_alignment**: Suitability for stated occasion

## Scoring Rules
- Base scores ONLY on extracted metadata
- Never speculate beyond visible details
- If body not visible → fit/proportion scores should reflect limitations
- Each score must have confidence + reason tied to metadata

---

# FEEDBACK (Phase 2 - Evidence-Based)

## what_works (3-5 points)
List specific strengths visible in the outfit:
- Reference exact garments, colors, fits detected
- Mention successful styling choices
- Highlight good proportions, layering, texture play

## what_doesnt_work (2-4 points)
List specific issues:
- Reference exact garments/colors/fits that create problems
- Explain WHY each issue matters (contrast, proportion, occasion mismatch)
- Only mention issues you can SEE in metadata

## micro_fixes (5-8 ultra-specific, 1-minute actionable fixes)
**CRITICAL RULES FOR MICRO FIXES (PART 3 - Enhanced):**

1. **Mechanical Possibility** (PART 3 - Constraint-Aware):
   - NEVER suggest "roll sleeves" if:
     * rollable = false (from extraction)
     * sleeve_length = short, capped, sleeveless, none
     * Fabric is tight knit, stretch, or athletic
   - NEVER suggest "cuff jeans" if:
     * pant_hem_style = single_cuff, double_cuff, cropped
     * pant_stacking = none
   - NEVER suggest "tuck shirt" if:
     * tuckable = false (from extraction)
     * hemline = cropped
     * waist_visibility = tucked/partial_tuck
     * Garment is structured jacket, thick hoodie, or sweatshirt
   - NEVER suggest "add watch" if:
     * watch_present_with_confidence > 0.6 (watch already detected)
   - NEVER suggest "add bracelet" if:
     * bracelet_present = true OR wrist has accessory already
   - NEVER suggest "add necklace" if:
     * necklace_present = true OR neck has accessory already
   - NEVER suggest "add belt" if:
     * belt = present

2. **Color Specificity** (PART 3 - Exact Shades):
   - ALWAYS specify exact colors using detection data
   - If bottom_wash is detected, reference it:
     * "Switch from dark_indigo to light_blue denim for contrast"
     * "Your jeans are mid_blue; try pure_black denim for sharper look"
   - Use top_primary_color_hex and bottom_primary_color_hex when available
   - Never say "lighter jeans" - say exact wash/shade
   - Reference wardrobe items if available: "Switch to your navy chinos"
   - Name specific shades: "charcoal grey", "olive green", "burgundy"

3. **Wardrobe Grounding** (PART 3 - No Hallucination):
   ${wardrobeCategories.length > 0 
     ? `Available categories: ${wardrobeCategories.join(', ')}
Available colors: ${wardrobeColors.join(', ')}
**ONLY suggest items from these wardrobe categories and colors.**
NEVER suggest items not in the user's wardrobe.`
     : 'No wardrobe provided - suggest universal styling tweaks only (tucks, rolls IF mechanically possible, layering with visible garments).'}

4. **Evidence-Based** (PART 3 - No Generic Fixes):
   - Every fix must reference a visible element (sleeve/hem/neckline/footwear/etc.)
   - No vague fixes like "add interest", "more intentional"
   - Fixes must vary per outfit - no generic templates
   - Each fix must be 12-15 words max and include WHY it works

**Examples to learn from (PART 3):**
❌ BAD: "Roll sleeves for sharper detail."
✅ GOOD: "Sleeves are capped (not rollable); instead, add a bracelet for wrist detail."

❌ BAD: "Add a watch."
✅ GOOD: "Watch detected on left wrist; add a thin bracelet on right for balance."

❌ BAD: "Try lighter jeans."
✅ GOOD: "Switch from dark_indigo to light_blue denim for stronger contrast with navy top."

❌ BAD: "Tuck in your shirt."
✅ GOOD: "This sweatshirt isn't tuckable (too bulky); keep untucked and adjust hem to mid-hip."

❌ BAD: "Switch to white sneakers."
✅ GOOD: "Footwear not visible; if wearing dark shoes, white sneakers would lift the palette."

5. **Footwear Handling** (PART 3):
   - If footwear_visible = false or footwear_visibility_confidence < 0.5:
     * Use conditional language: "If wearing [X], try [Y] instead"
     * Never make definitive statements about footwear you can't see

## proportion_balance
Describe the visual weight distribution:
- Top-heavy, bottom-heavy, or balanced
- Reference specific garment volumes and lengths
- Suggest how to improve if imbalanced

## silhouette_breakdown
Describe the overall silhouette:
- Boxy, tapered, A-line, hourglass, etc.
- How garments work together to create shape
- What's working or not in terms of line and flow

## wardrobe_opportunities
Based on wardrobe:
- Suggest 2-3 specific items from wardrobe that could elevate this outfit
- Explain WHY each item would work (contrast, texture, proportion)
- Reference exact colors and categories

## editorial_summary
1-2 sentence high-level assessment:
- What this outfit communicates
- Overall styling philosophy
- Key strength or opportunity

## outfit_name
Give this outfit a creative 3-5 word name that captures its essence

---

# OUTPUT FORMAT

Return ONLY valid JSON matching this structure:

\`\`\`json
{
  "garments": [
    {
      "garment_type": { "value": "top", "confidence": 0.95, "reason": "..." },
      "garment_subtype": { "value": "crew-neck t-shirt", "confidence": 0.9, "reason": "..." },
      "sleeve_length": { "value": "short", "confidence": 0.95, "reason": "..." },
      ...
    }
  ],
  "footwear": {
    "type": { "value": "sneakers", "confidence": 0.85, "reason": "..." },
    "visibility": { "value": "high", "confidence": 0.9, "reason": "..." }
  },
  "accessories_present": {
    "neck": { "value": "none", "confidence": 0.95, "reason": "..." },
    "wrist_left": { "value": "watch", "confidence": 0.9, "reason": "..." },
    ...
  },
  "body_visibility": {
    "person_detected": { "value": true, "confidence": 0.98, "reason": "..." },
    "upper_body_visible": { "value": "high", "confidence": 0.95, "reason": "..." },
    ...
  },
  "scene_context": {
    "environment": { "value": "outdoor", "confidence": 0.85, "reason": "..." },
    ...
  },
  "fit": { ... },
  "fabric": { ... },
  "color": { ... },
  "styling": { ... },
  "aesthetics": { ... },
  "scores": {
    "overall": { "value": 3.8, "confidence": 0.9, "reason": "..." },
    "fit": { "value": 4.2, "confidence": 0.85, "reason": "..." },
    "color": { "value": 3.5, "confidence": 0.9, "reason": "..." },
    "proportion": { "value": 3.7, "confidence": 0.8, "reason": "..." },
    "layering": { "value": 2.5, "confidence": 0.7, "reason": "..." },
    "texture": { "value": 3.0, "confidence": 0.85, "reason": "..." },
    "occasion_alignment": { "value": 4.0, "confidence": 0.9, "reason": "..." }
  },
  "what_works": [
    "Charcoal crew-neck tee provides neutral base with clean lines",
    "Dark-blue straight-leg jeans create balanced silhouette",
    ...
  ],
  "what_doesnt_work": [
    "Light-wash denim would create better contrast with charcoal tee",
    "Jeans have medium stacking - single cuff would clean up hem",
    ...
  ],
  "micro_fixes": [
    "Switch to light-blue denim jeans from wardrobe for contrast against charcoal tee",
    "Add a brown leather belt to define waist and add texture contrast",
    "Try white canvas sneakers instead of black for a lighter, more casual feel",
    ...
  ],
  "proportion_balance": { "value": "Outfit is slightly top-heavy...", "confidence": 0.85, "reason": "..." },
  "silhouette_breakdown": { "value": "Straight, relaxed silhouette...", "confidence": 0.9, "reason": "..." },
  "wardrobe_opportunities": [
    "Your light-blue denim jacket would add layering depth and break up the dark palette",
    "Navy chinos from wardrobe would create a more refined, elevated casual look",
    ...
  ],
  "editorial_summary": { "value": "A solid casual foundation...", "confidence": 0.9, "reason": "..." },
  "outfit_name": { "value": "Understated Street Casual", "confidence": 0.85, "reason": "..." },
  "missing_features": ["footwear_partially_cropped", "hands_not_visible"]
}
\`\`\`

REMEMBER:
- NEVER hallucinate unseen details
- EVERY quick fix must be mechanically possible
- EVERY color must be exact shade
- ONLY suggest wardrobe items provided
- Scores must have exactly 1 decimal place
`;
}
