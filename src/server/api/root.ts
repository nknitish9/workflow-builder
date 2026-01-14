import { createTRPCRouter } from '@/server/api/trpc';
import { workflowRouter } from '@/server/api/routers/workflow';
import { llmRouter } from '@/server/api/routers/llm';

export const appRouter = createTRPCRouter({
  workflow: workflowRouter,
  llm: llmRouter,
});

export type AppRouter = typeof appRouter;