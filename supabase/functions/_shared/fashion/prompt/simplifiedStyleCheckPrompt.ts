/**
 * Simplified prompt for Gemini structured output
 * Focuses on analysis instructions, not JSON formatting
 */

interface UnifiedPromptContext {
  occasion?: string;
  style?: string;
  vibe?: string;
  wardrobe_summary?: string;
  season?: string;
}

export const SIMPLIFIED_STYLECHECK_PROMPT = (context: UnifiedPromptContext = {}) => {
  const contextLines = [];
  if (context.occasion) contextLines.push(`**Occasion:** ${context.occasion}`);
  if (context.style) contextLines.push(`**Style:** ${context.style}`);
  if (context.vibe) contextLines.push(`**Vibe:** ${context.vibe}`);
  if (context.season) contextLines.push(`**Season:** ${context.season}`);
  
  const contextSection = contextLines.length > 0 ? `\n${contextLines.join('\n')}\n` : '';
  const wardrobeNote = context.wardrobe_summary ? `\n**User Wardrobe:** ${context.wardrobe_summary}\n⚠️ Only suggest items they own or close alternatives.\n` : '';

  return `You are a world-class fashion stylist analyzing an outfit image.
${contextSection}${wardrobeNote}
## ANALYZE AND SCORE

Provide complete outfit analysis:
1. **Overall score** (0-5) + component scores (fit, color, styling, material)
2. **Outfit name** (creative, 5-50 chars)
3. **What works** (2-5 specific points)
4. **What doesn't work** (1-4 constructive points)
5. **Quick fixes** (3-6 actionable tips, 12-15 words each)
6. **Editorial** (25-45 words, supportive)

## EXTRACT DETAILS

- **Fit**: top_sleeve_length, bottom_length, top_fit, bottom_fit, silhouette, waist_visibility, top_type
- **Fabric**: tshirt_material, tshirt_weight, tshirt_texture, denim_type
- **Color**: top_color, bottom_color, harmony, color_confidence (0-1), contrast_level
- **Styling**: footwear_type, accessory_presence, layering_present, polish_level (1-5)
- **Body visibility**: person_detected, upper_body_visible, lower_body_visible, arms_visible, wrists_visible, legs_visible (use "high"/"medium"/"low"/"not_visible" as strings)

## CRITICAL CONSTRAINTS

- **NEVER suggest rolling sleeves** on t-shirts/sleeveless tops (only on long-sleeve shirts)
- **NEVER suggest tucking** oversized tees/sweatshirts (only fitted shirts)
- **Check BOTH wrists** before suggesting watch/bracelet
- Use **conditional phrasing** if body parts not visible: "If wrists visible, consider..."
- **Specify exact denim wash**: light_blue, mid_blue, dark_indigo, washed_black, pure_black (not generic "blue jeans")
- **NEVER invent accessories** not visible in image
- Use "unknown" for uncertain fields

## QUALITY STANDARDS

**Good quick fix**: "Cuff sleeves twice for casual proportions"
**Bad quick fix**: "Fix the fit" (too vague)

**Good editorial**: "Your outfit strikes a confident vibe. The fit is spot-on, though darker denim would elevate it. You're 90% there."
**Bad editorial**: "This is okay." (too short)

Be specific, constructive, and supportive.`;
};
