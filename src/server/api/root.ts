import { createTRPCRouter } from '@/server/api/trpc';
import { workflowRouter } from '@/server/api/routers/workflow';
import { llmRouter } from '@/server/api/routers/llm';
import { nodeRouter } from '@/server/api/routers/node';
import { executionRouter } from '@/server/api/routers/execution';

export const appRouter = createTRPCRouter({
  workflow: workflowRouter,
  llm: llmRouter,
  node: nodeRouter,
  execution: executionRouter,
});

export type AppRouter = typeof appRouter;