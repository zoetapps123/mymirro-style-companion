import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAIApiKey, GEMINI_API_KEY_ENV_VAR } from '../_shared/ai-config.ts';
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

    const response = await fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...processedMessages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
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
