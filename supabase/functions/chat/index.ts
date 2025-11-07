import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPIStreaming, callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';
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
    let bodyShape, skinTone;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('body_shape, skin_tone')
        .eq('id', userId)
        .single();
      
      bodyShape = profile?.body_shape;
      skinTone = profile?.skin_tone;
    } catch (e) {
      console.error('Failed to fetch user context:', e);
    }

    // Build system prompt
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
          description: "Create complete outfit suggestions from user's wardrobe. Only use when user explicitly asks for outfit suggestions or what to wear.",
          parameters: {
            type: "object",
            properties: {
              occasion: {
                type: "string",
                description: "The occasion or context (casual, formal, date, wedding, party, business, interview, workout, beach, etc.)"
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

    // Step 1: Call Gemini with tools to determine intent
    const initialResponse = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ],
      tools
    });

    console.log('Chat: initial response received', {
      hasToolCalls: !!initialResponse.choices?.[0]?.message?.tool_calls,
      toolCallsCount: initialResponse.choices?.[0]?.message?.tool_calls?.length || 0
    });

    // Step 2: Check if Gemini wants to call tools
    const assistantMessage = initialResponse.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      console.log('Chat: processing tool calls', { count: toolCalls.length });
      
      // Execute tool calls
      const toolResults: any[] = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log('Chat: executing tool', { functionName, args });
        
        if (functionName === 'fetch_wardrobe_items') {
          // Fetch wardrobe items
          try {
            let query = supabase
              .from('wardrobe_items')
              .select('*')
              .eq('user_id', userId);
            
            if (args.category) {
              query = query.ilike('category', `%${args.category}%`);
            }
            
            const { data: items } = await query.order('created_at', { ascending: false }).limit(100);
            
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({
                success: true,
                items: items || [],
                count: items?.length || 0
              })
            });
          } catch (e) {
            console.error('fetch_wardrobe_items error:', e);
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ success: false, error: 'Failed to fetch wardrobe items' })
            });
          }
        }
        
        else if (functionName === 'generate_outfits') {
          // Call generate-outfit edge function
          try {
            const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
              body: {
                generationType: 'occasion',
                occasion: args.occasion,
                style: args.style || 'versatile',
                wardrobeItems: wardrobeItems,
                maxOutfits: args.count || 3,
              },
              headers: { Authorization: authHeader }
            });
            
            if (outfitError) throw outfitError;
            
            const outfits = outfitData?.outfits || [];
            
            if (outfits.length > 0) {
              // Success - tell AI to display them
              toolResults.push({
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: true,
                  outfits: outfits.map((o: any) => ({
                    name: o.name || `${args.occasion} Look`,
                    pieces: o.pieces || o.items || [],
                    reasoning: o.reasoning || `Perfect for ${args.occasion}`,
                    item_ids: (o.pieces || o.items || []).map((p: any) => p.wardrobeItemId || p.id).filter(Boolean)
                  })),
                  instruction: `Successfully generated ${outfits.length} outfit(s). Use create_outfit_suggestion tool to display them visually with outfit_name, item_ids, and reasoning for each.`
                })
              });
            } else {
              // No outfits - wardrobe lacks items
              toolResults.push({
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: false,
                  message: `Could not create outfits for ${args.occasion}. The wardrobe lacks appropriate items for this occasion.`,
                  instruction: 'Tell user their wardrobe needs items suitable for this occasion. Suggest what types of items they should add.'
                })
              });
            }
          } catch (e) {
            console.error('generate_outfits error:', e);
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ success: false, error: 'Failed to generate outfits' })
            });
          }
        }
        
        else if (functionName === 'analyze_shopping_needs') {
          // Analyze wardrobe gaps
          try {
            let items = wardrobeItems;
            if (!items || items.length === 0) {
              const { data } = await supabase
                .from('wardrobe_items')
                .select('id, name, category')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200);
              items = data || [];
            }
            
            const norm = (s: any) => (s || '').toString().toLowerCase();
            const metrics = (items || []).reduce((acc: any, it: any) => {
              const c = norm(it.category);
              if (['shirt','top','tee','t-shirt','blouse','polo','kurta'].some(k => c.includes(k))) acc.tops++;
              else if (['jeans','trouser','pants','chinos','skirt','shorts'].some(k => c.includes(k))) acc.bottoms++;
              else if (['shoe','sneaker','boot','loafer','heel','sandal','flip flop','flip-flop','slipper'].some(k => c.includes(k))) acc.shoes++;
              else if (['jacket','blazer','coat','cardigan','sweater','hoodie','outerwear','layer'].some(k => c.includes(k))) acc.layers++;
              else if (['watch','belt','bag','sunglass','glass','glasses','hat','cap','scarf','jewelry','ring','bracelet','necklace'].some(k => c.includes(k))) acc.accessories++;
              else acc.other++;
              return acc;
            }, { tops:0, bottoms:0, shoes:0, layers:0, accessories:0, other:0 });
            
            const gaps: string[] = [];
            if (metrics.shoes === 0) gaps.push('footwear');
            if (metrics.tops === 0) gaps.push('tops');
            if (metrics.bottoms === 0) gaps.push('bottoms');
            if (metrics.layers === 0) gaps.push('layering');
            if (metrics.accessories === 0) gaps.push('accessories');
            
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({
                success: true,
                metrics,
                gaps,
                totalItems: items.length
              })
            });
          } catch (e) {
            console.error('analyze_shopping_needs error:', e);
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ success: false, error: 'Failed to analyze wardrobe' })
            });
          }
        }
        
        else if (functionName === 'show_wardrobe_items' || functionName === 'create_outfit_suggestion') {
          // These are visual tools - they don't need backend execution, just pass through to frontend
          toolResults.push({
            role: 'tool',
            name: functionName,
            content: JSON.stringify({ success: true, message: 'Tool will be handled by frontend' })
          });
        }
      }
      
      console.log('Chat: tool results prepared', { count: toolResults.length });
      
      // Step 3: Call Gemini again with tool results to get final response
      const conversationWithTools = [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
        { role: 'assistant', content: assistantMessage.content || null, tool_calls: toolCalls },
        ...toolResults
      ];
      
      const geminiResponse = await callGeminiAPIStreaming({
        model: 'google/gemini-2.5-flash',
        messages: conversationWithTools,
        tools // Keep tools available for potential follow-up calls
      });
      
      // Convert Gemini SSE stream to OpenAI-compatible format
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            console.log('Chat: starting final Gemini stream');
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
                      const openaiChunk = {
                        choices: [{
                          delta: {
                            content: textPart.text
                          }
                        }]
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                    }
                    
                    // Check for function calls
                    const functionPart = parts.find((p: any) => p.functionCall);
                    if (functionPart) {
                      console.log('Chat: visual tool call detected', { 
                        toolName: functionPart.functionCall.name
                      });
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

      return new Response(stream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        },
      });
    }
    
    // No tool calls - stream direct response
    console.log('Chat: no tool calls, streaming direct response');
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
                    const openaiChunk = {
                      choices: [{
                        delta: {
                          content: textPart.text
                        }
                      }]
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                  }
                  
                  // Check for function calls
                  const functionPart = parts.find((p: any) => p.functionCall);
                  if (functionPart) {
                    console.log('Chat: tool call detected', { 
                      toolName: functionPart.functionCall.name
                    });
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

    return new Response(stream, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      },
    });
  } catch (error) {
    console.error('Chat error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
