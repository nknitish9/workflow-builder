import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { workflowSchema, workflowIdSchema } from '@/lib/validations/workflow';
import { currentUser } from '@clerk/nextjs/server';

export const workflowRouter = createTRPCRouter({
  create: protectedProcedure
    .input(workflowSchema)
    .mutation(async ({ ctx, input }) => {
      // Get user from Clerk
      const clerkUser = await currentUser();
      
      if (!clerkUser) {
        throw new Error('User not authenticated');
      }

      // Ensure user exists in database
      const user = await ctx.db.user.upsert({
        where: { clerkId: ctx.userId },
        update: {},
        create: {
          clerkId: ctx.userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `${ctx.userId}@temp.com`,
        },
      });

      const workflow = await ctx.db.workflow.create({
        data: {
          name: input.name,
          description: input.description,
          nodes: input.nodes,
          edges: input.edges,
          viewport: input.viewport || {},
          userId: user.id,
        },
      });
      return workflow;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      ...workflowSchema.shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          nodes: input.nodes,
          edges: input.edges,
          viewport: input.viewport,
        },
      });
      return workflow;
    }),

  delete: protectedProcedure
    .input(workflowIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.workflow.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  get: protectedProcedure
    .input(workflowIdSchema)
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findUnique({
        where: { id: input.id },
      });
      return workflow;
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      // Get user from Clerk
      const clerkUser = await currentUser();
      
      if (!clerkUser) {
        return [];
      }

      // Ensure user exists
      const user = await ctx.db.user.upsert({
        where: { clerkId: ctx.userId },
        update: {},
        create: {
          clerkId: ctx.userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `${ctx.userId}@temp.com`,
        },
      });

      const workflows = await ctx.db.workflow.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
      return workflows;
    }),
});