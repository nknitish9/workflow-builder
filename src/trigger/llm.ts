import { task } from '@trigger.dev/sdk/v3';
import { runGemini } from '../lib/gemini';

export const runLLMTask = task({
  id: 'run-llm',
  run: async (payload: {
    model: string;
    systemPrompt?: string;
    userMessage: string;
    images?: Array<{ mimeType: string; data: string }>;
  }) => {
    const result = await runGemini(payload);
    return { result };
  },
});

export default runLLMTask;