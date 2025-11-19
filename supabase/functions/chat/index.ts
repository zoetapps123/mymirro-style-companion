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
    const systemPrompt = basePrompt;
    
    console.log("SYSTEM PROMPT SIZE:", systemPrompt.length);

    // User context
    const userContextMessage = {
      role: "system",
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

    // Wardrobe summary and data - separated for better context management
    const wardrobeSummary = `
<WARDROBE_SUMMARY>
total_items=${wardrobeItems?.length || 0}
categories=${[...new Set((wardrobeItems || []).map((i: any) => i.category))].join(", ")}
</WARDROBE_SUMMARY>
`;

    const wardrobeJSON = `WARDROBE_DATA_JSON:\n${JSON.stringify(wardrobeItems || [])}`;
    const battlesJSON = `RECENT_BATTLES_JSON:\n${JSON.stringify(recentBattles || [])}`;
    const styleChecksJSON = `RECENT_STYLE_CHECKS_JSON:\n${JSON.stringify(recentStyleChecks || [])}`;

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

    // Call Gemini API with streaming
    const response = await retryWithBackoff(() => callGeminiAPIStreaming({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: "system", content: systemPrompt },
        userContextMessage,
        { role: "system", content: wardrobeSummary },
        { role: "system", content: wardrobeJSON },
        { role: "system", content: battlesJSON },
        { role: "system", content: styleChecksJSON },
        ...processedMessages
      ],
      tools,
      temperature: 0.7,
      max_tokens: 2048
    }));

    console.log('Chat: streaming response');

    // Return the streaming response directly
    const stream = response.body;

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
