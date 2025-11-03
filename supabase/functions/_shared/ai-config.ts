/**
 * Centralized AI API Configuration
 * 
 * TO SWITCH PROVIDERS:
 * 1. Update AI_API_ENDPOINT below
 * 2. Update AI_API_KEY_ENV_VAR below
 * 3. Add the new API key as a Supabase secret
 */

// ===== CONFIGURATION - EDIT THESE TWO LINES =====

export const AI_API_ENDPOINT = 'https://ai.gateway.lovable.dev/v1/chat/completions';
export const AI_API_KEY_ENV_VAR = 'LOVABLE_API_KEY';

// ===== HELPER FUNCTION - DON'T EDIT BELOW =====

/**
 * Get the configured AI API key from environment
 * @throws {Error} If API key is not configured
 */
export function getAIApiKey(): string {
  const apiKey = Deno.env.get(AI_API_KEY_ENV_VAR);
  
  if (!apiKey) {
    throw new Error(`${AI_API_KEY_ENV_VAR} not configured`);
  }
  
  return apiKey;
}
