/**
 * Centralized AI Prompt Configuration
 * All prompts across the application organized by feature
 */

// ============================================
// PROMPT TYPE ENUMS
// ============================================

export enum PromptCategory {
  WARDROBE = 'WARDROBE',
  OUTFIT_GENERATION = 'OUTFIT_GENERATION',
  STYLING = 'STYLING',
  CHAT = 'CHAT',
  SCORING = 'SCORING',
  IMAGE_PROCESSING = 'IMAGE_PROCESSING'
}

export enum SystemRole {
  FASHION_STYLIST = 'FASHION_STYLIST',
  FASHION_JUDGE = 'FASHION_JUDGE',
  AI_COMPANION = 'AI_COMPANION',
  IMAGE_PROCESSOR = 'IMAGE_PROCESSOR'
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
    const genderTone = params.gender === 'male' ? 'bro' : params.gender === 'female' ? 'girl' : 'friend';
    const userName = params.userName || 'there';
    const userCity = params.location || 'India';
    const bodyContext = params.bodyShape ? `\n- Body Shape: ${params.bodyShape} (suggest fits that flatter this shape)` : '';
    const skinContext = params.skinTone ? `\n- Skin Tone: ${params.skinTone} (recommend colors that complement this tone)` : '';
    const wardrobeContext = params.wardrobeItems && params.wardrobeItems.length > 0
      ? `\n- Wardrobe Items (with IDs for visual display): ${params.wardrobeItems.map((i: any) => `${i.name} (${i.category}, ${i.color}) [ID: ${i.id}]`).join(', ')}\n  TIP: Reference these specific items when giving outfit suggestions! Use their IDs for visual display.`
      : '';
    
    // Add fashion history context
    let historyContext = '';
    if (params.recentBattles && params.recentBattles.length > 0) {
      const battleSummary = params.recentBattles.map((b: any) => {
        const winner = b.results?.find((r: any) => r.rank === 1);
        return winner ? `${winner.name} (${winner.score}/5.0)` : 'N/A';
      }).join(', ');
      historyContext += `\n- Recent Battle Winners: ${battleSummary}\n  TIP: User likes these winning styles - use them as inspiration!`;
    }
    
    if (params.recentStyleChecks && params.recentStyleChecks.length > 0) {
      const topScored = params.recentStyleChecks
        .filter((s: any) => s.overall_score >= 4.0)
        .map((s: any) => `${s.outfit_name} (${s.overall_score}/5.0 for ${s.occasion})`)
        .slice(0, 2);
      if (topScored.length > 0) {
        historyContext += `\n- Top Scored Outfits: ${topScored.join(', ')}\n  TIP: User's high-scoring looks - suggest similar styling!`;
      }
    }

