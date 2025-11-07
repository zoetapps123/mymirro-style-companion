/**
 * Centralized AI API Configuration for Direct Gemini API
 */

export const GEMINI_API_KEY_ENV_VAR = 'GEMINI_API_KEY';

// Model mapping from Lovable AI Gateway format to direct Gemini models
const MODEL_MAPPING: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.0-flash-exp',
  'google/gemini-2.5-flash': 'gemini-2.0-flash-exp',
  'google/gemini-2.5-flash-lite': 'gemini-2.0-flash-exp',
  'google/gemini-2.5-flash-image-preview': 'gemini-2.0-flash-exp',
};

/**
 * Get the configured Gemini API key from environment
 */
export function getAIApiKey(): string {
  const apiKey = Deno.env.get(GEMINI_API_KEY_ENV_VAR);
  if (!apiKey) {
    throw new Error(`${GEMINI_API_KEY_ENV_VAR} not configured`);
  }
  return apiKey;
}

/**
 * Convert OpenAI-style messages to Gemini contents format
 */
function convertMessagesToContents(messages: any[]): any[] {
  const contents: any[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini doesn't have system role, prepend to first user message
      continue;
    }
    
    const role = msg.role === 'assistant' ? 'model' : 'user';
    
    if (typeof msg.content === 'string') {
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const item of msg.content) {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url') {
          const imageUrl = item.image_url?.url || item.image_url;
          if (imageUrl.startsWith('data:image')) {
            const [header, base64Data] = imageUrl.split(',');
            const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          } else {
            parts.push({
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageUrl
              }
            });
          }
        }
      }
      contents.push({ role, parts });
    }
  }
  
  // Prepend system message to first user message if exists
  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
    contents[0].parts.unshift({ text: systemMsg.content });
  }
  
  return contents;
}

/**
 * Convert OpenAI-style tools to Gemini function declarations
 */
function convertToolsToFunctionDeclarations(tools: any[]): any[] {
  if (!tools || tools.length === 0) return [];
  
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters
  }));
}

/**
 * Make a request to Gemini API with OpenAI-compatible input
 */
export async function callGeminiAPI(options: {
  model?: string;
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  max_tokens?: number;
}): Promise<any> {
  const apiKey = getAIApiKey();
  const model = MODEL_MAPPING[options.model || 'google/gemini-2.5-flash'] || 'gemini-2.0-flash-exp';
  
  const contents = convertMessagesToContents(options.messages);
  const functionDeclarations = options.tools ? convertToolsToFunctionDeclarations(options.tools) : undefined;
  
  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 2048,
    }
  };
  
  if (functionDeclarations && functionDeclarations.length > 0) {
    requestBody.tools = [{
      function_declarations: functionDeclarations
    }];
  }
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error('PAYMENT_REQUIRED');
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Convert Gemini response to OpenAI-style format
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('No candidates in response');
  }
  
  const content = candidate.content;
  const parts = content.parts || [];
  
  // Check for function calls
  const functionCall = parts.find((p: any) => p.functionCall);
  if (functionCall) {
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            type: 'function',
            function: {
              name: functionCall.functionCall.name,
              arguments: JSON.stringify(functionCall.functionCall.args)
            }
          }]
        }
      }]
    };
  }
  
  // Regular text response
  const textPart = parts.find((p: any) => p.text);
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: textPart?.text || ''
      }
    }]
  };
}
