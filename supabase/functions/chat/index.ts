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

    // Fast-path: Classify user intent FIRST before any action
    const lastUserText = (messages?.[messages.length - 1]?.content || '').toLowerCase();
    
    // 1. WARDROBE ANALYSIS QUERIES (look at wardrobe, analyze gaps)
    const wardrobeAnalysisQuery = 
      /look at (my|the) wardrobe/i.test(lastUserText) ||
      /analyze (my|the) wardrobe/i.test(lastUserText) ||
      /check (my|the) wardrobe/i.test(lastUserText) ||
      (lastUserText.includes('wardrobe') && (
        lastUserText.includes('tell me') || 
        lastUserText.includes('what am i missing') ||
        lastUserText.includes('gaps')
      ));
    
    // 2. SHOPPING ADVICE QUERIES (should I shop/buy, what to add)
    const shoppingAdviceQuery = 
      /should i (shop|buy|get|add|purchase)/i.test(lastUserText) ||
      /what should i (shop|buy|get|add|purchase)/i.test(lastUserText) ||
      /recommend.*to buy/i.test(lastUserText) ||
      /suggest.*to shop/i.test(lastUserText) ||
      /do i (need|have) (to )?(shop|buy|get|add|purchase) more/i.test(lastUserText) ||
      /should i .*shop more/i.test(lastUserText) ||
      lastUserText.includes('shop more') ||
      lastUserText.includes('buy more') ||
      lastUserText.includes('need more clothes') ||
      lastUserText.includes('need more outfits') ||
      (lastUserText.includes('shop') && !lastUserText.includes('outfit')) ||
      (lastUserText.includes('buy') && !lastUserText.includes('wear'));
    // 3. ANCHOR ITEM QUERIES (what to wear with specific item)
    const anchorItemQuery =
      /what (should|can|do) (i|we) wear with (my|the|this)/i.test(lastUserText) ||
      /style (my|the|this)/i.test(lastUserText) ||
      /pair with (my|the|this)/i.test(lastUserText) ||
      /match (my|the|this)/i.test(lastUserText) ||
      /goes (well )?with (my|the|this)/i.test(lastUserText);
    
    // 4. WARDROBE INVENTORY QUERIES (what do I have)
    const wardrobeInventoryQuery =
      /what.*(do i|do we|do you).*have.*(in)?\s*(my|the|your)?\s*(wardrobe|closet)/i.test(lastUserText) ||
      /what.*(is|s).*in\s*(my|the|your)?\s*(wardrobe|closet)/i.test(lastUserText) ||
      /show (me )?(my|the) wardrobe/i.test(lastUserText) ||
      lastUserText.includes('what do i have in my wardrobe') ||
      lastUserText.trim() === 'what do i have';
    
    // 5. OUTFIT CREATION QUERIES (what should I wear for occasion)
    // STRICT MATCHING: Only generate outfits when user explicitly asks for them
    const explicitOutfitPhrases = [
      /what (should|can|could|do) i wear/i,
      /what.*(outfit|outfits|look|looks)/i, // "what outfits can I create", "what looks work"
      /suggest (an?|some|me)?\s*(outfit|look)/i,
      /create (an?|some)?\s*(outfit|look)/i,
      /make (me )?(an?|some)?\s*(outfit|look)/i,
      /show.*(outfit|look)/i, // "show me outfit options"
      /outfit for (a|the|my)/i,
      /outfit.*(wedding|date|party|interview|office|work|event)/i,
      /dress me (for|up)/i,
      /style me (for)?/i,
      /what to wear (for|to)/i,
      /give me.*(outfit|look)/i,
      /need.*(outfit|look)/i,
      /pick.*(outfit|look)/i,
      /help.*pick.*(outfit|look|wear)/i
    ];
    
    const outfitCreationQuery = 
      !shoppingAdviceQuery && 
      !wardrobeAnalysisQuery && 
      !anchorItemQuery &&
      explicitOutfitPhrases.some(pattern => pattern.test(lastUserText));
    
    console.log('Chat: Intent classification', {
      query: lastUserText.substring(0, 100),
      wardrobeAnalysis: wardrobeAnalysisQuery,
      shoppingAdvice: shoppingAdviceQuery,
      anchorItem: anchorItemQuery,
      wardrobeInventory: wardrobeInventoryQuery,
      outfitCreation: outfitCreationQuery
    });
    
    // Handle wardrobe analysis queries - provide deterministic text analysis (no outfits)
    if (wardrobeAnalysisQuery || shoppingAdviceQuery) {
      let items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
      if (!items || items.length === 0) {
        try {
          const { data } = await supabase
            .from('wardrobe_items')
            .select('id, name, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);
          items = data || [];
        } catch (e) {
          console.error('Chat: wardrobe analysis fetch failed', e);
        }
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

      const summary = `Wardrobe snapshot: Tops ${metrics.tops}, Bottoms ${metrics.bottoms}, Shoes ${metrics.shoes}, Layers ${metrics.layers}, Accessories ${metrics.accessories}.`;
      const advice = gaps.length
        ? `You’re light on ${gaps.join(', ')}. ${shoppingAdviceQuery ? 'I’d shop these next to unlock more outfit options.' : 'Consider adding these to expand your looks.'}`
        : `${shoppingAdviceQuery ? 'No urgent shopping needed.' : 'You’re well covered for most outfits.'}`;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const text = `${summary} ${advice}`;
          const textChunk = { choices: [{ delta: { content: text } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
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

    // Handle anchor item queries - let AI find the item and create outfits with it
    else if (anchorItemQuery) {
      console.log('Chat: Detected anchor item query - letting AI handle it');
      // Let AI handle finding the item and creating outfits with it
      // Continue to AI streaming below (no fast-path)
    }
    
    // Handle wardrobe inventory queries - show items visually
    else if (wardrobeInventoryQuery) {
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
        console.log('Chat: fast-path wardrobe inventory', { count: items.length });
        const itemIds = items.map((i: any) => i.id).filter(Boolean);
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
            const textChunk = { choices: [{ delta: { content: `You have ${itemIds.length} items in your wardrobe. I'll show them below.` } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
            const toolChunk = { choices: [{ delta: { tool_calls: [{ type: 'function', function: { name: 'show_wardrobe_items', arguments: JSON.stringify({ item_ids: itemIds, context }) } }] } }] };
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
      }
    }
    
    // Handle outfit creation queries - use fast-path
    else if (outfitCreationQuery) {
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
        // Detect if request is vague (no specific occasion mentioned)
        const occasionKeywords = ['wedding', 'date', 'party', 'interview', 'office', 'work', 'business', 'formal', 'casual', 'beach', 'gym', 'dinner', 'brunch'];
        const hasSpecificOccasion = occasionKeywords.some(k => lastUserText.includes(k));
        const isVagueRequest = !hasSpecificOccasion;
        
        console.log('Chat: fast-path outfit generation', { count: items.length, query: lastUserText, isVague: isVagueRequest });
        
        // If vague request, generate outfits for multiple occasions
        if (isVagueRequest) {
          const multiOccasions = ['casual', 'business', 'date'];
          const allOutfits: any[] = [];
          
          for (const occ of multiOccasions) {
            try {
              const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
                body: {
                  generationType: 'occasion',
                  occasion: occ,
                  style: 'versatile',
                  wardrobeItems: items,
                  maxOutfits: 1,
                },
                headers: { Authorization: authHeader }
              });
              
              if (!outfitError && Array.isArray(outfitData?.outfits) && outfitData.outfits.length > 0) {
                allOutfits.push(...outfitData.outfits.map((o: any) => ({ ...o, occasion: occ })));
              }
            } catch (e) {
              console.error(`Chat: outfit generation failed for ${occ}`, e);
            }
          }
          
          if (allOutfits.length > 0) {
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                const textChunk = { choices: [{ delta: { content: `I've created ${allOutfits.length} versatile outfits for different occasions! Swipe to see all options.` } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
                const toolChunk = { 
                  choices: [{ 
                    delta: { 
                      tool_calls: [{ 
                        type: 'function', 
                        function: { 
                          name: 'create_outfit_suggestion', 
                          arguments: JSON.stringify({ 
                            outfits: allOutfits.map(outfit => ({
                              outfit_name: `${outfit.occasion.charAt(0).toUpperCase() + outfit.occasion.slice(1)} ${outfit.name || 'Look'}`,
                              item_ids: (outfit.items || []).map((item: any) => item.id).filter(Boolean),
                              reasoning: outfit.reasoning || `A ${outfit.occasion} outfit that's stylish and versatile.`
                            }))
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
          }
        }
        
        // Extract occasion/style from message if present
        let occasion = 'casual';
        let style = 'comfortable';
        if (lastUserText.includes('wedding')) { occasion = 'wedding'; style = 'elegant'; }
        if (lastUserText.includes('formal')) { occasion = 'formal'; style = 'elegant'; }
        if (lastUserText.includes('business') || lastUserText.includes('office') || lastUserText.includes('work')) occasion = 'business';
        if (lastUserText.includes('interview')) occasion = 'interview';
        if (lastUserText.includes('date')) occasion = 'date';
        if (lastUserText.includes('party') || lastUserText.includes('festival')) occasion = 'party';
        if (lastUserText.includes('workout') || lastUserText.includes('gym')) occasion = 'workout';
        if (lastUserText.includes('beach')) occasion = 'beach';
        if (lastUserText.includes('vacation') || lastUserText.includes('travel') || lastUserText.includes('holiday')) occasion = 'vacation';
        if (lastUserText.includes('dinner') || lastUserText.includes('brunch')) occasion = lastUserText.includes('dinner') ? 'dinner' : 'brunch';
        if (lastUserText.includes('casual')) style = 'casual';
        if (lastUserText.includes('smart') && lastUserText.includes('casual')) style = 'smart casual';
        if (lastUserText.includes('street')) style = 'streetwear';
        if (lastUserText.includes('elegant')) style = 'elegant';
        if (lastUserText.includes('sporty')) style = 'sporty';
        
        // Call generate-outfit function
        try {
          const { data: outfitData, error: outfitError } = await supabase.functions.invoke('generate-outfit', {
            body: {
              generationType: 'occasion',
              occasion,
              style,
              wardrobeItems: items,
              maxOutfits: 3, // Request 3 different outfit options
            },
            headers: { Authorization: authHeader }
          });

          if (!outfitError && Array.isArray(outfitData?.outfits) && outfitData.outfits.length > 0) {
            const outfits = outfitData.outfits as any[];
            const total = outfits.length;
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                const textChunk = { choices: [{ delta: { content: `I've created ${total} outfit${total > 1 ? 's' : ''} for you!${total > 1 ? ' Swipe to see all options.' : ''}` } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
                const toolChunk = { 
                  choices: [{ 
                    delta: { 
                      tool_calls: [{ 
                        type: 'function', 
                        function: { 
                          name: 'create_outfit_suggestion', 
                          arguments: JSON.stringify({ 
                            outfits: outfits.map(outfit => ({
                              outfit_name: outfit.name || 'Your Outfit',
                              item_ids: (outfit.items || []).map((item: any) => item.id).filter(Boolean),
                              reasoning: outfit.reasoning || `A ${occasion} outfit that's ${style} and stylish.`
                            }))
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
          } else if (!outfitError && outfitData?.outfits?.length === 0) {
            // No appropriate items for this occasion
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                const textChunk = { choices: [{ delta: { content: `I checked your wardrobe, but you don't have the right items for a ${occasion} occasion. For ${occasion}, you'd need ${occasion === 'wedding' || occasion === 'formal' ? 'formal wear like dress pants, formal shirts, and dress shoes' : occasion === 'workout' ? 'athletic wear and sneakers' : 'more appropriate pieces'}. Time to add some new items to your wardrobe! 👔✨` } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
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

    // Fallback: If user mentions wardrobe/closet but no intent matched, provide a quick wardrobe snapshot without creating outfits
    else if ((lastUserText.includes('wardrobe') || lastUserText.includes('closet'))) {
      let items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
      if (!items || items.length === 0) {
        try {
          const { data } = await supabase
            .from('wardrobe_items')
            .select('id, name, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);
          items = data || [];
        } catch (e) {
          console.error('Chat: fallback wardrobe fetch failed', e);
        }
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

      const summary = `Wardrobe snapshot: Tops ${metrics.tops}, Bottoms ${metrics.bottoms}, Shoes ${metrics.shoes}, Layers ${metrics.layers}, Accessories ${metrics.accessories}.`;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const textChunk = { choices: [{ delta: { content: `${summary} Ask me if you want shopping advice or a specific outfit.` } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
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

    // Define tools based on intent - only allow outfit creation for outfit-related queries
    const tools = [];
    
    // Always allow showing wardrobe items
    tools.push({
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
    });
    
    // Only allow outfit creation for outfit-related queries
    if (outfitCreationQuery || anchorItemQuery) {
      tools.push({
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
      });
    }

    // 🔍 LOG 3: Pre-API Call Summary
    console.log('Chat: calling Gemini API', {
      model: 'google/gemini-2.5-flash',
      messageCount: processedMessages.length,
      systemPromptPreview: systemPrompt.substring(0, 200),
      wardrobeCount: wardrobeItems?.length || 0,
      hasTools: tools.length,
      allowOutfitCreation: outfitCreationQuery || anchorItemQuery
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