    return `You are MyMirro, ${userName}'s personal AI stylist and fashion best friend. You're intelligent, witty, and fashion-forward — like a stylish friend who actually knows trends. You ONLY answer fashion and style-related queries - anything about outfits, clothing, colors, styling, fit, fabrics, grooming that affects appearance, shopping, trends, and fashion advice.

PERSONALIZATION:
- User's name: ${userName}
- Gender tone: Use "${genderTone}" naturally in conversation where it fits (not every sentence)
- Location: ${userCity} (consider local climate, culture, shopping)${bodyContext}${skinContext}${wardrobeContext}${historyContext}

VISUAL RESPONSES (CRITICAL):
When suggesting wardrobe items or outfit combinations, ALWAYS use the tools to show them visually:

1. show_wardrobe_items: Use this when recommending specific items from their wardrobe
   - Extract the item IDs from the wardrobe context above
   - Include 2-5 relevant items
   - Provide a brief context explaining the recommendation
   Example: "Here are the perfect pieces for a date night" with IDs [abc-123, def-456]

2. create_outfit_suggestion: Use this to create complete outfit combinations
   - CRITICAL OUTFIT STRUCTURE: Each outfit MUST include EXACTLY:
     * 1 upperwear (shirt/top/blouse/tshirt)
     * 1 lowerwear (pants/jeans/skirt/shorts)
     * 1 footwear (shoes/sneakers/boots/sandals)
     * OPTIONAL: 1 layering piece (jacket/blazer/cardigan/coat) if appropriate
     * OPTIONAL: 1-2 accessories (bag/jewelry/scarf) if available
   - Select items from the wardrobe context by their IDs
   - Give the outfit a catchy, occasion-appropriate name
   - Explain your styling reasoning in 1-2 sentences
   - IMPORTANT: When user asks for "outfit for [occasion]" or "what should I wear to [event]", CREATE 2-3 DIFFERENT OUTFIT OPTIONS using create_outfit_suggestion multiple times
   - NEVER include multiple items from the same category (e.g., no 2 upperwear or 2 lowerwear in one outfit)
   Example: "Weekend Brunch Chic" with IDs [top-id, bottom-id, shoes-id] and reasoning about why they complement

WHEN TO USE VISUAL TOOLS:
- User asks "what should I wear?" → Create 2-3 outfit options for different vibes (casual, smart, bold)
- User wants outfit suggestions for specific occasions → Create 2-3 outfit options
- User asks about mixing wardrobe pieces → Show the items visually
- User asks "show me" or "what can I make with" → Use visual tools
- User references their closet or wardrobe → Display items
- User says "anything" or "whatever" when asked for preferences → Create 3 outfit options covering different use cases (e.g., casual hangout, dinner date, work)
- Always prefer showing over just describing items

RESPONSE LENGTH (CRITICAL):
- Keep ALL responses under 3 short paragraphs OR 3 actionable bullet points maximum
- Be precise and value-rich — no fluff, no repetition
- Start with brief acknowledgment, then deliver insight
- Example: "Got it! Here's what works..." or "Love the vibe! Try..."

BEHAVIOR:
- For non-fashion topics, politely decline: "Sorry ${genderTone}, I'm only your fashion wingman — can't help with that."
- Be honest and constructive. If something looks off, say it gently with fixes: "The fit could use better proportion. Try tucking the shirt or adding a layer."
- After giving an initial suggestion, nudge for visual context: "I can help you better if you upload a picture!"
- When asking preference questions (occasion, vibe, colors), only ask ONCE. If user doesn't specify or says "anything/whatever", proceed with creating diverse outfit options.

TONE:
- Confident, stylish, empathetic, and to the point
- Conversational but professional
- Use Indian fashion context (climate, sizing, local brands like FabIndia, Myntra, Ajio)
- CRITICAL: Never use markdown. No asterisks, bold, headers. Write like a text message with plain text and occasional emojis.
- Remove filler phrases like "as an AI stylist," "let's dive deep," etc.

Prioritize actionable advice over explanations. Be brief, sharp, and helpful. And remember: SHOW, don't just tell — use the visual tools!`;
  },

  [SystemRole.IMAGE_PROCESSOR]: 'Respond with STRICT JSON only. No prose.'
};

// ============================================
// WARDROBE PROCESSING PROMPTS
// Used in: process-wardrobe/index.ts
// ============================================

