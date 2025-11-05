import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPIStreaming, getAIApiKey, GEMINI_API_KEY_ENV_VAR } from '../_shared/ai-config.ts';
import { SYSTEM_PROMPTS, SystemRole } from '../_shared/prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const userId = user.id; // Extract userId from verified JWT
    const { messages, userProfile, recentBattles, recentStyleChecks } = await req.json();
    const apiKey = getAIApiKey();

    // Fetch enhanced user context from database
    let bodyShape, skinTone, wardrobeItems;
    try {

        // Fetch user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('body_shape, skin_tone')
          .eq('id', userId)
          .single();
        
        bodyShape = profile?.body_shape;
        skinTone = profile?.skin_tone;

        // Fetch wardrobe summary (top 10 recent items with IDs)
        const { data: items } = await supabase
          .from('wardrobe_items')
          .select('id, name, category, color')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
        
      wardrobeItems = items || [];
    } catch (e) {
      console.error('Failed to fetch user context:', e);
    }

    // Build personalized system prompt with user context
    const systemPrompt = SYSTEM_PROMPTS[SystemRole.AI_COMPANION]({
      userName: userProfile?.name || 'there',
      gender: userProfile?.gender,
      location: userProfile?.location || 'India',
      bodyShape,
      skinTone,
      wardrobeItems,
      recentBattles,
      recentStyleChecks
    });

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

    // Define tools for visual wardrobe responses
    const tools = [
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
          description: "Create and display a visual outfit suggestion from wardrobe items",
          parameters: {
            type: "object",
            properties: {
              outfit_name: {
                type: "string",
                description: "Name of the outfit"
              },
              item_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of wardrobe item IDs that make up the outfit"
              },
              reasoning: {
                type: "string",
                description: "Why this outfit works well"
              }
            },
            required: ["outfit_name", "item_ids", "reasoning"]
          }
        }
      }
    ];

    // Call Gemini API directly with streaming
    const geminiResponse = await callGeminiAPIStreaming({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ],
      tools
    });

    // Convert Gemini SSE stream to OpenAI-compatible format
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          console.log('Chat: starting Gemini stream');
          const reader = geminiResponse.body?.getReader();
          if (!reader) {
            console.log('Chat: no response body from Gemini');
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                try {
                  const parsed = JSON.parse(data);
                  const candidate = parsed.candidates?.[0];
                  const content = candidate?.content;
                  const parts = content?.parts || [];
                  
                  // Check for text content
                  const textPart = parts.find((p: any) => p.text);
                  if (textPart) {
                    // Convert to OpenAI format
                    const openaiChunk = {
                      choices: [{
                        delta: {
                          content: textPart.text
                        }
                      }]
                    };
                    console.log('Chat: delta length', (textPart.text || '').length);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                  }
                  
                  // Check for function calls
                  const functionPart = parts.find((p: any) => p.functionCall);
                  if (functionPart) {
                    const openaiChunk = {
                      choices: [{
                        delta: {
                          tool_calls: [{
                            type: 'function',
                            function: {
                              name: functionPart.functionCall.name,
                              arguments: JSON.stringify(functionPart.functionCall.args)
                            }
                          }]
                        }
                      }]
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                  }
                } catch (e) {
                  console.error('Failed to parse Gemini chunk:', e);
                }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    // Return OpenAI-compatible streaming response
    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
