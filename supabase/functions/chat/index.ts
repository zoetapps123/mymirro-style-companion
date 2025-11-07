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

    const userId = user.id; // Extract userId from verified JWT
    const { messages, userProfile, wardrobeItems, recentBattles, recentStyleChecks } = await req.json();
    const apiKey = getAIApiKey();

    // 🔍 LOG 1: Request Body Inspection
    console.log('Chat: received wardrobeItems', { 
      count: wardrobeItems?.length || 0,
      hasItems: !!wardrobeItems,
      itemIds: wardrobeItems?.map((i: any) => i.id).slice(0, 3) // first 3 IDs
    });

    // Fetch only user profile (wardrobe items now come from client for performance)
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

    // 🔍 LOG 2: System Prompt Verification
    console.log('Chat: system prompt built', {
      hasWardrobeContext: systemPrompt.includes('WARDROBE INVENTORY'),
      promptLength: systemPrompt.length,
      wardrobeItemsInPrompt: wardrobeItems?.length || 0
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

    // Fast-path: handle outfit creation and wardrobe queries deterministically
    const lastUserText = (messages?.[messages.length - 1]?.content || '').toLowerCase();
    
    // Check for outfit creation requests
    const outfitQuery = 
      (lastUserText.includes('create') || lastUserText.includes('generate') || lastUserText.includes('make') || lastUserText.includes('suggest')) && 
      (lastUserText.includes('outfit') || lastUserText.includes('look'));
    
    if (outfitQuery) {
      let items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
      if (!items || items.length === 0) {
        try {
          const { data } = await supabase
            .from('wardrobe_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          items = data || [];
        } catch (e) {
          console.error('Chat: fast-path outfit fetch failed', e);
        }
      }

      if (items.length > 0) {
        console.log('Chat: fast-path outfit generation', { count: items.length, query: lastUserText });
        
        // Extract occasion/style from message if present
        let occasion = 'casual';
        let style = 'comfortable';
        if (lastUserText.includes('formal')) occasion = 'formal';
        if (lastUserText.includes('business')) occasion = 'business';
        if (lastUserText.includes('date')) occasion = 'date';
        if (lastUserText.includes('party')) occasion = 'party';
        if (lastUserText.includes('workout')) occasion = 'workout';
        
        // Call generate-outfit function
        try {
          const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
            body: {
              generationType: 'occasion',
              occasion,
              style,
              wardrobeItems: items,
            }
          });

          if (!outfitError && Array.isArray(outfitData?.outfits) && outfitData.outfits.length > 0) {
            const outfits = outfitData.outfits as any[];
            const outfit = outfits[0];
            const total = outfits.length;
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                // Text response
                const textChunk = { choices: [{ delta: { content: `I've created ${total} outfit${total > 1 ? 's' : ''} for you! Showing the first now.` } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
                // Tool call to show first outfit
                const toolChunk = { 
                  choices: [{ 
                    delta: { 
                      tool_calls: [{ 
                        type: 'function', 
                        function: { 
                          name: 'create_outfit_suggestion', 
                          arguments: JSON.stringify({ 
                            outfit_name: outfit.name || 'Your Outfit',
                            item_ids: (outfit.items || []).map((item: any) => item.id).filter(Boolean),
                            reasoning: outfit.reasoning || `A ${occasion} outfit that's ${style} and stylish.`
                          }) 
                        } 
                      }] 
                    } 
                  }] 
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
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
          } else {
            console.error('Chat: outfit generation failed or returned no outfits', outfitError);
          }
        } catch (e) {
          console.error('Chat: outfit generation exception', e);
        }
      }
    }
    
    // Check for wardrobe queries
    const wardrobeQuery =
      /what.*(do i|do we|do you).*have.*(in)?\s*(my|the|your)?\s*(wardrobe|closet)/i.test(lastUserText) ||
      /what.*(is|s).*in\s*(my|the|your)?\s*(wardrobe|closet)/i.test(lastUserText) ||
      lastUserText.includes('what do i have in my wardrobe') ||
      lastUserText.trim() === 'what do i have in my wardrobe' ||
      lastUserText.trim() === 'what do i have';
    
if (wardrobeQuery) {
      let items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
      if (!items || items.length === 0) {
        try {
          const { data } = await supabase
            .from('wardrobe_items')
            .select('id, name, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);
          items = data || [];
        } catch (e) {
          console.error('Chat: fast-path wardrobe fetch failed', e);
        }
      }

      if (items.length > 0) {
        console.log('Chat: fast-path wardrobe', { count: items.length });
        const itemIds = items.map((i: any) => i.id).filter(Boolean);
        // Build category summary
        const counts: Record<string, number> = {};
        for (const it of items) {
          const cat = (it.category || 'Other').toString();
          counts[cat] = (counts[cat] || 0) + 1;
        }
        const summary = Object.entries(counts)
          .sort((a,b) => b[1]-a[1])
          .map(([cat, cnt]) => `${cat} (${cnt})`)
          .join(', ');
        const context = `Showing all ${itemIds.length} items: ${summary}`;
        
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // 1) short text
            const textChunk = { choices: [{ delta: { content: `You have ${itemIds.length} items in your wardrobe. I’ll show them below.` } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
            // 2) tool call
            const toolChunk = { choices: [{ delta: { tool_calls: [{ type: 'function', function: { name: 'show_wardrobe_items', arguments: JSON.stringify({ item_ids: itemIds, context }) } }] } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
            // done
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
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
    }

    // 🔍 LOG 3: Pre-API Call Summary
    console.log('Chat: calling Gemini API', {
      model: 'google/gemini-2.5-flash',
      messageCount: processedMessages.length,
      systemPromptPreview: systemPrompt.substring(0, 200),
      wardrobeCount: wardrobeItems?.length || 0,
      hasTools: tools.length > 0
    });

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
                    console.log('Chat: tool call detected', { 
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
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      },
    });
  } catch (error) {
    // 🔍 LOG 4: Enhanced Error Logging
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
