/**
 * Centralized AI API Configuration for Lovable AI Gateway
 */

export const LOVABLE_API_KEY_ENV_VAR = 'LOVABLE_API_KEY';
const LOVABLE_AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

/**
 * Get the configured Lovable API key from environment
 */
export function getAIApiKey(): string {
  const apiKey = Deno.env.get(LOVABLE_API_KEY_ENV_VAR);
  if (!apiKey) {
    throw new Error(`${LOVABLE_API_KEY_ENV_VAR} not configured`);
  }
  return apiKey;
}

/**
 * Convert OpenAI-style messages to Gemini contents format
 */
async function convertMessagesToContents(messages: any[]): Promise<any[]> {
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
            // Fetch URL and convert to base64
            try {
              console.log('Fetching image URL:', imageUrl);
              const imageResponse = await fetch(imageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
              }
              const imageBuffer = await imageResponse.arrayBuffer();
              // Convert to base64 safely without blowing the call stack
              const bytes = new Uint8Array(imageBuffer);
              const chunkSize = 0x8000; // 32KB chunks
              let binary = '';
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
              }
              const base64Data = btoa(binary);
              const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
              console.log('Successfully converted image, size:', imageBuffer.byteLength, 'type:', mimeType);
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              });
            } catch (error) {
              console.error('Failed to fetch and convert image URL:', error);
              throw new Error(`Failed to process image URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
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
 * Make a streaming request to Lovable AI Gateway
 */
export async function callGeminiAPIStreaming(options: {
  model?: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
}): Promise<Response> {
  const apiKey = getAIApiKey();
  const model = options.model || 'google/gemini-2.5-flash';
  
  const requestBody: any = {
    model,
    messages: options.messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2048,
  };
  
  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }
  
  console.log('Lovable AI Gateway streaming request:', {
    model,
    messagesLength: options.messages.length,
    hasTools: !!options.tools?.length
  });
  
  const response = await fetch(LOVABLE_AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI Gateway error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 402) {
      throw new Error('PAYMENT_REQUIRED');
    }
    throw new Error(`Lovable AI Gateway error: ${response.status}`);
  }
  
  return response;
}

/**
 * Make a request to Lovable AI Gateway with OpenAI-compatible input
 */
export async function callGeminiAPI(options: {
  model?: string;
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  max_tokens?: number;
  modalities?: string[]; // Support for image generation
}): Promise<any> {
  const apiKey = getAIApiKey();
  const model = options.model || 'google/gemini-2.5-flash';
  
  const requestBody: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2048,
  };
  
  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
    if (options.tool_choice) {
      requestBody.tool_choice = options.tool_choice;
    }
  }
  
  if (options.modalities && options.modalities.length > 0) {
    requestBody.modalities = options.modalities;
  }
  
  console.log('Lovable AI Gateway request:', {
    model,
    messagesLength: options.messages.length,
    hasTools: !!options.tools?.length,
    hasModalities: !!options.modalities
  });
  
  const response = await fetch(LOVABLE_AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI Gateway error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 402) {
      throw new Error('PAYMENT_REQUIRED');
    }
    throw new Error(`Lovable AI Gateway error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // Response is already in OpenAI format
  return data;
}
