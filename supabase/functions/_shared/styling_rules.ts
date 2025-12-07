/**
 * Styling Rules Module - Phase 7
 * 
 * Generates fashion-intelligent hard rules that are injected into the prompt.
 * These rules help Gemini make better styling decisions.
 * 
 * PHASE 7 ENHANCEMENTS:
 * - Expanded occasion rules with specific examples
 * - Silhouette guidance
 * - Color palette recommendations
 * - Indian fusion wear guidelines
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
  // SILHOUETTE RULES (Phase 7)
  // ============================================
  rules.push('• SILHOUETTE: Long tops (kurta, longline) MUST pair with slim/straight bottoms. NEVER with cargo/shorts/joggers.');
  rules.push('• SILHOUETTE: Oversized top + oversized bottom = poor silhouette. Prefer contrast.');
  rules.push('• SILHOUETTE: Cropped tops pair with high-rise bottoms or skirts.');

  // ============================================
  // OCCASION RULES (PHASE 7 - EXPANDED)
  // ============================================
  if (input.occasion) {
    const occ = input.occasion.toLowerCase();
    
    // WEDDING RULES (COMPREHENSIVE)
    if (occ.includes('wedding') || occ.includes('reception') || occ.includes('sangeet') || 
        occ.includes('mehendi') || occ.includes('haldi') || occ.includes('festive') || occ.includes('festival')) {
      rules.push('• WEDDING: Prefer sherwani, kurta_set, bandhgala, lehenga, saree, anarkali for Indian weddings.');
      rules.push('• WEDDING: Avoid cargo pants, joggers, shorts, oversized casuals, flip flops.');
      rules.push('• WEDDING: Preferred footwear: juttis, heels, mojari, formal shoes, embellished flats.');
      rules.push('• WEDDING: Colors: jewel tones (emerald, ruby, sapphire), champagne, gold, maroon, wine, navy.');
      rules.push('• WEDDING: Patterns: brocade, zari, jacquard, embroidered are preferred.');
      rules.push('• WEDDING: Accessories: statement jewelry, clutch/potli, bangles preferred. No backpacks.');
      rules.push('• WEDDING: If only casual bottomwear exists (cargo, joggers), return empty outfits with missingCategories.');
    } 
    // OFFICE RULES (COMPREHENSIVE)
    else if (occ.includes('office') || occ.includes('business') || occ.includes('meeting') || 
             occ.includes('corporate') || occ.includes('professional')) {
      rules.push('• OFFICE: Prefer structured silhouettes: shirts, blouses, chinos, trousers, blazers.');
      rules.push('• OFFICE: Jeans allowed only if dark, clean, and paired with polished top.');
      rules.push('• OFFICE: Avoid graphic tees, sandals, flip flops, shorts, joggers.');
      rules.push('• OFFICE: Colors: beige, navy, white, grey, black, pastels, muted tones.');
      rules.push('• OFFICE: Footwear: loafers, oxfords, pumps, block heels, clean sneakers.');
      rules.push('• OFFICE: Accessories: watch, belt, structured bag, minimal earrings. No chunky jewelry.');
    }
    // INTERVIEW RULES (STRICTEST)
    else if (occ.includes('interview')) {
      rules.push('• INTERVIEW: FORMAL ONLY. Prefer formal shirts, dress pants, blazers.');
      rules.push('• INTERVIEW: Absolutely NO jeans, cargos, shorts, sneakers, canvas shoes.');
      rules.push('• INTERVIEW: Footwear: formal shoes, loafers, pumps, heels only.');
      rules.push('• INTERVIEW: Colors: conservative neutrals (navy, grey, black, white, beige).');
      rules.push('• INTERVIEW: Accessories: watch, belt, minimal jewelry only. No statement pieces.');
      rules.push('• INTERVIEW: If formal bottomwear/footwear missing, return empty with missingCategories.');
    }
    // PARTY RULES
    else if (occ.includes('party') || occ.includes('club') || occ.includes('night out') || 
             occ.includes('nightclub') || occ.includes('rave')) {
      rules.push('• PARTY: Prefer sequins, metallics, leather, deep colors, statement pieces.');
      rules.push('• PARTY: Avoid slippers, casual sports shoes, flip flops.');
      rules.push('• PARTY: Footwear: heels, boots, platforms, chunky sneakers, strappy sandals.');
      rules.push('• PARTY: Accessories: statement earrings, chain bag, clutch, body jewelry.');
      rules.push('• PARTY: Colors: bold (black, metallics, deep jewel tones, neons for clubbing).');
    }
    // DATE NIGHT RULES
    else if (occ.includes('date') || occ.includes('romantic') || occ.includes('anniversary') ||
             occ.includes('dinner')) {
      rules.push('• DATE: Prefer dark jeans, dresses, nice tops, light layers.');
      rules.push('• DATE: Allow cargos for streetwear-style dates only.');
      rules.push('• DATE: Colors: black, burgundy, navy, blush, wine, forest green.');
      rules.push('• DATE: Footwear: heels, boots, loafers, clean sneakers, strappy sandals.');
      rules.push('• DATE: Accessories: delicate jewelry, small clutch/crossbody, watch.');
    }
    // BRUNCH RULES
    else if (occ.includes('brunch') || occ.includes('cafe') || occ.includes('restaurant') ||
             occ.includes('lunch')) {
      rules.push('• BRUNCH: Prefer linen, light fabrics, effortless elegance.');
      rules.push('• BRUNCH: Colors: pastels, earth tones, soft colors, light neutrals.');
      rules.push('• BRUNCH: Footwear: sandals, espadrilles, loafers, flats, clean sneakers.');
      rules.push('• BRUNCH: Accessories: sunglasses, tote bag, straw bag, minimal jewelry.');
    }
    // CASUAL RULES
    else if (occ.includes('casual') || occ.includes('daily') || occ.includes('everyday') ||
             occ.includes('weekend') || occ.includes('shopping')) {
      rules.push('• CASUAL: Prefer t-shirts, jeans, joggers, sneakers. Comfort first.');
      rules.push('• CASUAL: Backpacks allowed, caps OK, any colors acceptable.');
      rules.push('• CASUAL: Colors: any palette works, express personal style.');
    }
    // COLLEGE RULES
    else if (occ.includes('college') || occ.includes('university') || occ.includes('class') ||
             occ.includes('campus') || occ.includes('school')) {
      rules.push('• COLLEGE: Prefer comfortable, expressive styles: jeans, tees, sneakers.');
      rules.push('• COLLEGE: Backpacks preferred for functionality.');
      rules.push('• COLLEGE: Mix casual with trendy: streetwear, preppy, grunge all OK.');
    }
    // GYM/WORKOUT RULES
    else if (occ.includes('gym') || occ.includes('workout') || occ.includes('sport') || 
             occ.includes('athletic') || occ.includes('yoga')) {
      rules.push('• GYM: Performance fabrics only; functional fits; avoid formal pieces entirely.');
      rules.push('• GYM: Sports shoes/trainers required. No heels, loafers, or casual sandals.');
    }
    // TRAVEL RULES
    else if (occ.includes('travel') || occ.includes('vacation') || occ.includes('trip') ||
             occ.includes('airport')) {
      rules.push('• TRAVEL: Versatile pieces; comfort + style balance; easy layering.');
      rules.push('• TRAVEL: Prefer wrinkle-resistant fabrics, slip-on shoes, crossbody bags.');
    }
  }

  // ============================================
  // STYLE RULES (PHASE 7 - EXPANDED)
  // ============================================
  if (input.style) {
    const sty = input.style.toLowerCase();
    
    if (sty.includes('minimal') || sty.includes('minimalist')) {
      rules.push('• MINIMAL: Clean neutrals (black, white, grey, beige); avoid loud graphics.');
      rules.push('• MINIMAL: Emphasize fit + quality over embellishment.');
      rules.push('• MINIMAL: Max 3 colors per outfit. Prefer tonal combinations.');
    } else if (sty.includes('street') || sty.includes('urban')) {
      rules.push('• STREETWEAR: Oversized layers welcome; sneakers preferred; bold logos OK.');
      rules.push('• STREETWEAR: Cargos, joggers, hoodies, graphic tees all appropriate.');
      rules.push('• STREETWEAR: Accessories: chains, caps, chunky jewelry, crossbody bags.');
    } else if (sty.includes('elegant') || sty.includes('classy') || sty.includes('sophisticated')) {
      rules.push('• ELEGANT: Prioritize structured pieces; cohesive tonal palette; refined details.');
      rules.push('• ELEGANT: Prefer heels, loafers, minimal jewelry, clutch bags.');
    } else if (sty.includes('boho') || sty.includes('bohemian')) {
      rules.push('• BOHO: Flowy silhouettes; earthy tones (rust, olive, cream, terracotta).');
      rules.push('• BOHO: Layered textures; sandals, espadrilles; relaxed vibe.');
      rules.push('• BOHO: Accessories: layered necklaces, scarves, crossbody bags.');
    } else if (sty.includes('preppy') || sty.includes('classic')) {
      rules.push('• PREPPY: Collars, structure, contrast trims; clean lines; polished look.');
      rules.push('• PREPPY: Colors: navy, white, red, green. Stripes and checks welcome.');
      rules.push('• PREPPY: Footwear: loafers, boat shoes, oxfords, ballet flats.');
    } else if (sty.includes('grunge') || sty.includes('edgy')) {
      rules.push('• GRUNGE: Dark palette (black, grey, burgundy); distressed elements OK.');
      rules.push('• GRUNGE: Layered oversized pieces; boots preferred; chains and rings.');
    } else if (sty.includes('athleisure') || sty.includes('sporty')) {
      rules.push('• ATHLEISURE: Mix performance fabrics with casual; sneakers essential.');
      rules.push('• ATHLEISURE: Joggers, hoodies, leggings with elevated pieces.');
    } else if (sty.includes('y2k') || sty.includes('retro')) {
      rules.push('• Y2K: Bold colors; low-rise if available; nostalgic elements (butterfly, rhinestones).');
      rules.push('• Y2K: Crop tops, mini skirts, platform shoes, chunky accessories.');
    } else if (sty.includes('techwear') || sty.includes('tech')) {
      rules.push('• TECHWEAR: Functional aesthetics; dark neutrals; utility details.');
      rules.push('• TECHWEAR: Cargo pants OK; technical sneakers; tactical bags.');
    } else if (sty.includes('indie') || sty.includes('artsy')) {
      rules.push('• INDIE: Unique combinations; vintage touches; personality-driven choices.');
      rules.push('• INDIE: Mix patterns carefully; eclectic accessories welcome.');
    } else if (sty.includes('ethnic') || sty.includes('indian') || sty.includes('traditional')) {
      rules.push('• ETHNIC: Prioritize traditional pieces; respect cultural aesthetics.');
      rules.push('• ETHNIC: Ethnic footwear (juttis, mojari, kolhapuri) preferred.');
      rules.push('• ETHNIC: Traditional jewelry and accessories enhance the look.');
    } else if (sty.includes('formal') || sty.includes('professional')) {
      rules.push('• FORMAL: Structured silhouettes; conservative colors; polished finish.');
      rules.push('• FORMAL: No casual pieces; formal footwear required.');
    } else if (sty.includes('casual')) {
      rules.push('• CASUAL: Relaxed fits; comfort priority; easy-going palette.');
    }
  }

  // ============================================
  // ANCHOR RULES (when anchorItem exists)
  // ============================================
  if (input.anchorItem) {
    const anchor = input.anchorItem;
    const anchorCategory = (anchor.category || '').toLowerCase();
    const anchorName = (anchor.name || '').toLowerCase();
    
    rules.push('• ANCHOR: ALWAYS include anchor item in every outfit.');
    rules.push('• ANCHOR: Match anchor formality first, then aesthetic.');
    rules.push('• ANCHOR: Build silhouette AROUND the anchor piece.');
    
    // Category-specific anchor guidance
    if (anchorCategory.includes('top') || anchorCategory.includes('shirt') || 
        anchorCategory.includes('tee') || anchorCategory.includes('blouse')) {
      rules.push('• ANCHOR is TOP: Prioritize bottoms + shoes harmony with anchor.');
      
      // Check if anchor is kurta/ethnic top
      if (anchorName.includes('kurta') || anchorName.includes('ethnic')) {
        rules.push('• ANCHOR is KURTA: Pair ONLY with churidar, straight pants, trousers, palazzo. NEVER cargo/shorts.');
      }
    } else if (anchorCategory.includes('bottom') || anchorCategory.includes('pant') || 
               anchorCategory.includes('jean') || anchorCategory.includes('skirt') || 
               anchorCategory.includes('short') || anchorCategory.includes('trouser')) {
      rules.push('• ANCHOR is BOTTOM: Prioritize tops + footwear harmony with anchor.');
    } else if (anchorCategory.includes('shoe') || anchorCategory.includes('sneaker') || 
               anchorCategory.includes('boot') || anchorCategory.includes('heel') || 
               anchorCategory.includes('sandal') || anchorCategory.includes('loafer')) {
      rules.push('• ANCHOR is FOOTWEAR: Match color + silhouette coherence upward.');
    } else if (anchorCategory.includes('dress') || anchorCategory.includes('jumpsuit')) {
      rules.push('• ANCHOR is DRESS/JUMPSUIT: Focus on footwear + accessories harmony.');
    } else if (anchorCategory.includes('jacket') || anchorCategory.includes('blazer') || 
               anchorCategory.includes('coat') || anchorCategory.includes('outerwear')) {
      rules.push('• ANCHOR is OUTERWEAR: Ensure inner layers complement without competing.');
    } else if (anchorCategory.includes('ethnic') || anchorName.includes('sherwani') || 
               anchorName.includes('bandhgala')) {
      rules.push('• ANCHOR is ETHNIC: Pair with appropriate ethnic/formal bottoms. NEVER jeans/cargo.');
    }
  }

  // ============================================
  // CLIMATE RULES (temperature-based)
  // ============================================
  if (input.temperatureC !== null && input.temperatureC !== undefined) {
    if (input.temperatureC > 30) {
      rules.push('• CLIMATE: Very hot; avoid outerwear entirely; breathable fabrics only; light colors preferred.');
    } else if (input.temperatureC > 27) {
      rules.push('• CLIMATE: Hot weather; avoid heavy outerwear; prefer breathable fabrics; sandals OK.');
    } else if (input.temperatureC < 18 && input.temperatureC >= 10) {
      rules.push('• CLIMATE: Cool weather; encourage light outerwear (cardigan, denim jacket) if available.');
    } else if (input.temperatureC < 10) {
      rules.push('• CLIMATE: Cold weather; prioritize layering + warm outerwear (coat, parka, heavy jacket).');
    }
  }

  // ============================================
  // GENERATION TYPE RULES
  // ============================================
  if (input.generationType === 'style') {
    rules.push('• MODE: Style-first generation; aesthetic coherence is top priority.');
  } else if (input.generationType === 'anchor') {
    rules.push('• MODE: Anchor-first generation; anchor item visibility is top priority.');
  } else if (input.generationType === 'occasion') {
    rules.push('• MODE: Occasion-first generation; appropriateness is top priority.');
  }

  // ============================================
  // FALLBACK INSTRUCTION (Phase 7)
  // ============================================
  rules.push('• FALLBACK: If wardrobe lacks valid bottomwear/footwear for occasion, return 0 outfits. Fill missingCategories instead of forcing mismatched outfits.');

  return rules.join('\n');
}
