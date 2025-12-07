/**
 * Outfit Blueprints Engine - Phase 6.1 + 6.5
 * Canonical outfit structures for occasion x style x gender combinations
 * Built with 45+ years of fashion styling intelligence (Indian + Western)
 * 
 * PHASE 6.5 PERFORMANCE GUARANTEES:
 * - All functions are PURE (no external calls, no network requests)
 * - Blueprint lookup is O(1) hash map access
 * - No Supabase queries, no Gemini calls
 * - Works only on in-memory data
 */

export type OccasionKey =
  | 'wedding_female'
  | 'wedding_male'
  | 'office_female'
  | 'office_male'
  | 'date_night_female'
  | 'date_night_male'
  | 'casual_female'
  | 'casual_male'
  | 'college_female'
  | 'college_male'
  | 'party_female'
  | 'party_male'
  | 'brunch_female'
  | 'brunch_male'
  | 'interview_female'
  | 'interview_male';

export type StyleKey =
  | 'minimal'
  | 'streetwear'
  | 'elegant'
  | 'classic'
  | 'boho'
  | 'sporty'
  | 'ethnic_chic'
  | 'formal_power'
  | 'smart_casual'
  | 'y2k'
  | 'preppy'
  | 'grunge'
  | 'athleisure';

export type CategoryCode = 'top' | 'btm' | 'drs' | 'eth' | 'sho' | 'out' | 'acc';

export interface OutfitBlueprint {
  occasion: string;
  gender: 'male' | 'female' | 'any';
  allowedStyles: StyleKey[];
  requiredCore: CategoryCode[];
  optionalLayers: CategoryCode[];
  optionalAccessories: CategoryCode[];
  allowedProductTypes: {
    tops?: string[];
    bottoms?: string[];
    dresses?: string[];
    ethnic?: string[];
    outerwear?: string[];
  };
  preferredFootwearTags: string[];
  preferredAccessories: string[];
  allowJeans?: boolean;
  allowJeansFusion?: boolean; // Very low priority jeans for formal occasions
  allowCargos?: boolean;
  allowGymShoes?: boolean;
  allowBackpacks?: boolean;
  formalityLevel: 'casual' | 'smart_casual' | 'semi_formal' | 'formal' | 'black_tie';
  colorPalette?: 'neutral' | 'bold' | 'pastel' | 'jewel_tones' | 'earth_tones' | 'any';
}

// ============================================================
// WEDDING BLUEPRINTS (Indian Context Priority)
// ============================================================

const WEDDING_FEMALE: OutfitBlueprint = {
  occasion: 'wedding',
  gender: 'female',
  allowedStyles: ['elegant', 'ethnic_chic', 'classic', 'formal_power'],
  requiredCore: ['eth', 'sho'], // Ethnic + Shoes as core
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    ethnic: ['saree', 'lehenga', 'lehenga_set', 'anarkali', 'kurta_set', 'sharara_set', 'gharara_set', 'salwar_suit'],
    dresses: ['gown', 'occasion_dress', 'cocktail_dress', 'maxi_dress'],
    bottoms: ['lehenga_skirt', 'palazzo', 'sharara', 'gharara', 'churidar'],
    tops: ['blouse', 'choli', 'crop_top'],
    outerwear: ['dupatta', 'shawl', 'stole', 'cape', 'shrug']
  },
  preferredFootwearTags: ['heels', 'block_heels', 'wedges', 'juttis', 'mojari', 'embellished_flats', 'kolhapuri'],
  preferredAccessories: ['statement_earrings', 'necklace', 'bangles', 'maang_tikka', 'clutch', 'potli', 'ring'],
  allowJeans: false,
  allowJeansFusion: true, // Only if no ethnic/formal options exist
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'formal',
  colorPalette: 'jewel_tones'
};

