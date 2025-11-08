/**
 * Centralized AI API Configuration for Direct Gemini API
 */

export const GEMINI_API_KEY_ENV_VAR = 'GEMINI_API_KEY';

// Model mapping from Lovable AI Gateway format to direct Gemini models
const MODEL_MAPPING: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.0-flash',
  'google/gemini-2.5-flash': 'gemini-2.0-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.0-flash',
  'google/gemini-2.5-flash-image': 'gemini-2.5-flash-image-preview',
  'google/gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image-preview',
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
 * Make a streaming request to Gemini API
 */
export async function callGeminiAPIStreaming(options: {
  model?: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
}): Promise<Response> {
  const apiKey = getAIApiKey();
  const model = MODEL_MAPPING[options.model || 'google/gemini-2.5-flash'] || 'gemini-2.0-flash';
  
  const contents = await convertMessagesToContents(options.messages);
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
    
    // Note: Streaming doesn't support tool_choice enforcement in the same way
    // as non-streaming, but we include the tools for context
  }
  
  console.log('Gemini API streaming request:', {
    model,
    contentsLength: contents.length,
    hasFunctions: !!functionDeclarations?.length
  });
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  
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
  
  return response;
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
  modalities?: string[]; // Support for image generation
}): Promise<any> {
  const apiKey = getAIApiKey();
  const model = MODEL_MAPPING[options.model || 'google/gemini-2.5-flash'] || 'gemini-2.0-flash';
  
  const contents = await convertMessagesToContents(options.messages);
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
    
    // Handle tool_choice to force function calling
    if (options.tool_choice) {
      // Gemini uses toolConfig.functionCallingConfig.mode
      requestBody.toolConfig = {
        functionCallingConfig: {
          mode: 'ANY' // Force the model to use one of the provided functions
        }
      };
    }
  }
  
  // For image generation models, specify output modality
  if (options.modalities && options.modalities.includes('image')) {
    requestBody.generationConfig.responseModalities = ['image', 'text'];
  }
  
  console.log('Gemini API request:', {
    model,
    contentsLength: contents.length,
    hasFunctions: !!functionDeclarations?.length,
    hasModalities: !!options.modalities
  });
  
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
  
  // Check for inline_data / inlineData (generated images)
  const imagePart = parts.find((p: any) => p.inline_data || p.inlineData);
  if (imagePart) {
    const imageData = imagePart.inline_data || imagePart.inlineData;
    const mimeType = imageData.mime_type || imageData.mimeType || 'image/png';
    const dataB64 = imageData.data;
    const base64Image = `data:${mimeType};base64,${dataB64}`;
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: parts.find((p: any) => p.text)?.text || 'Image generated',
          images: [{
            type: 'image_url',
            image_url: {
              url: base64Image
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
