import { createTRPCRouter, publicProcedure } from '@/server/api/trpc';
import { runLLMSchema } from '@/lib/validations/llm';
import { runGemini } from '@/lib/gemini';
import { TRPCError } from '@trpc/server';

export const llmRouter = createTRPCRouter({
  run: publicProcedure
    .input(runLLMSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await runGemini({
          model: input.model,
          systemPrompt: input.systemPrompt,
          userMessage: input.userMessage,
          images: input.images,
        });

        return { result };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to run LLM',
        });
      }
    }),
});