const WEDDING_MALE: OutfitBlueprint = {
  occasion: 'wedding',
  gender: 'male',
  allowedStyles: ['elegant', 'ethnic_chic', 'classic', 'formal_power'],
  requiredCore: ['eth', 'sho'], // Ethnic + Shoes, or top+btm+out
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    ethnic: ['sherwani', 'kurta_set', 'kurta_pajama', 'bandhgala', 'achkan', 'pathani_suit', 'nehru_jacket_set'],
    tops: ['formal_shirt', 'dress_shirt', 'kurta'],
    bottoms: ['formal_trouser', 'dress_pants', 'churidar', 'dhoti_pants', 'aligarh_pajama'],
    outerwear: ['nehru_jacket', 'blazer', 'bandhgala_jacket', 'waistcoat', 'bundi']
  },
  preferredFootwearTags: ['formal_shoes', 'oxford', 'derby', 'loafers', 'mojari', 'juttis', 'kolhapuri', 'patent_leather'],
  preferredAccessories: ['watch', 'pocket_square', 'cufflinks', 'brooch', 'safa', 'turban', 'stole'],
  allowJeans: false,
  allowJeansFusion: true, // Jeans + blazer + shirt as last resort
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'formal',
  colorPalette: 'jewel_tones'
};

// ============================================================
// OFFICE BLUEPRINTS (Western + Indian Formals)
// ============================================================

const OFFICE_FEMALE: OutfitBlueprint = {
  occasion: 'office',
  gender: 'female',
  allowedStyles: ['minimal', 'classic', 'smart_casual', 'formal_power', 'preppy'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['blouse', 'shirt', 'formal_top', 'button_down', 'silk_blouse', 'turtleneck', 'knit_top'],
    bottoms: ['formal_trouser', 'dress_pants', 'pencil_skirt', 'midi_skirt', 'culottes', 'tailored_pants'],
    dresses: ['sheath_dress', 'shift_dress', 'midi_dress', 'wrap_dress', 'blazer_dress'],
    ethnic: ['kurta_set', 'cotton_kurta', 'office_kurta', 'straight_kurta'],
    outerwear: ['blazer', 'cardigan', 'structured_jacket', 'trench_coat', 'formal_jacket']
  },
  preferredFootwearTags: ['pumps', 'block_heels', 'loafers', 'oxford', 'ballet_flats', 'mules', 'kitten_heels', 'clean_sneakers'],
  preferredAccessories: ['watch', 'minimal_earrings', 'thin_chain', 'tote_bag', 'structured_bag', 'belt'],
  allowJeans: true, // Dark, clean jeans with smart top
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'neutral'
};

const OFFICE_MALE: OutfitBlueprint = {
  occasion: 'office',
  gender: 'male',
  allowedStyles: ['minimal', 'classic', 'smart_casual', 'formal_power', 'preppy'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['formal_shirt', 'dress_shirt', 'button_down', 'polo', 'oxford_shirt', 'linen_shirt'],
    bottoms: ['formal_trouser', 'chinos', 'dress_pants', 'tailored_pants'],
    ethnic: ['office_kurta', 'kurta_set', 'cotton_kurta'],
    outerwear: ['blazer', 'nehru_jacket', 'cardigan', 'waistcoat', 'v_neck_sweater']
  },
  preferredFootwearTags: ['oxford', 'derby', 'loafers', 'monk_strap', 'brogue', 'clean_sneakers', 'formal_shoes'],
  preferredAccessories: ['watch', 'belt', 'tie', 'pocket_square', 'laptop_bag', 'messenger_bag'],
  allowJeans: true, // Dark, slim, non-ripped with structured top
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'neutral'
};

// ============================================================
// DATE NIGHT BLUEPRINTS (Vibe-Driven)
// ============================================================