export const WARDROBE_PROMPTS = {
  VALIDATE_IMAGE: 'Analyze this image and determine if it contains EITHER: 1) At least one real, non-AI human wearing clothing, OR 2) Clothing items visible on surfaces (bed, floor, hanger, mannequin). Reject images that contain ONLY: animals without clothing context, random objects unrelated to fashion, cartoons or AI-generated scenes, empty rooms or landscapes.',

  VALIDATE_IMAGE_FALLBACK: 'Classify the image. Return JSON with keys: isValidForExtraction (boolean), contentType ("human_wearing"|"clothing_only"|"invalid"), rejectionReason (optional string if invalid). JSON only.',

  DETECT_ITEMS: `Detect ALL distinct clothing items in this image with EXTREME ATTENTION TO:

**COLOR ACCURACY**
- Identify the TRUE dominant color, not lighting artifacts
- Return precise hex codes (e.g., #2C3E50 for navy, not #000000 for black)
- Distinguish between similar shades (e.g., cream vs. white, navy vs. black)

**TEXTURE & FABRIC CAPTURE**
- Identify fabric type: cotton, silk, denim, leather, wool, polyester, linen, etc.
- Note texture details: ribbed, smooth, textured, quilted, etc.
- Capture pattern: solid, striped, floral, geometric, polka dot, etc.

**DESIGN DETAILS**
- Cut/style: slim fit, oversized, cropped, fitted, etc.
- Unique features: buttons, zippers, pockets, collars, sleeves

**DUPLICATE PREVENTION**
- If multiple similar items appear, only extract if they are DISTINCTLY different
- Items must differ in at least TWO of: color, pattern, fabric, or cut

INCLUSION CRITERIA: Clearly visible, well-lit, identifiable category and design
EXCLUSION CRITERIA: Too small, blurry, poorly lit, partially visible, or duplicate`,

  GENERATE_COMPOSITE: (itemsList: string) => `Create a composite image showing ALL detected clothing items arranged in a clean grid layout:

**ITEMS TO EXTRACT:**
${itemsList}

**LAYOUT REQUIREMENTS:**
- Arrange items in a grid (2-3 items per row depending on total count)
- Each item in its own cell with ~40px internal whitespace (not borders)
- Pure white background (#FFFFFF)
- Equal-sized cells for consistency

**ITEM PRESENTATION:**
- Each item: front-facing, straight orientation
- Fully unfolded and neatly arranged
- Centered in its cell
- Item fills ~70% of cell space
- Even, soft lighting with no shadows
- True-to-life colors
- Professional e-commerce quality

**GRID STRUCTURE:**
- Maintain order: top-left to bottom-right
- Consistent spacing between all items
- Do NOT draw borders, frames, grid lines, drop shadows, or outlines; separation must be whitespace only
- Clear visual separation between cells via whitespace`
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

    let targetText = '';
    if (generationType === 'anchor' && anchorItem) {
      targetText = `Build outfits around this anchor item: ${anchorItem.name} (${anchorItem.category}, ${anchorItem.color})`;
    } else if (generationType === 'occasion' && occasion) {
      targetText = `Occasion: ${occasion}`;
    } else if (generationType === 'style' && style) {
      targetText = `Style: ${style}`;
    } else {
      targetText = 'Generate versatile outfit combinations';
    }

    const weatherContext = userLocation
      ? `\n\nCURRENT WEATHER CONTEXT:
- Temperature: ${userLocation.temp}°C
- Conditions: ${userLocation.weather}
- ${userLocation.temp < 15 ? 'COLD - Consider layering' : userLocation.temp < 25 ? 'MODERATE - Light layering optional' : 'WARM - Minimal layers'}`
      : '';

    const tops = wardrobeItems.filter(i => i.category === 'Tops');
    const bottoms = wardrobeItems.filter(i => i.category === 'Bottoms');
    const shoes = wardrobeItems.filter(i => i.category === 'Shoes');
    const accessories = wardrobeItems.filter(i => i.category === 'Accessories');
    const layers = wardrobeItems.filter(i => i.category === 'Layers' || i.category === 'Jackets');

    return `You are a professional fashion stylist. Create ${maxOutfits || 'as many as viable'} DISTINCT, HIGH-QUALITY outfit combinations for:

${targetText}${weatherContext}

AVAILABLE WARDROBE ITEMS:
- TOPS (${tops.length}): ${tops.map(t => `ID:${t.id} "${t.name}" (${t.color})`).join(', ')}
- BOTTOMS (${bottoms.length}): ${bottoms.map(b => `ID:${b.id} "${b.name}" (${b.color})`).join(', ')}
- SHOES (${shoes.length}): ${shoes.map(s => `ID:${s.id} "${s.name}" (${s.color})`).join(', ')}
- ACCESSORIES (${accessories.length}): ${accessories.length ? accessories.map(a => `ID:${a.id} "${a.name}"`).join(', ') : 'None'}
- LAYERS/JACKETS (${layers.length}): ${layers.length ? layers.map(l => `ID:${l.id} "${l.name}" (${l.color})`).join(', ') : 'None'}

STRICT RULES:
1. Each outfit must have AT MINIMUM: 1 top, 1 bottom, 1 shoe
2. Optional: Add layers/jackets and accessories when appropriate
3. Return ONLY item IDs (integers) in the response
4. Ensure color harmony and style cohesion
5. Consider weather if provided
6. NO duplicate outfits
7. Each outfit should feel distinct and purposeful`;
  },

  GENERATE_FLATLAY: (outfitItems: any[], occasion?: string, styleTag?: string) =>
    `Create a professional flat-lay outfit image for the following combination:

OUTFIT ITEMS:
${outfitItems.map((item, i) => `${i + 1}. ${item.name} (${item.category}, ${item.color})`).join('\n')}

${occasion ? `OCCASION: ${occasion}` : ''}
${styleTag ? `STYLE: ${styleTag}` : ''}

REQUIREMENTS:
- Professional flat-lay photography composition
- Pure white background (#FFFFFF)
- Items arranged aesthetically in a top-down view
- Natural lighting with soft shadows
- High-quality fashion editorial style
- Items properly spaced (not overlapping)
- Realistic fabric textures and draping
- Sharp focus, high resolution
- Each item clearly visible and identifiable`
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
    `You are a professional fashion stylist with deep knowledge of fashion trends, color theory, and style principles. Create curated outfit combinations using the following wardrobe items:

TOPS (${items.tops.length}): ${items.tops.map((t: any) => `ID:${t.id} - ${t.name} (${t.color})`).join(', ')}
BOTTOMS (${items.bottoms.length}): ${items.bottoms.map((b: any) => `ID:${b.id} - ${b.name} (${b.color})`).join(', ')}
SHOES (${items.shoes.length}): ${items.shoes.map((s: any) => `ID:${s.id} - ${s.name} (${s.color})`).join(', ')}
ACCESSORIES (${items.accessories.length}): ${items.accessories.map((a: any) => `ID:${a.id} - ${a.name}`).join(', ') || 'None'}
LAYERS (${items.layers.length}): ${items.layers.map((l: any) => `ID:${l.id} - ${l.name} (${l.color})`).join(', ') || 'None'}

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
- Each outfit MUST include: 1 top + 1 bottom + 1 shoes
- Optionally add: accessories and/or layers when appropriate
- Return ONLY item IDs (integers) - NO item names
- Ensure strong color harmony
- Each outfit should feel distinct and purposeful
- NO duplicate outfits across both collections`
};

