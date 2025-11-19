import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPIStreaming, callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';
import { buildAICompanionPrompt } from '../_shared/ai_companion_prompts/index.ts';
import { retryWithBackoff } from '../_shared/retry-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Chat: request received', { method: req.method, url: new URL(req.url).pathname });
    
    // Extract and verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's token to respect RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const { messages, userProfile, wardrobeItems, recentBattles, recentStyleChecks } = await req.json();

    // Fetch user profile
    let bodyShape: string | null = null;
    let skinTone: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('body_shape, skin_tone')
        .eq('id', userId)
        .single();
      
      bodyShape = profile?.body_shape || undefined;
      skinTone = profile?.skin_tone || undefined;
    } catch (e) {
      console.error('Failed to fetch user context:', e);
    }

    // Build the base persona prompt (ONLY the 13 modules)
    const basePrompt = buildAICompanionPrompt();

    // --- NEW: Small system prompt only ---
    const systemPrompt = basePrompt;
    
    console.log("SYSTEM PROMPT SIZE:", systemPrompt.length);

    // --- NEW: Split user context into separate messages ---
    const userContextMessage = {
      role: "user",
      content: `
<USER_CONTEXT>
  <NAME>${userProfile?.name || ''}</NAME>
  <GENDER>${userProfile?.gender || ''}</GENDER>
  <LOCATION>${userProfile?.location || 'India'}</LOCATION>
  <BODY_SHAPE>${bodyShape || ''}</BODY_SHAPE>
  <SKIN_TONE>${skinTone || ''}</SKIN_TONE>
</USER_CONTEXT>
`
    };

    // Wardrobe moved out of system prompt
    const wardrobeContextMessage = {
      role: "user",
      content: `
<WARDROBE_DATA>
${JSON.stringify(wardrobeItems || [], null, 2)}
</WARDROBE_DATA>
`
    };

    // Style check history separated
    const styleCheckContextMessage = {
      role: "user",
      content: `
<RECENT_STYLE_CHECKS>
${JSON.stringify(recentStyleChecks || [], null, 2)}
</RECENT_STYLE_CHECKS>
`
    };

    // battle history separated
    const battleContextMessage = {
      role: "user",
      content: `
<RECENT_BATTLES>
${JSON.stringify(recentBattles || [], null, 2)}
</RECENT_BATTLES>
`
    };

    // Process messages to handle images
    const processedMessages = messages.map((msg: any) => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map((img: string) => ({
              type: 'image_url',
              image_url: { url: img }
            }))
          ]
        };
      }
      return msg;
    });

    console.log('Chat: processed messages', { count: processedMessages.length });

    // Define AI tools
    const tools = [
      {
        type: "function",
        function: {
          name: "fetch_wardrobe_items",
          description: "Retrieve items from the user's wardrobe. Use when user asks about their wardrobe or you need to see what they own.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional: filter by category (tops, bottoms, shoes, dresses, outerwear, accessories, etc.)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_outfits",
          description: `Generate complete outfit suggestions from user's wardrobe. 

WHEN TO USE - TWO SCENARIOS:

A) USER SPECIFIES OCCASION → Call immediately:
   - "what should I wear for [occasion]"
   - "outfit for [occasion]" 
   - "[occasion] outfit"
   - "what can I wear to [event]"
   Examples:
   - "date night" → Call instantly
   - "what should I wear casually" → Call instantly
   - "outfit for work" → Call instantly

B) USER DOESN'T SPECIFY OCCASION → DO NOT CALL, ask for occasion first:
   - "what outfits can I create"
   - "what can I wear"
   - "suggest outfits"
   - "show me outfit ideas"
   Examples:
   - "what outfits can I create with what I have?" → Ask: "What occasion are you dressing for?"
   - "suggest some outfits" → Ask: "Sure! What's the occasion?"
   
After they specify occasion, THEN call this tool immediately.`,
          parameters: {
            type: "object",
            properties: {
              occasion: {
                type: "string",
                description: "The occasion or context (casual, formal, date, wedding, party, business, interview, workout, beach, brunch, date night, etc.)"
              },
              style: {
                type: "string",
                description: "Desired style (smart casual, streetwear, elegant, sporty, comfortable, etc.)"
              },
              count: {
                type: "number",
                description: "Number of outfits to generate (1-5, default 3)"
              }
            },
            required: ["occasion"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_shopping_needs",
          description: "Analyze the user's wardrobe and provide shopping recommendations. Use when user asks about shopping, what to buy, or wardrobe gaps.",
          parameters: {
            type: "object",
            properties: {
              focus: {
                type: "string",
                description: "What to focus on: gaps, versatility, specific_occasion, or general"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_wardrobe_items",
          description: "Display specific wardrobe items visually to the user",
          parameters: {
            type: "object",
            properties: {
              item_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of wardrobe item IDs to display"
              },
              context: {
                type: "string",
                description: "Brief explanation of why these items are being shown"
              }
            },
            required: ["item_ids", "context"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_outfit_suggestion",
          description: "Create and display visual outfit suggestions to the user",
          parameters: {
            type: "object",
            properties: {
              outfits: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    outfit_name: { type: "string" },
                    item_ids: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" }
                  },
                  required: ["outfit_name", "item_ids", "reasoning"]
                }
              }
            },
            required: ["outfits"]
          }
        }
      }
    ];

    console.log('Chat: calling Gemini API', {
      model: 'google/gemini-2.5-flash',
      messageCount: processedMessages.length,
      toolsCount: tools.length
    });

    // JSON enforcement prompt
    const jsonEnforcePrompt = `
You MUST respond ONLY in this JSON format:

{
  "assistant_message": "<string>",
  "pills": ["<string>", "<string>", "..."],
  "metadata": {
    "mode": "<chat|stylist|shopping|roast>",
    "intent": "<summary>"
  }
}

Rules:
- NO markdown
- NO natural text outside JSON
- NO explanations
- NO backticks
- The "assistant_message" contains your full natural-language reply to the user
- "pills" = 3–8 short next-step suggestions based on your message
- "metadata" describes how you interpreted intent
- BREAKING THIS FORMAT WILL CRASH THE SYSTEM
`;

    // PASS 1: Get assistant message only
    const initialResponse = await retryWithBackoff(() => callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: jsonEnforcePrompt },
        userContextMessage,
        wardrobeContextMessage,
        styleCheckContextMessage,
        battleContextMessage,
        ...processedMessages
      ]
    }));

    console.log('Chat: JSON response received');

    // Extract and parse JSON with fault tolerance
    const raw = initialResponse.choices?.[0]?.message?.content?.trim() || '{}';
    
    console.log("===== GEMINI RAW FIRST PASS =====");
    console.log(raw);
    console.log("===== END RAW OUTPUT =====");
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("JSON PARSE ERROR:", err);
      console.error("RAW THAT FAILED:", raw);
      parsed = {
        assistant_message: "Something slipped my heels 😂 let's try that again.",
        pills: ["Retry", "Try again", "New chat"],
        metadata: { mode: "error" }
      };
    }

    const assistantText = parsed.assistant_message || "";
    const meta = parsed.metadata || {};

    console.log('Chat: parsed JSON', {
      messageLength: assistantText.length,
      metadata: meta
    });

    // Create typing simulation stream with two-pass architecture
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        console.log('Chat: starting PASS 1 - typing simulation');
        
        // PASS 1: Stream assistant message character by character
        for (const ch of assistantText) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`
            )
          );
          await new Promise(r => setTimeout(r, 12));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        console.log('Chat: PASS 1 complete, starting PASS 2 - pill generation');

        // PASS 2: Generate contextual pills based on assistant message
        try {
          const pillResponse = await retryWithBackoff(() => callGeminiAPI({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: "system",
                content: "Generate 3-8 short (1-4 word) contextual pill suggestions based on the assistant's message. Return ONLY a JSON array of strings, nothing else."
              },
              {
                role: "user",
                content: `Here is the assistant message: "${assistantText}"\n\nGenerate contextual next-step suggestions as a JSON array. Examples: ["Upload outfit", "Try casual", "Show me jeans", "Budget tips"]`
              }
            ],
            temperature: 0.6,
            max_tokens: 100
          }));

          const pillRaw = pillResponse.choices?.[0]?.message?.content?.trim() || '[]';
          console.log("===== GEMINI PILL RESPONSE =====");
          console.log(pillRaw);
          console.log("===== END PILL OUTPUT =====");

          let pills = [];
          try {
            pills = JSON.parse(pillRaw);
            if (!Array.isArray(pills)) pills = [];
          } catch (e) {
            console.error("Pill parse error:", e);
            pills = ["Try again", "New topic", "Help me"];
          }

          if (pills.length > 0) {
            console.log('Chat: sending PASS 2 pills', { count: pills.length, pills });
            controller.enqueue(
              encoder.encode(
                `event: suggestions\ndata: ${JSON.stringify({
                  type: "suggestions",
                  pills: pills
                })}\n\n`
              )
            );
          }
        } catch (pillError) {
          console.error("PASS 2 pill generation error:", pillError);
          // Graceful degradation: send basic pills
          controller.enqueue(
            encoder.encode(
              `event: suggestions\ndata: ${JSON.stringify({
                type: "suggestions",
                pills: ["Continue", "New topic", "Help"]
              })}\n\n`
            )
          );
        }

        controller.close();
        console.log('Chat: stream complete (PASS 1 + PASS 2)');
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });

  } catch (error) {
    console.error('Chat: error processing request', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
