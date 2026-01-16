import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { z } from 'zod';
import { currentUser, auth } from '@clerk/nextjs/server';

export const executionRouter = createTRPCRouter({
  createRun: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().optional(),
        runType: z.enum(['full', 'partial', 'single']),
        nodeCount: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user from Clerk
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        throw new Error('User not authenticated');
      }

      // Ensure user exists in database
      const user = await ctx.db.user.upsert({
        where: { clerkId: clerkUserId },
        update: {},
        create: {
          clerkId: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@temp.com`,
        },
      });

      const run = await ctx.db.workflowRun.create({
        data: {
          workflowId: input.workflowId,
          userId: user.id, // Use database user ID, not Clerk ID
          status: 'running',
          runType: input.runType,
          nodeCount: input.nodeCount,
        },
      });
      return run;
    }),

  updateRun: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
        status: z.enum(['success', 'failed', 'partial']),
        duration: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.workflowRun.update({
        where: { id: input.runId },
        data: {
          status: input.status,
          completedAt: new Date(),
          duration: input.duration,
        },
      });
      return run;
    }),

  addNodeExecution: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
        nodeId: z.string(),
        nodeType: z.string(),
        status: z.enum(['success', 'failed', 'running']),
        inputs: z.any(),
        outputs: z.any().optional(),
        error: z.string().optional(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const execution = await ctx.db.nodeExecution.create({
        data: {
          workflowRunId: input.runId,
          nodeId: input.nodeId,
          nodeType: input.nodeType,
          status: input.status,
          inputs: input.inputs,
          outputs: input.outputs || null,
          error: input.error,
          duration: input.duration,
        },
      });
      return execution;
    }),

  listRuns: protectedProcedure.query(async ({ ctx }) => {
    // Get user from Clerk
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    
    if (!clerkUserId || !clerkUser) {
      return [];
    }

    // Ensure user exists
    const user = await ctx.db.user.upsert({
      where: { clerkId: clerkUserId },
      update: {},
      create: {
        clerkId: clerkUserId,
        email: clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@temp.com`,
      },
    });

    const runs = await ctx.db.workflowRun.findMany({
      where: {
        userId: user.id, // Use database user ID
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        nodeExecutions: {
          orderBy: { executedAt: 'asc' },
        },
      },
    });
    return runs;
  }),

  getRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get user from Clerk
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        return null;
      }

      // Get database user
      const user = await ctx.db.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) return null;

      const run = await ctx.db.workflowRun.findUnique({
        where: { 
          id: input.runId,
          userId: user.id, // Security: only get user's own runs
        },
        include: {
          nodeExecutions: {
            orderBy: { executedAt: 'asc' },
          },
        },
      });
      return run;
    }),
});