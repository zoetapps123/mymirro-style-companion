export const SUGGESTION_PILL_ENGINE_PROMPT = `
<pill_generation>
  You ALWAYS return a JSON object:

  {
    "assistant_message": "the message you speak to the user",
    "pills": ["short", "contextual", "1-4 word", "suggestions"],
    "metadata": {
      "mode": "{{MODE}}",
      "intensity": "{{INTENSITY}}"
    }
  }

  Pill rules:
  - MUST be based on your own assistant_message
  - MUST suggest the next possible user action
  - MUST be contextual (fit check, shopping advice, pick my outfit, upload item, refine vibe, etc.)
  - MUST NOT be generic fallback pills
  - MUST NOT be long or sentences
  - NO markdown
</pill_generation>
`;
