/**
 * Styling Rules Module - Phase 4
 * 
 * Generates fashion-intelligent hard rules that are injected into the prompt.
 * These rules help Gemini make better styling decisions.
 */

export interface StylingRulesInput {
  generationType: 'occasion' | 'style' | 'anchor';
  occasion?: string | null;
  style?: string | null;
  anchorItem?: any | null;
  temperatureC?: number | null;
}

/**
 * Builds compact styling rules string for prompt injection.
 * Returns a compact, XML-safe string to be placed in <RULESET> block.
 */
export function buildStylingRules(input: StylingRulesInput): string {
  const rules: string[] = [];
  
  // ============================================
  // CORE STYLING RULES (always included)
  // ============================================
  rules.push('• Colors: Prefer neutrals for gaps; avoid clashing saturated tones; use harmony (analogous/complementary).');
  rules.push('• Silhouettes: Balance oversized with slim; avoid oversized-on-oversized unless streetwear.');
  rules.push('• Patterns: One dominant + one subtle max; avoid 2 loud prints together.');
  rules.push('• Layering: base→mid→outerwear→accessories; respect natural layer order.');
  rules.push('• Completeness: Use ONLY provided items; NEVER invent missing pieces.');

  // ============================================
  // OCCASION RULES (dynamic)
  // ============================================
  if (input.occasion) {
    const occ = input.occasion.toLowerCase();
    
    if (occ.includes('wedding') || occ.includes('reception') || occ.includes('sangeet') || 
        occ.includes('mehendi') || occ.includes('festive') || occ.includes('festival')) {
      rules.push('• Occasion: Prefer formal silhouettes; avoid sneakers unless Indo-western; rich colors welcome.');
    } else if (occ.includes('office') || occ.includes('interview') || occ.includes('meeting') || 
               occ.includes('business') || occ.includes('formal') || occ.includes('corporate')) {
      rules.push('• Occasion: Maintain structure; avoid overly casual pieces; neutral palette preferred.');
    } else if (occ.includes('party') || occ.includes('club') || occ.includes('night out') || 
               occ.includes('date') || occ.includes('cocktail')) {
      rules.push('• Occasion: Allow bold pieces; emphasize contrast + statementwear; confident fits.');
    } else if (occ.includes('casual') || occ.includes('brunch') || occ.includes('daily') || 
               occ.includes('college') || occ.includes('weekend') || occ.includes('shopping')) {
      rules.push('• Occasion: Comfort-first; prefer breathable fits; relaxed silhouettes OK.');
    } else if (occ.includes('gym') || occ.includes('workout') || occ.includes('sport') || occ.includes('athletic')) {
      rules.push('• Occasion: Performance fabrics; functional fits; avoid formal pieces entirely.');
    } else if (occ.includes('travel') || occ.includes('vacation') || occ.includes('trip')) {
      rules.push('• Occasion: Versatile pieces; comfort + style balance; easy layering.');
    }
  }

  // ============================================
  // STYLE RULES (dynamic)
  // ============================================
  if (input.style) {
    const sty = input.style.toLowerCase();
    
    if (sty.includes('minimal') || sty.includes('minimalist')) {
      rules.push('• Style: Clean neutrals; avoid loud graphics; emphasize fit + quality.');
    } else if (sty.includes('street') || sty.includes('urban')) {
      rules.push('• Style: Oversized layers welcome; sneakers preferred; bold logos OK.');
    } else if (sty.includes('elegant') || sty.includes('classy') || sty.includes('sophisticated')) {
      rules.push('• Style: Prioritize structured pieces; cohesive tonal palette; refined details.');
    } else if (sty.includes('boho') || sty.includes('bohemian')) {
      rules.push('• Style: Flowy silhouettes; earthy tones; layered textures; relaxed vibe.');
    } else if (sty.includes('preppy') || sty.includes('classic')) {
      rules.push('• Style: Collars, structure, contrast trims; clean lines; polished look.');
    } else if (sty.includes('grunge') || sty.includes('edgy')) {
      rules.push('• Style: Dark palette; distressed elements OK; layered oversized pieces.');
    } else if (sty.includes('athleisure') || sty.includes('sporty')) {
      rules.push('• Style: Mix performance fabrics with casual; sneakers essential; comfort focus.');
    } else if (sty.includes('y2k') || sty.includes('retro')) {
      rules.push('• Style: Bold colors; low-rise bottoms if available; nostalgic elements.');
    } else if (sty.includes('techwear') || sty.includes('tech')) {
      rules.push('• Style: Functional aesthetics; dark neutrals; utility details preferred.');
    } else if (sty.includes('indie') || sty.includes('artsy')) {
      rules.push('• Style: Unique combinations; vintage touches; personality-driven choices.');
    } else if (sty.includes('formal') || sty.includes('professional')) {
      rules.push('• Style: Structured silhouettes; conservative colors; polished finish.');
    } else if (sty.includes('casual')) {
      rules.push('• Style: Relaxed fits; comfort priority; easy-going palette.');
    }
  }

  // ============================================
  // ANCHOR RULES (when anchorItem exists)
  // ============================================
  if (input.anchorItem) {
    const anchor = input.anchorItem;
    const anchorCategory = (anchor.category || '').toLowerCase();
    
    rules.push('• Anchor: ALWAYS include anchor item in every outfit.');
    rules.push('• Anchor: Match anchor formality first, then aesthetic.');
    rules.push('• Anchor: Build silhouette AROUND the anchor piece.');
    
    // Category-specific anchor guidance
    if (anchorCategory.includes('top') || anchorCategory.includes('shirt') || 
        anchorCategory.includes('tee') || anchorCategory.includes('blouse')) {
      rules.push('• Anchor is TOP: Prioritize bottoms + shoes harmony with anchor.');
    } else if (anchorCategory.includes('bottom') || anchorCategory.includes('pant') || 
               anchorCategory.includes('jean') || anchorCategory.includes('skirt') || 
               anchorCategory.includes('short') || anchorCategory.includes('trouser')) {
      rules.push('• Anchor is BOTTOM: Prioritize tops + footwear harmony with anchor.');
    } else if (anchorCategory.includes('shoe') || anchorCategory.includes('sneaker') || 
               anchorCategory.includes('boot') || anchorCategory.includes('heel') || 
               anchorCategory.includes('sandal') || anchorCategory.includes('loafer')) {
      rules.push('• Anchor is FOOTWEAR: Match color + silhouette coherence upward.');
    } else if (anchorCategory.includes('dress') || anchorCategory.includes('jumpsuit')) {
      rules.push('• Anchor is DRESS/JUMPSUIT: Focus on footwear + accessories harmony.');
    } else if (anchorCategory.includes('jacket') || anchorCategory.includes('blazer') || 
               anchorCategory.includes('coat') || anchorCategory.includes('outerwear')) {
      rules.push('• Anchor is OUTERWEAR: Ensure inner layers complement without competing.');
    }
  }

  // ============================================
  // CLIMATE RULES (temperature-based)
  // ============================================
  if (input.temperatureC !== null && input.temperatureC !== undefined) {
    if (input.temperatureC > 27) {
      rules.push('• Climate: Hot weather; avoid heavy outerwear; prefer breathable fabrics.');
    } else if (input.temperatureC < 18 && input.temperatureC >= 10) {
      rules.push('• Climate: Cool weather; encourage light outerwear if available.');
    } else if (input.temperatureC < 10) {
      rules.push('• Climate: Cold weather; prioritize layering + warm outerwear.');
    }
  }

  // ============================================
  // GENERATION TYPE RULES
  // ============================================
  if (input.generationType === 'style') {
    rules.push('• Mode: Style-first generation; aesthetic coherence is top priority.');
  } else if (input.generationType === 'anchor') {
    rules.push('• Mode: Anchor-first generation; anchor item visibility is top priority.');
  } else if (input.generationType === 'occasion') {
    rules.push('• Mode: Occasion-first generation; appropriateness is top priority.');
  }

  return rules.join('\n');
}
