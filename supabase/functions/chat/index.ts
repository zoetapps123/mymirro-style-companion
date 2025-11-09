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
            // ALWAYS fetch full wardrobe items from database to ensure complete data
            console.log('Chat: fetching wardrobe items for outfit generation');
            const { data: items, error: fetchError } = await supabase
              .from('wardrobe_items')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(200);
            
            if (fetchError) {
              console.error('Chat: failed to fetch wardrobe items', fetchError);
              throw new Error('Failed to fetch wardrobe items');
            }
            
            console.log('Chat: fetched wardrobe items', { 
              count: items?.length || 0, 
              sampleCategories: items?.slice(0, 5).map((i: any) => `${i.name} (${i.category})`) 
            });
            
            if (!items || items.length === 0) {
              console.warn('Chat: wardrobe is empty');
              toolResults.push({
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: false,
                  message: 'Your wardrobe is empty. Upload some items first!',
                  instruction: 'Tell user to upload wardrobe items before generating outfits.'
                })
              });
              continue;
            }
            
            const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
              body: {
                generationType: 'occasion',
                occasion: args.occasion,
                style: args.style || 'versatile',
                wardrobeItems: items,
                maxOutfits: args.count || 3,
              },
              headers: { Authorization: authHeader }
            });
            
            if (outfitError) throw outfitError;
            
            const outfits = outfitData?.outfits || [];
            
            if (outfits.length > 0) {
              // Success - prepare outfit data for visual display
              const formattedOutfits = outfits.map((o: any) => {
                // Extract item IDs from pieces/items array
                const itemIds = (o.pieces || o.items || [])
                  .map((p: any) => p.wardrobeItemId || p.id)
                  .filter(Boolean);
                
                return {
                  outfit_name: o.name || `${args.occasion} Look`,
                  item_ids: itemIds,
                  reasoning: o.reasoning || `Perfect for ${args.occasion}`
                };
              });

              toolResults.push({
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: true,
                  outfits: formattedOutfits,
                  instruction: `CRITICAL INSTRUCTIONS:

1. FIRST: Provide a brief, friendly text response acknowledging the ${args.occasion} outfit request (e.g., "Perfect! Here are ${formattedOutfits.length} outfit ideas for your ${args.occasion}:" or "I've got ${formattedOutfits.length} great looks for ${args.occasion}!")

2. THEN: Call create_outfit_suggestion tool with these EXACT parameters:

{
  "outfits": ${JSON.stringify(formattedOutfits, null, 2)}
}

You MUST do BOTH: provide text AND call the tool. DO NOT modify the item_ids. DO NOT use item names. Use the exact item_ids provided above.`
                })
              });
            } else {
              // No outfits - FORCE visual display with mandatory next action
              const userItemIds = items.slice(0, 12).map((i: any) => i.id);
              toolResults.push({
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: false,
                  message: `Could not create complete outfits for ${args.occasion}. The wardrobe has ${items.length} items but lacks key pieces for this occasion.`,
                  available_item_ids: userItemIds,
                  required_next_action: {
                    tool_name: 'show_wardrobe_items',
                    mandatory: true,
                    parameters: {
                      item_ids: userItemIds,
                      context: "Here's what you currently have"
                    },
                    reason: "MANDATORY: You MUST call show_wardrobe_items with these exact parameters in your NEXT tool call. This is NON-NEGOTIABLE. Show the visual display BEFORE explaining what's missing."
                  },
                  explanation_after_visual: `After showing items visually, explain what key pieces are missing for ${args.occasion} (e.g., formal shoes, dress shirt, blazer for date night) and why the current items aren't suitable for this occasion.`
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
        
        else if (functionName === 'show_wardrobe_items') {
          // Visual tool - pass through to frontend
          toolResults.push({
            role: 'tool',
            name: functionName,
            content: JSON.stringify({ success: true, message: 'Tool will be handled by frontend' })
          });
        }
        else if (functionName === 'create_outfit_suggestion') {
          // Normalize outfits: ensure accessories are included when available
          try {
            const norm = (s: any) => (s || '').toString().toLowerCase();
            const isAccessory = (c: string) => [
              'accessor','accessory','accessories',
              'watch','belt','bag','handbag','purse','wallet',
              'sunglass','sunglasses','glass','glasses',
              'hat','cap','scarf',
              'jewelry','jewellery',
              'ring','bracelet','necklace',
              'earring','earrings','bangle','anklet'
            ].some(k => c.includes(k));

            const wardrobe = Array.isArray(wardrobeItems) ? wardrobeItems : [];
            const accessoryPool = wardrobe.filter((i: any) => isAccessory(norm(i.category)));

            const updatedOutfits = (args?.outfits || []).map((o: any) => {
              const itemIds: string[] = Array.isArray(o?.item_ids) ? o.item_ids : [];
              const items = wardrobe.filter((i: any) => itemIds.includes(i.id));
              const hasAccessory = items.some((it: any) => isAccessory(norm(it.category)));

              if (!hasAccessory && accessoryPool.length > 0) {
                const notUsed = accessoryPool.find((acc: any) => !itemIds.includes(acc.id));
                if (notUsed) itemIds.push(notUsed.id);
              }

              return {
                outfit_name: o?.outfit_name || 'Styled Look',
                item_ids: itemIds,
                reasoning: o?.reasoning || 'Balanced look with added accessory for completeness.'
              };
            });

            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({
                success: true,
                message: 'Normalized outfits with accessories when available',
                outfits: updatedOutfits,
                instruction: `CRITICAL: Now call create_outfit_suggestion with EXACTLY this JSON:\n{\n  \"outfits\": ${JSON.stringify(updatedOutfits, null, 2)}\n}\nDo not change item_ids. If an accessory was added, keep it.`
              })
            });
          } catch (e) {
            console.error('create_outfit_suggestion normalization error:', e);
            toolResults.push({
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ success: true, message: 'Tool will be handled by frontend' })
            });
          }
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
      
      console.log('Chat: [FINAL-STREAM] About to call Gemini API for final response', {
        messageCount: conversationWithTools.length,
        timestamp: Date.now()
      });
      
      const geminiResponse = await callGeminiAPIStreaming({
        model: 'google/gemini-2.5-flash',
        messages: conversationWithTools,
        tools // Keep tools available for potential follow-up calls
      });
      
      console.log('Chat: [FINAL-STREAM] Gemini API call returned', {
        hasBody: !!geminiResponse.body,
        status: geminiResponse.status,
        timestamp: Date.now()
      });
      
      // Convert Gemini SSE stream to OpenAI-compatible format
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const streamStartTime = Date.now();
          let chunkCount = 0;
          let lineCount = 0;
          let textChunkCount = 0;
          let functionCallCount = 0;
          
          try {
            console.log('Chat: [FINAL-STREAM] ReadableStream started', { startTime: streamStartTime });
            
            const reader = geminiResponse.body?.getReader();
            if (!reader) {
              console.error('Chat: [FINAL-STREAM] ERROR: No response body from Gemini');
              controller.close();
              return;
            }
            
            console.log('Chat: [FINAL-STREAM] Reader obtained, starting read loop');

            const decoder = new TextDecoder();
            let buffer = '';
            let loopIteration = 0;

            while (true) {
              loopIteration++;
              const readStartTime = Date.now();
              
              console.log('Chat: [FINAL-STREAM] Waiting for next chunk...', {
                iteration: loopIteration,
                bufferSize: buffer.length
              });
              
              const { done, value } = await reader.read();
              
              const readDuration = Date.now() - readStartTime;
              
              if (done) {
                console.log('Chat: [FINAL-STREAM] Stream read complete', {
                  totalChunks: chunkCount,
                  totalLines: lineCount,
                  textChunks: textChunkCount,
                  functionCalls: functionCallCount,
                  totalDuration: Date.now() - streamStartTime,
                  finalBufferSize: buffer.length
                });
                break;
              }
              
              chunkCount++;
              console.log('Chat: [FINAL-STREAM] Chunk received', {
                chunkNumber: chunkCount,
                chunkSize: value.length,
                readDuration,
                timestamp: Date.now()
              });

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              console.log('Chat: [FINAL-STREAM] Processing lines', {
                lineCount: lines.length,
                remainingBuffer: buffer.length
              });

              for (const line of lines) {
                lineCount++;
                
                if (!line.trim() || line.startsWith(':')) {
                  console.log('Chat: [FINAL-STREAM] Skipping empty/comment line', { lineNumber: lineCount });
                  continue;
                }
                
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  console.log('Chat: [FINAL-STREAM] Processing data line', {
                    lineNumber: lineCount,
                    dataPreview: data.substring(0, 100)
                  });
                  
                  try {
                    const parsed = JSON.parse(data);
                    const candidate = parsed.candidates?.[0];
                    const content = candidate?.content;
                    const parts = content?.parts || [];
                    
                    console.log('Chat: [FINAL-STREAM] Parsed chunk structure', {
                      hasCandidates: !!parsed.candidates,
                      candidatesCount: parsed.candidates?.length || 0,
                      hasContent: !!content,
                      partsCount: parts.length
                    });
                    
                    // Check for text content
                    const textPart = parts.find((p: any) => p.text);
                    if (textPart) {
                      textChunkCount++;
                      console.log('Chat: [FINAL-STREAM] Text content found', {
                        textChunk: textChunkCount,
                        textPreview: textPart.text.substring(0, 50)
                      });
                      
                      const openaiChunk = {
                        choices: [{
                          delta: {
                            content: textPart.text
                          }
                        }]
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                      console.log('Chat: [FINAL-STREAM] Text chunk enqueued to client');
                    }
                    
                    // Check for function calls
                    const functionPart = parts.find((p: any) => p.functionCall);
                    if (functionPart) {
                      functionCallCount++;
                      console.log('Chat: [FINAL-STREAM] Function call detected', { 
                        functionCallNumber: functionCallCount,
                        toolName: functionPart.functionCall.name,
                        argsPreview: JSON.stringify(functionPart.functionCall.args).substring(0, 100)
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
                      console.log('Chat: [FINAL-STREAM] Function call enqueued to client');
                    }
                    
                    if (!textPart && !functionPart) {
                      console.log('Chat: [FINAL-STREAM] No text or function call in parts', {
                        partsStructure: parts.map((p: any) => Object.keys(p))
                      });
                    }
                  } catch (e) {
                    console.error('Chat: [FINAL-STREAM] Failed to parse Gemini chunk:', {
                      error: e instanceof Error ? e.message : 'Unknown error',
                      dataPreview: data.substring(0, 200)
                    });
                  }
                }
              }
            }

            console.log('Chat: [FINAL-STREAM] Sending [DONE] signal');
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            console.log('Chat: [FINAL-STREAM] Closing stream controller');
            controller.close();
            console.log('Chat: [FINAL-STREAM] Stream completed successfully', {
              totalDuration: Date.now() - streamStartTime
            });
          } catch (error) {
            console.error('Chat: [FINAL-STREAM] FATAL ERROR in stream', {
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              timestamp: Date.now(),
              duration: Date.now() - streamStartTime,
              chunkCount,
              lineCount
            });
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
                    const fnName = functionPart.functionCall.name;
                    const fnArgs = functionPart.functionCall.args || {};
                    console.log('Chat: tool call detected', { toolName: fnName });

                    // If it's a server-executed tool, pivot to tool execution and stream follow-up
                    const serverTools = ['generate_outfits', 'fetch_wardrobe_items', 'analyze_shopping_needs'];
                    if (serverTools.includes(fnName)) {
                      try {
                        // Execute the tool
                        const toolResults: any[] = [];

                        if (fnName === 'fetch_wardrobe_items') {
                          let query = supabase
                            .from('wardrobe_items')
                            .select('*')
                            .eq('user_id', userId);
                          if (fnArgs.category) query = query.ilike('category', `%${fnArgs.category}%`);
                          const { data: items } = await query.order('created_at', { ascending: false }).limit(100);
                          toolResults.push({ role: 'tool', name: fnName, content: JSON.stringify({ success: true, items: items || [], count: items?.length || 0 }) });
                        }

                        if (fnName === 'generate_outfits') {
                          const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
                            body: {
                              generationType: 'occasion',
                              occasion: fnArgs.occasion,
                              style: fnArgs.style || 'versatile',
                              wardrobeItems,
                              maxOutfits: fnArgs.count || 3,
                            },
                            headers: { Authorization: authHeader }
                          });
                          if (outfitError) throw outfitError;
                          const outfits = outfitData?.outfits || [];
                          if (outfits.length > 0) {
                            toolResults.push({
                              role: 'tool',
                              name: fnName,
                              content: JSON.stringify({
                                success: true,
                                outfits: outfits.map((o: any) => ({
                                  name: o.name || `${fnArgs.occasion} Look`,
                                  pieces: o.pieces || o.items || [],
                                  reasoning: o.reasoning || `Perfect for ${fnArgs.occasion}`,
                                  item_ids: (o.pieces || o.items || []).map((p: any) => p.wardrobeItemId || p.id).filter(Boolean)
                                })),
                                instruction: `Successfully generated ${outfits.length} outfit(s). Use create_outfit_suggestion to display them.`
                              })
                            });
                          } else {
                            toolResults.push({
                              role: 'tool',
                              name: fnName,
                              content: JSON.stringify({ success: false, message: `No suitable outfits for ${fnArgs.occasion}. Suggest what to add.` })
                            });
                          }
                        }

                        if (fnName === 'analyze_shopping_needs') {
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
                          toolResults.push({ role: 'tool', name: fnName, content: JSON.stringify({ success: true, metrics, gaps, totalItems: items.length }) });
                        }

                        // Build follow-up conversation and stream it
                        const conversationWithTools = [
                          { role: 'system', content: systemPrompt },
                          ...processedMessages,
                          { role: 'assistant', content: null, tool_calls: [{ type: 'function', function: { name: fnName, arguments: JSON.stringify(fnArgs) } }] },
                          ...toolResults
                        ];

                        const followUp = await callGeminiAPIStreaming({
                          model: 'google/gemini-2.5-flash',
                          messages: conversationWithTools,
                          tools
                        });

                        const followReader = followUp.body?.getReader();
                        const followDecoder = new TextDecoder();
                        let followBuffer = '';
                        while (true) {
                          const { done, value } = await followReader!.read();
                          if (done) break;
                          followBuffer += followDecoder.decode(value, { stream: true });
                          const lines2 = followBuffer.split('\n');
                          followBuffer = lines2.pop() || '';
                          for (const l2 of lines2) {
                            if (!l2.trim() || l2.startsWith(':')) continue;
                            if (l2.startsWith('data: ')) {
                              controller.enqueue(encoder.encode(l2 + '\n\n'));
                            }
                          }
                        }

                        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                        controller.close();
                        return; // Stop original stream, we've finished
                      } catch (toolErr) {
                        console.error('Server-side tool execution failed:', toolErr);
                        // Fallback: forward the function call to client to handle visually
                        const openaiChunk = {
                          choices: [{
                            delta: {
                              tool_calls: [{
                                type: 'function',
                                function: {
                                  name: fnName,
                                  arguments: JSON.stringify(fnArgs)
                                }
                              }]
                            }
                          }]
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                      }
                    } else {
                      // Visual tools: forward to client
                      const openaiChunk = {
                        choices: [{
                          delta: {
                            tool_calls: [{
                              type: 'function',
                              function: {
                                name: fnName,
                                arguments: JSON.stringify(fnArgs)
                              }
                            }]
                          }
                        }]
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                    }
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