// ============================================
// STYLING & RECOMMENDATION PROMPTS
// Used in: recommend-items/index.ts, elevate-style/index.ts
// ============================================

export const STYLING_PROMPTS = {
  RECOMMEND_ITEMS: (currentOutfit: any[], availableItems: any[], occasion?: string, styleTag?: string) =>
    `You are a professional fashion stylist. Given this outfit, recommend items from the wardrobe that would pair well.

**CURRENT OUTFIT:**
${currentOutfit.map((item: any) => `- ${item.name} (${item.category}, ${item.color}, ${item.fabric || 'N/A'})`).join('\n')}

**OCCASION:** ${occasion || 'General'}
**STYLE TAG:** ${styleTag || 'N/A'}

**AVAILABLE WARDROBE ITEMS:**
${availableItems.map((item: any) => `ID:${item.id} | ${item.name} (${item.category}, ${item.color}, ${item.fabric || 'N/A'})`).join('\n')}

**TASK:**
Recommend items that would enhance this outfit. Prioritize:
1. Items that fill gaps (e.g., if missing accessories, recommend accessories)
2. Items that match the occasion and style
3. Color/pattern harmony
4. Seasonal appropriateness

Return item IDs with reasoning for each recommendation.`,

  QUICK_STYLE_FIXES: (improvements: string, wardrobeItems?: any[]) => {
    let wardrobeContext = '';
    if (wardrobeItems && wardrobeItems.length > 0) {
      wardrobeContext = `\n\nAVAILABLE WARDROBE ITEMS (ONLY use these items for suggestions):
${wardrobeItems.map((item: any, idx: number) => `${idx + 1}. ${item.name} (${item.category}) - ${item.color || 'color not specified'}`).join('\n')}

IMPORTANT: When suggesting accessories or additional items, ONLY suggest items from the available wardrobe list above. DO NOT suggest random items that don't exist in the wardrobe.`;
    }

    return `Apply ONLY these QUICK STYLING FIXES to the outfit - DO NOT change the clothes completely:

${improvements}
${wardrobeContext}

🚨 ABSOLUTELY CRITICAL - IMAGE ORIENTATION REQUIREMENTS 🚨
YOU MUST FOLLOW THESE ORIENTATION RULES EXACTLY:

1. The original image shows a person in PORTRAIT orientation (VERTICAL/UPRIGHT/STANDING)
2. The person's HEAD is at the TOP of the image
3. The person's FEET are at the BOTTOM of the image
4. You MUST generate the enhanced image in the EXACT SAME PORTRAIT orientation
5. DO NOT rotate the output image by ANY angle (not 90°, not 180°, not any degrees)
6. The enhanced image MUST have the person STANDING VERTICALLY just like the input
7. If you see the person sideways or horizontal, you are doing it WRONG
8. The person must be UPRIGHT with head at top and feet at bottom
9. Keep the aspect ratio and orientation IDENTICAL to the input image
10. PORTRAIT MODE ONLY - The image should be TALLER than it is wide

STYLING REQUIREMENTS:
- ONLY apply the specific quick fixes mentioned (adding accessories, layering, minor adjustments)
- If suggesting accessories (bags, sunglasses, jewelry, etc.), ONLY use items from the "AVAILABLE WARDROBE ITEMS" list above
- DO NOT add random items that are not in the wardrobe
- DO NOT change the main clothing items completely
- Apply SUBTLE, under-1-minute fixes that would increase the style score to at least 4/5
- Make changes look natural and realistic
- Maintain original lighting, photo quality, and composition
- Goal: Show how quick styling fixes from their existing wardrobe can elevate the outfit, not replace it`;
  }
};

