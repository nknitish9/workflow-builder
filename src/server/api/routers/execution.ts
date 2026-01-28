import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { z } from 'zod';
import { currentUser, auth } from '@clerk/nextjs/server';
import { workflowOrchestratorTask } from '@/trigger/workflowOrchestrator';

export const executionRouter = createTRPCRouter({
  executeWorkflow: protectedProcedure
    .input(
      z.object({
        nodes: z.array(z.any()),
        edges: z.array(z.any()),
        runType: z.enum(['full', 'partial', 'single']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        throw new Error('User not authenticated');
      }

      const user = await ctx.db.user.upsert({
        where: { clerkId: clerkUserId },
        update: {},
        create: {
          clerkId: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@temp.com`,
        },
      });

      // Create workflow run
      const run = await ctx.db.workflowRun.create({
        data: {
          userId: user.id,
          status: 'running',
          runType: input.runType,
          nodeCount: input.nodes.length,
        },
      });

      // Trigger the orchestrator task
      try {
        const handle = await workflowOrchestratorTask.trigger({
          nodes: input.nodes,
          edges: input.edges,
          runId: run.id,
        });

        return {
          runId: run.id,
          taskId: handle.id,
        };
      } catch (error) {
        // Update run as failed if trigger fails
        await ctx.db.workflowRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
          },
        });
        throw error;
      }
    }),

  // Single node execution
  executeSingleNode: protectedProcedure
  .input(
    z.object({
      node: z.any(),
      dependencies: z.array(z.any()),
      edges: z.array(z.any()),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    
    if (!clerkUserId || !clerkUser) {
      throw new Error('User not authenticated');
    }

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
        userId: user.id,
        status: 'running',
        runType: 'single',
        nodeCount: 1,
      },
    });

    const allNodes = [...input.dependencies, input.node];

    try {
      const handle = await workflowOrchestratorTask.trigger({
        nodes: allNodes,
        edges: input.edges,
        runId: run.id,
        targetNodeId: input.node.id,
      });

      return {
        runId: run.id,
        taskId: handle.id,
      };
    } catch (error) {
      await ctx.db.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }),

  createRun: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().optional(),
        runType: z.enum(['full', 'partial', 'single']),
        nodeCount: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        throw new Error('User not authenticated');
      }

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
          userId: user.id,
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
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    
    if (!clerkUserId || !clerkUser) {
      return [];
    }

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
        userId: user.id,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
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
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        return null;
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) return null;

      const run = await ctx.db.workflowRun.findUnique({
        where: { 
          id: input.runId,
          userId: user.id,
        },
        include: {
          nodeExecutions: {
            orderBy: { executedAt: 'asc' },
          },
        },
      });
      return run;
    }),

  deleteRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        throw new Error('User not authenticated');
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) throw new Error('User not found');

      const run = await ctx.db.workflowRun.findUnique({
        where: { id: input.runId },
      });

      if (!run || run.userId !== user.id) {
        throw new Error('Run not found or unauthorized');
      }

      await ctx.db.workflowRun.delete({
        where: { id: input.runId },
      });

      return { success: true };
    }),

  clearHistory: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { userId: clerkUserId } = await auth();
      const clerkUser = await currentUser();
      
      if (!clerkUserId || !clerkUser) {
        throw new Error('User not authenticated');
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) throw new Error('User not found');

      const result = await ctx.db.workflowRun.deleteMany({
        where: { userId: user.id },
      });

      return { deletedCount: result.count };
    }),
});