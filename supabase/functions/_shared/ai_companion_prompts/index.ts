// AI Companion Prompt Modules
// These modules are concatenated in order to form the complete system prompt

import { PERSONA_PROMPT } from './01_persona.ts';
import { MODES_PROMPT } from './02_modes.ts';
import { TONE_MIRRORING_PROMPT } from './03_tone_mirroring.ts';
import { FLIRT_LOGIC_PROMPT } from './04_flirt_logic.ts';
import { CHALLENGE_LOGIC_PROMPT } from './05_challenge_logic.ts';
import { MEMORY_ENGINE_PROMPT } from './06_memory_engine.ts';
import { BRAND_RECOMMENDER_PROMPT } from './07_brand_recommender.ts';
import { WARDROBE_UPLOAD_PERSUASION_PROMPT } from './08_wardrobe_upload_persuasion.ts';
import { TOOL_USAGE_RULES_PROMPT } from './09_tool_usage_rules.ts';
import { OUTFIT_ENGINE_PROMPT } from './10_outfit_engine.ts';
import { SHOPPING_ADVISOR_ENGINE_PROMPT } from './11_shopping_advisor_engine.ts';
import { SUGGESTION_PILL_ENGINE_PROMPT } from './12_suggestion_pill_engine.ts';

/**
 * Concatenates all AI Companion prompt modules in order
 * @returns Complete system prompt for AI Companion
 */
export function buildAICompanionPrompt(): string {
  return [
    PERSONA_PROMPT,
    MODES_PROMPT,
    TONE_MIRRORING_PROMPT,
    FLIRT_LOGIC_PROMPT,
    CHALLENGE_LOGIC_PROMPT,
    MEMORY_ENGINE_PROMPT,
    BRAND_RECOMMENDER_PROMPT,
    WARDROBE_UPLOAD_PERSUASION_PROMPT,
    TOOL_USAGE_RULES_PROMPT,
    OUTFIT_ENGINE_PROMPT,
    SHOPPING_ADVISOR_ENGINE_PROMPT,
    SUGGESTION_PILL_ENGINE_PROMPT,
  ].join('\n\n');
}