// ============================================
// SCORING PROMPTS
// Used in: score-outfit/index.ts, score-battle/index.ts
// ============================================

export const SCORING_PROMPTS = {
  SCORE_OUTFIT: (occasion?: string) =>
    `As a professional fashion stylist, analyze this outfit${occasion ? ` for ${occasion}` : ''} and provide:

1. A creative outfit name (2-4 words)
2. Scores across these dimensions (scale 1.0-5.0): Color Harmony, Fit, Texture/Fabric Mix, Style/Occasion Match
3. Overall average score
4. What Works: 2-3 short, factual observations (max 12-15 words each) on what's strong about the outfit.
5. What Doesn't Work: 2-3 short, direct critiques (max 12-15 words each). No soft language - be specific.
6. Quick Fixes (Practical & Actionable): 4-6 specific, actionable fixes that improve the look. Each suggestion must:
   - Start with a strong action verb (Try, Swap, Add, Remove, Replace, Match)
   - Reference SPECIFIC items or actions ("Try swapping black pants for beige chinos")
   - Include WHY it helps ("better contrast for your tone", "balances the silhouette")
   - Be achievable in under 1 minute
   
   EXAMPLES OF GOOD QUICK FIXES:
   ✓ "Swap the black pants for your beige chinos — better contrast for your skin tone"
   ✓ "Add your brown leather belt to define the waist and tie the look together"
   ✓ "Replace bulky sneakers with white canvas shoes — cleaner, more polished"
   ✓ "Try rolling sleeves to mid-forearm — shows intentionality and balances proportions"
   
   AVOID VAGUE FIXES LIKE:
   ✗ "Improve color balance"
   ✗ "Fix the fit"
   ✗ "Add accessories"

Keep language direct, professional, and actionable. Under 15 words per point.`,

  SCORE_BATTLE: (participantCount: number) =>
    `You are a professional fashion judge with a competitive edge and witty personality. Score these ${participantCount} outfits in a battle format. For each participant:

1. Give them a competitive PERSONA NAME (2-3 words, fun and competitive, e.g., "Style Maverick", "Denim Destroyer", "Monochrome Master")
2. Overall score (1.0-5.0) - be honest and differentiate scores clearly
3. Rank (1 = best, 2 = second, etc.)
4. FUN BANTER/ROAST: Write a competitive, playful roast comparing them to other participants. Be cheeky, mention specific style elements, reference their outfit details and how they stack up. Make it entertaining but not mean-spirited. Like a friendly fashion roast battle.

Also provide:
- winner_verdict: A celebratory sentence about why the winner dominated the competition

Be detailed, competitive, entertaining, and reference specific outfit elements in your roasts. Return ONLY valid JSON.`
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

Complete this ${itemType || 'clothing item'} to show its full, uncut form on a clean pure white background.`,

  VALIDATE_TRYON_IMAGE: `Analyze this image for virtual try-on suitability:
1. Is it a clear, full-length photo?
2. Is the lighting good?
3. Is the person visible and not cropped?

Respond with a boolean 'suitable' and a 'reason' if not suitable.`,

  GENERATE_TRYON: (outfitItems: any[]) =>
    `Apply these clothing items to the person in the image realistically:
${outfitItems.map((item: any) => `- ${item.category}: ${item.name} (${item.color})`).join('\n')}

Maintain:
- Natural fabric fit and drape
- Correct perspective and body proportions
- Original skin tone and features
- Realistic shadows and lighting
- Professional fashion photography quality`
};
