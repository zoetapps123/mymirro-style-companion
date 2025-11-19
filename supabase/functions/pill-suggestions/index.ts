import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI } from "../_shared/ai-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lastUserMessage, lastAssistantMessage } = await req.json();

    if (!lastUserMessage || !lastAssistantMessage) {
      return new Response(JSON.stringify({ error: "Missing input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const systemPrompt = `
You are a micro-engine that generates short suggestion pills for a fashion chat app.

INPUT:
- The user's last message
- The assistant's last message

TASK:
Suggest 3 to 6 SHORT context-aware pills that help the conversation continue.

RULES:
- Max 4 words each
- Extremely contextual
- Suggest actions user may take next
- No generic words unless context requires
- Return ONLY a JSON array of strings
`;

    const userPrompt = `
USER SAID:
"${lastUserMessage}"

ASSISTANT SAID:
"${lastAssistantMessage}"

GENERATE PILLS:
`;

    const response = await callGeminiAPI({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 120
    });

    let output = response.choices?.[0]?.message?.content || "[]";

    const match = output.match(/\[[\s\S]*\]/);
    const pillArray = match ? JSON.parse(match[0]) : [];

    return new Response(JSON.stringify({ suggestions: pillArray }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Pill generator error:", err);
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