const DATE_NIGHT_FEMALE: OutfitBlueprint = {
  occasion: 'date_night',
  gender: 'female',
  allowedStyles: ['elegant', 'minimal', 'streetwear', 'y2k', 'boho', 'smart_casual'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['nice_top', 'crop_top', 'corset', 'blouse', 'cami', 'bodysuit', 'halter_top', 'off_shoulder'],
    bottoms: ['jeans', 'mini_skirt', 'midi_skirt', 'wide_leg_pants', 'leather_pants', 'cargo', 'slit_skirt'],
    dresses: ['mini_dress', 'midi_dress', 'bodycon', 'slip_dress', 'wrap_dress', 'cocktail_dress'],
    outerwear: ['leather_jacket', 'denim_jacket', 'blazer', 'bomber', 'cropped_jacket', 'shrug']
  },
  preferredFootwearTags: ['heels', 'stilettos', 'block_heels', 'boots', 'ankle_boots', 'strappy_heels', 'sneakers', 'mules'],
  preferredAccessories: ['statement_earrings', 'delicate_necklace', 'clutch', 'crossbody', 'ring', 'bracelet'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true, // For streetwear vibe
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'any'
};

const DATE_NIGHT_MALE: OutfitBlueprint = {
  occasion: 'date_night',
  gender: 'male',
  allowedStyles: ['minimal', 'streetwear', 'smart_casual', 'classic', 'elegant'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['shirt', 'nice_tshirt', 'polo', 'henley', 'knit_shirt', 'linen_shirt', 'printed_shirt'],
    bottoms: ['jeans', 'chinos', 'tailored_pants', 'cargo', 'slim_pants'],
    outerwear: ['leather_jacket', 'denim_jacket', 'bomber', 'overshirt', 'light_jacket', 'blazer']
  },
  preferredFootwearTags: ['clean_sneakers', 'loafers', 'boots', 'chelsea_boots', 'derby', 'white_sneakers'],
  preferredAccessories: ['watch', 'chain', 'bracelet', 'sunglasses', 'messenger_bag'],
  allowJeans: true, // High priority for dark/slim
  allowJeansFusion: false,
  allowCargos: true, // For streetwear/sporty vibe
  allowGymShoes: true, // Clean sneakers, not running shoes
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'any'
};

// ============================================================
// CASUAL BLUEPRINTS
// ============================================================

const CASUAL_FEMALE: OutfitBlueprint = {
  occasion: 'casual',
  gender: 'female',
  allowedStyles: ['minimal', 'streetwear', 'boho', 'athleisure', 'y2k', 'grunge', 'smart_casual'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['tshirt', 'crop_top', 'tank_top', 'sweatshirt', 'hoodie', 'casual_top', 'blouse', 'cami'],
    bottoms: ['jeans', 'shorts', 'cargo', 'joggers', 'leggings', 'skirt', 'culottes', 'linen_pants'],
    dresses: ['casual_dress', 'sundress', 'tshirt_dress', 'maxi_dress', 'shift_dress'],
    outerwear: ['cardigan', 'denim_jacket', 'hoodie', 'bomber', 'flannel', 'windbreaker']
  },
  preferredFootwearTags: ['sneakers', 'sandals', 'flats', 'slides', 'canvas_shoes', 'loafers', 'espadrilles'],
  preferredAccessories: ['tote_bag', 'crossbody', 'cap', 'sunglasses', 'minimal_jewelry', 'scrunchie'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: true,
  allowBackpacks: true,
  formalityLevel: 'casual',
  colorPalette: 'any'
};

const CASUAL_MALE: OutfitBlueprint = {
  occasion: 'casual',
  gender: 'male',
  allowedStyles: ['minimal', 'streetwear', 'athleisure', 'sporty', 'smart_casual', 'grunge'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['tshirt', 'polo', 'henley', 'sweatshirt', 'hoodie', 'casual_shirt', 'tank_top'],
    bottoms: ['jeans', 'shorts', 'cargo', 'joggers', 'chinos', 'linen_pants', 'track_pants'],
    outerwear: ['hoodie', 'denim_jacket', 'bomber', 'windbreaker', 'flannel', 'overshirt']
  },
  preferredFootwearTags: ['sneakers', 'slides', 'sandals', 'canvas_shoes', 'loafers', 'running_shoes'],
  preferredAccessories: ['watch', 'cap', 'sunglasses', 'backpack', 'chain', 'bracelet'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: true,
  allowBackpacks: true,
  formalityLevel: 'casual',
  colorPalette: 'any'
};

// ============================================================
// COLLEGE BLUEPRINTS
// ============================================================

const COLLEGE_FEMALE: OutfitBlueprint = {
  occasion: 'college',
  gender: 'female',
  allowedStyles: ['minimal', 'streetwear', 'preppy', 'y2k', 'athleisure', 'boho', 'grunge'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['tshirt', 'crop_top', 'sweatshirt', 'hoodie', 'casual_top', 'tank_top', 'kurta'],
    bottoms: ['jeans', 'shorts', 'cargo', 'joggers', 'skirt', 'culottes', 'leggings'],
    dresses: ['casual_dress', 'tshirt_dress', 'dungaree_dress'],
    outerwear: ['denim_jacket', 'hoodie', 'cardigan', 'bomber', 'flannel']
  },
  preferredFootwearTags: ['sneakers', 'canvas_shoes', 'sandals', 'slides', 'flats', 'running_shoes'],
  preferredAccessories: ['backpack', 'tote_bag', 'cap', 'scrunchie', 'minimal_jewelry', 'sunglasses'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: true,
  allowBackpacks: true,
  formalityLevel: 'casual',
  colorPalette: 'any'
};

const COLLEGE_MALE: OutfitBlueprint = {
  occasion: 'college',
  gender: 'male',
  allowedStyles: ['minimal', 'streetwear', 'preppy', 'athleisure', 'sporty', 'grunge'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['tshirt', 'polo', 'sweatshirt', 'hoodie', 'casual_shirt', 'henley'],
    bottoms: ['jeans', 'shorts', 'cargo', 'joggers', 'chinos', 'track_pants'],
    outerwear: ['hoodie', 'denim_jacket', 'bomber', 'windbreaker', 'varsity_jacket']
  },
  preferredFootwearTags: ['sneakers', 'canvas_shoes', 'slides', 'running_shoes', 'high_tops'],
  preferredAccessories: ['backpack', 'cap', 'watch', 'sunglasses', 'chain'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: true,
  allowBackpacks: true,
  formalityLevel: 'casual',
  colorPalette: 'any'
};

// ============================================================
// PARTY BLUEPRINTS
// ============================================================

const PARTY_FEMALE: OutfitBlueprint = {
  occasion: 'party',
  gender: 'female',
  allowedStyles: ['elegant', 'y2k', 'streetwear', 'boho', 'minimal', 'grunge'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['crop_top', 'corset', 'bodysuit', 'sequin_top', 'halter', 'off_shoulder', 'mesh_top'],
    bottoms: ['mini_skirt', 'leather_pants', 'slit_skirt', 'metallic_pants', 'hot_shorts', 'cargo'],
    dresses: ['mini_dress', 'bodycon', 'sequin_dress', 'slip_dress', 'cutout_dress', 'party_dress'],
    outerwear: ['leather_jacket', 'blazer', 'fur_jacket', 'shrug', 'cropped_jacket']
  },
  preferredFootwearTags: ['heels', 'stilettos', 'platform_heels', 'boots', 'strappy_heels', 'block_heels'],
  preferredAccessories: ['statement_earrings', 'clutch', 'chain_bag', 'rings', 'body_chain', 'choker'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'bold'
};

const PARTY_MALE: OutfitBlueprint = {
  occasion: 'party',
  gender: 'male',
  allowedStyles: ['streetwear', 'minimal', 'elegant', 'smart_casual', 'y2k'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['nice_tshirt', 'printed_shirt', 'silk_shirt', 'party_shirt', 'polo', 'henley'],
    bottoms: ['jeans', 'slim_pants', 'cargo', 'tailored_pants', 'leather_pants'],
    outerwear: ['leather_jacket', 'bomber', 'blazer', 'denim_jacket', 'overshirt']
  },
  preferredFootwearTags: ['clean_sneakers', 'boots', 'chelsea_boots', 'loafers', 'high_tops'],
  preferredAccessories: ['watch', 'chain', 'rings', 'bracelet', 'sunglasses'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: true,
  allowGymShoes: true, // Clean sneakers only
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'bold'
};

// ============================================================
// BRUNCH BLUEPRINTS
// ============================================================

const BRUNCH_FEMALE: OutfitBlueprint = {
  occasion: 'brunch',
  gender: 'female',
  allowedStyles: ['minimal', 'boho', 'smart_casual', 'preppy', 'elegant'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['blouse', 'nice_top', 'linen_top', 'crop_top', 'button_down', 'cami'],
    bottoms: ['jeans', 'midi_skirt', 'linen_pants', 'wide_leg_pants', 'culottes', 'shorts'],
    dresses: ['sundress', 'midi_dress', 'wrap_dress', 'maxi_dress', 'linen_dress'],
    outerwear: ['cardigan', 'light_blazer', 'denim_jacket', 'shrug']
  },
  preferredFootwearTags: ['sandals', 'espadrilles', 'flats', 'mules', 'block_heels', 'loafers', 'clean_sneakers'],
  preferredAccessories: ['sunglasses', 'tote_bag', 'straw_bag', 'minimal_jewelry', 'scarf', 'hat'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'pastel'
};

const BRUNCH_MALE: OutfitBlueprint = {
  occasion: 'brunch',
  gender: 'male',
  allowedStyles: ['minimal', 'smart_casual', 'preppy', 'classic'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['linen_shirt', 'polo', 'casual_shirt', 'button_down', 'henley', 'nice_tshirt'],
    bottoms: ['chinos', 'linen_pants', 'jeans', 'tailored_shorts', 'slim_pants'],
    outerwear: ['light_blazer', 'cardigan', 'linen_jacket', 'overshirt']
  },
  preferredFootwearTags: ['loafers', 'espadrilles', 'clean_sneakers', 'boat_shoes', 'sandals', 'derby'],
  preferredAccessories: ['watch', 'sunglasses', 'minimal_bracelet', 'messenger_bag'],
  allowJeans: true,
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'smart_casual',
  colorPalette: 'pastel'
};

// ============================================================
// INTERVIEW BLUEPRINTS (Formal Focus)
// ============================================================

const INTERVIEW_FEMALE: OutfitBlueprint = {
  occasion: 'interview',
  gender: 'female',
  allowedStyles: ['formal_power', 'classic', 'minimal', 'smart_casual'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['blouse', 'formal_top', 'button_down', 'silk_blouse', 'turtleneck'],
    bottoms: ['formal_trouser', 'dress_pants', 'pencil_skirt', 'tailored_pants'],
    dresses: ['sheath_dress', 'blazer_dress', 'shift_dress', 'midi_dress'],
    outerwear: ['blazer', 'structured_jacket', 'formal_cardigan']
  },
  preferredFootwearTags: ['pumps', 'block_heels', 'loafers', 'oxford', 'kitten_heels', 'mules'],
  preferredAccessories: ['watch', 'minimal_earrings', 'structured_bag', 'thin_chain', 'belt'],
  allowJeans: false,
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'semi_formal',
  colorPalette: 'neutral'
};

const INTERVIEW_MALE: OutfitBlueprint = {
  occasion: 'interview',
  gender: 'male',
  allowedStyles: ['formal_power', 'classic', 'minimal', 'smart_casual'],
  requiredCore: ['top', 'btm', 'sho'],
  optionalLayers: ['out'],
  optionalAccessories: ['acc'],
  allowedProductTypes: {
    tops: ['formal_shirt', 'dress_shirt', 'button_down', 'oxford_shirt'],
    bottoms: ['formal_trouser', 'dress_pants', 'tailored_pants'],
    outerwear: ['blazer', 'suit_jacket', 'waistcoat']
  },
  preferredFootwearTags: ['oxford', 'derby', 'monk_strap', 'loafers', 'formal_shoes', 'brogue'],
  preferredAccessories: ['watch', 'belt', 'tie', 'portfolio', 'laptop_bag'],
  allowJeans: false,
  allowJeansFusion: false,
  allowCargos: false,
  allowGymShoes: false,
  allowBackpacks: false,
  formalityLevel: 'semi_formal',
  colorPalette: 'neutral'
};

// ============================================================
// BLUEPRINT REGISTRY
// ============================================================

const BLUEPRINTS: Record<OccasionKey, OutfitBlueprint> = {
  wedding_female: WEDDING_FEMALE,
  wedding_male: WEDDING_MALE,
  office_female: OFFICE_FEMALE,
  office_male: OFFICE_MALE,
  date_night_female: DATE_NIGHT_FEMALE,
  date_night_male: DATE_NIGHT_MALE,
  casual_female: CASUAL_FEMALE,
  casual_male: CASUAL_MALE,
  college_female: COLLEGE_FEMALE,
  college_male: COLLEGE_MALE,
  party_female: PARTY_FEMALE,
  party_male: PARTY_MALE,
  brunch_female: BRUNCH_FEMALE,
  brunch_male: BRUNCH_MALE,
  interview_female: INTERVIEW_FEMALE,
  interview_male: INTERVIEW_MALE
};

// ============================================================
// OCCASION ALIASES (Free-text to OccasionKey mapping)
// ============================================================

const OCCASION_ALIASES: Record<string, string> = {
  // Wedding variants
  'wedding': 'wedding',
  'sangeet': 'wedding',
  'mehndi': 'wedding',
  'haldi': 'wedding',
  'reception': 'wedding',
  'engagement': 'wedding',
  'shaadi': 'wedding',
  'baraat': 'wedding',
  'cocktail': 'wedding',
  'festive': 'wedding',
  'festival': 'wedding',
  'diwali': 'wedding',
  'eid': 'wedding',
  'puja': 'wedding',
  
  // Office variants
  'office': 'office',
  'work': 'office',
  'business': 'office',
  'corporate': 'office',
  'meeting': 'office',
  'conference': 'office',
  'presentation': 'office',
  'professional': 'office',
  
  // Interview variants
  'interview': 'interview',
  'job interview': 'interview',
  
  // Date night variants
  'date': 'date_night',
  'date night': 'date_night',
  'dinner': 'date_night',
  'romantic': 'date_night',
  'anniversary': 'date_night',
  'evening out': 'date_night',
  
  // Casual variants
  'casual': 'casual',
  'daily': 'casual',
  'everyday': 'casual',
  'weekend': 'casual',
  'home': 'casual',
  'errand': 'casual',
  'shopping': 'casual',
  'mall': 'casual',
  
  // College variants
  'college': 'college',
  'university': 'college',
  'school': 'college',
  'class': 'college',
  'campus': 'college',
  'study': 'college',
  
  // Party variants
  'party': 'party',
  'club': 'party',
  'nightclub': 'party',
  'night out': 'party',
  'clubbing': 'party',
  'rave': 'party',
  'disco': 'party',
  'house party': 'party',
  'birthday': 'party',
  
  // Brunch variants
  'brunch': 'brunch',
  'breakfast': 'brunch',
  'lunch': 'brunch',
  'cafe': 'brunch',
  'coffee': 'brunch',
  'restaurant': 'brunch',
  'outing': 'brunch'
};

// ============================================================
// RESOLVER FUNCTIONS
// ============================================================

/**
 * Maps free-text occasion to OccasionKey with gender
 */
export function resolveOccasionKey(
  occasion: string | null | undefined, 
  gender: 'male' | 'female' | null | undefined
): OccasionKey | null {
  if (!occasion) return null;
  
  const normalizedOccasion = occasion.toLowerCase().trim();
  
  // Find the base occasion from aliases
  let baseOccasion: string | null = null;
  
  // Direct match first
  if (OCCASION_ALIASES[normalizedOccasion]) {
    baseOccasion = OCCASION_ALIASES[normalizedOccasion];
  } else {
    // Partial match - find if any alias is contained in the input
    for (const [alias, mapped] of Object.entries(OCCASION_ALIASES)) {
      if (normalizedOccasion.includes(alias) || alias.includes(normalizedOccasion)) {
        baseOccasion = mapped;
        break;
      }
    }
  }
  
  if (!baseOccasion) {
    // Default to casual if we can't determine occasion
    baseOccasion = 'casual';
  }
  
  // Determine gender - default to female if not specified
  const resolvedGender = gender || 'female';
  
  // Build the key
  const key = `${baseOccasion}_${resolvedGender}` as OccasionKey;
  
  // Check if key exists in blueprints
  if (BLUEPRINTS[key]) {
    return key;
  }
  
  return null;
}

/**
 * Gets the blueprint for a given occasion and gender
 */
export function getBlueprintFor(
  occasion: string | null | undefined, 
  gender: 'male' | 'female' | null | undefined
): OutfitBlueprint | null {
  const key = resolveOccasionKey(occasion, gender);
  if (!key) return null;
  return BLUEPRINTS[key] || null;
}

/**
 * Gets all blueprints matching a style
 */
export function getBlueprintsByStyle(style: StyleKey): OutfitBlueprint[] {
  return Object.values(BLUEPRINTS).filter(bp => bp.allowedStyles.includes(style));
}

/**
 * Checks if an item category is valid for a blueprint
 */
export function isCategoryValidForBlueprint(
  blueprint: OutfitBlueprint,
  category: string,
  itemType?: string
): boolean {
  const normalizedCategory = category.toLowerCase();
  const normalizedItemType = itemType?.toLowerCase();
  
  // Check allowed product types
  const productTypes = blueprint.allowedProductTypes;
  
  // Map category to product type group
  if (normalizedCategory.includes('top') || normalizedCategory === 'tops') {
    return !productTypes.tops || productTypes.tops.length === 0 || 
           (normalizedItemType ? productTypes.tops.some(t => normalizedItemType.includes(t) || t.includes(normalizedItemType)) : true);
  }
  
  if (normalizedCategory.includes('bottom') || normalizedCategory === 'bottoms') {
    return !productTypes.bottoms || productTypes.bottoms.length === 0 ||
           (normalizedItemType ? productTypes.bottoms.some(t => normalizedItemType.includes(t) || t.includes(normalizedItemType)) : true);
  }
  
  if (normalizedCategory.includes('dress') || normalizedCategory === 'dresses') {
    return !productTypes.dresses || productTypes.dresses.length === 0 ||
           (normalizedItemType ? productTypes.dresses.some(t => normalizedItemType.includes(t) || t.includes(normalizedItemType)) : true);
  }
  
  if (normalizedCategory.includes('ethnic') || normalizedCategory.includes('traditional')) {
    return !productTypes.ethnic || productTypes.ethnic.length === 0 ||
           (normalizedItemType ? productTypes.ethnic.some(t => normalizedItemType.includes(t) || t.includes(normalizedItemType)) : true);
  }
  
  if (normalizedCategory.includes('outer') || normalizedCategory === 'outerwear') {
    return !productTypes.outerwear || productTypes.outerwear.length === 0 ||
           (normalizedItemType ? productTypes.outerwear.some(t => normalizedItemType.includes(t) || t.includes(normalizedItemType)) : true);
  }
  
  // Shoes and accessories are generally allowed
  if (normalizedCategory.includes('shoe') || normalizedCategory.includes('footwear')) {
    return true;
  }
  
  if (normalizedCategory.includes('accessor')) {
    return true;
  }
  
  return true; // Default allow
}

/**
 * Gets formality score for comparison (0-4)
 */
export function getFormalityScore(level: OutfitBlueprint['formalityLevel']): number {
  const scores: Record<OutfitBlueprint['formalityLevel'], number> = {
    'casual': 0,
    'smart_casual': 1,
    'semi_formal': 2,
    'formal': 3,
    'black_tie': 4
  };
  return scores[level] || 1;
}

/**
 * Generates blueprint rules as a compact string for prompt injection
 */
export function blueprintToPromptRules(blueprint: OutfitBlueprint): string {
  const rules: string[] = [];
  
  rules.push(`Occasion: ${blueprint.occasion} (${blueprint.gender})`);
  rules.push(`Formality: ${blueprint.formalityLevel}`);
  rules.push(`Styles: ${blueprint.allowedStyles.slice(0, 3).join(', ')}`);
  
  if (!blueprint.allowJeans) {
    rules.push('• Avoid jeans unless no better option exists');
  }
  if (!blueprint.allowCargos) {
    rules.push('• Cargos not appropriate for this occasion');
  }
  if (!blueprint.allowGymShoes) {
    rules.push('• Gym/running shoes not appropriate');
  }
  if (!blueprint.allowBackpacks) {
    rules.push('• Backpacks not appropriate');
  }
  
  if (blueprint.preferredFootwearTags.length > 0) {
    rules.push(`• Preferred footwear: ${blueprint.preferredFootwearTags.slice(0, 4).join(', ')}`);
  }
  
  if (blueprint.colorPalette && blueprint.colorPalette !== 'any') {
    rules.push(`• Color palette: ${blueprint.colorPalette}`);
  }
  
  return rules.join('\n');
}
