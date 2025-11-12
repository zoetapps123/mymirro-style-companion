import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiAPI, getAIApiKey } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generate Suggestions: request received');
    
    const { messages } = await req.json();
    
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a prompt to generate contextual suggestions
    const lastFewMessages = messages.slice(-4); // Get last 4 messages for context
    const conversationContext = lastFewMessages
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a helpful fashion AI assistant. Based on the conversation context, generate 6-8 short, natural follow-up suggestions that the user might want to say next. 

These suggestions should:
- Be very short (2-5 words max)
- Feel natural and conversational
- Be relevant to what was just discussed
- Help move the conversation forward
- Be specific to fashion/style context when applicable

For example:
- If discussing style preferences: "minimalistic", "streetwear", "classic and chic", "formal", "casual vibe"
- If about occasions: "for a wedding", "date night", "office wear", "weekend casual"
- If about colors: "earth tones", "bold colors", "monochrome", "pastels"
- If asking questions: "show me examples", "tell me more", "something else", "let's try different"

IMPORTANT: Respond with ONLY a JSON array of strings, nothing else. Example: ["suggestion 1", "suggestion 2", "suggestion 3"]`;

    const userPrompt = `Based on this conversation, generate 6-8 short follow-up suggestions:

${conversationContext}`;

    console.log('Calling Gemini API for suggestions');
    
    const response = await callGeminiAPI({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    let suggestions: string[] = [];
    
    try {
      const content = response.choices[0]?.message?.content || '';
      console.log('Raw API response:', content);
      
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try to parse the entire content
        suggestions = JSON.parse(content);
      }
      
      // Validate and clean suggestions
      if (!Array.isArray(suggestions)) {
        throw new Error('Response is not an array');
      }
      
      // Filter and limit suggestions
      suggestions = suggestions
        .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 8);
      
      console.log('Generated suggestions:', suggestions);
      
      if (suggestions.length === 0) {
        throw new Error('No valid suggestions generated');
      }
      
    } catch (parseError) {
      console.error('Failed to parse suggestions:', parseError);
      // Fallback suggestions based on context
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      
      if (lastMessage.includes('style') || lastMessage.includes('vibe')) {
        suggestions = ["minimalistic", "streetwear", "classic and chic", "bohemian", "edgy", "preppy"];
      } else if (lastMessage.includes('occasion') || lastMessage.includes('event')) {
        suggestions = ["wedding", "date night", "office", "party", "casual day", "brunch"];
      } else if (lastMessage.includes('color')) {
        suggestions = ["earth tones", "bold colors", "monochrome", "pastels", "neutrals", "jewel tones"];
      } else {
        suggestions = ["show me examples", "tell me more", "something different", "let's try that", "sounds good", "what else?"];
      }
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestions: ["tell me more", "show examples", "something else", "sounds good"] // Fallback
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
