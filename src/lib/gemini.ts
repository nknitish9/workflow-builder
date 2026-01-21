import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!);

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

export async function runGemini(params: {
  model: string;
  systemPrompt?: string;
  userMessage: string;
  images?: Array<{ mimeType: string; data: string }>;
}) {
  const { model, systemPrompt, userMessage, images = [] } = params;

  const geminiModel = genAI.getGenerativeModel({
    model,
    ...(systemPrompt && { systemInstruction: systemPrompt }),
  });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: userMessage }
  ];

  images.forEach(img => {
    parts.push({ inlineData: img });
  });

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: parts as any }],
      });

      const response = result.response;
      return response.text();
    } catch (error: any) {
      lastError = error;

      // Check if it's a 503 overload error
      const isOverloadError = error?.message?.includes('503') || error?.message?.includes('overloaded') || error?.message?.includes('Service Unavailable');

      if (isOverloadError && attempt < maxRetries) {
        // Exponential backoff: wait 2^attempt seconds
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      break;
    }
  }

  throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
] as const;
