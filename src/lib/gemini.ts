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

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: parts as any }],
  });

  debugger;
  const response = result.response;
  return response.text();
}

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
] as const;
