import { z } from 'zod';

export const runLLMSchema = z.object({
  model: z.string(),
  systemPrompt: z.string().optional(),
  userMessage: z.string().min(1),
  images: z.array(z.object({
    mimeType: z.string(),
    data: z.string(),
  })).optional(),
});