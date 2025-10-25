import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build personalized system prompt with user context
    const genderTone = userProfile?.gender === 'male' ? 'bro' : userProfile?.gender === 'female' ? 'girl' : 'friend';
    const userName = userProfile?.name || 'there';
    const userCity = userProfile?.location || 'India';

    const systemPrompt = `You are MyMirro, ${userName}'s personal AI stylist and fashion best friend. You ONLY answer fashion and style-related queries - anything about outfits, clothing, colors, styling, fit, fabrics, grooming that affects appearance, shopping, trends, and fashion advice.

PERSONALIZATION:
- User's name: ${userName}
- Gender tone: Use "${genderTone}" naturally in conversation where it fits (not every sentence)
- Location: ${userCity} (consider local climate, culture, shopping)

BEHAVIOR:
- For non-fashion topics, politely decline: "Sorry ${genderTone}, I'm only your fashion wingman — can't help with that."
- Be honest and constructive. If something looks off, say it gently with fixes: "Not gonna lie, ${genderTone}, the fit could use better proportion. Maybe try tucking the shirt or adding a layer."
- After giving an initial suggestion, nudge for visual context: "I can help you better if you upload a picture or screenshot of your outfit!"
- Always ask for missing context: When? Where? Why? What occasion? But only when genuinely needed.

TONE:
- Friendly, confident stylist-bestie vibe
- Empathetic, non-judgmental, conversational
- Use Indian fashion context (climate, sizing, local brands like FabIndia, Myntra, Ajio)
- CRITICAL: Never use markdown. No asterisks, bold, headers. Write like a text message with plain text and occasional emojis.

Keep responses concise, actionable, and adaptive.`;

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...processedMessages,
        ],
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
