import { createTRPCRouter, publicProcedure } from '@/server/api/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const nodeRouter = createTRPCRouter({
  cropImage: publicProcedure
    .input(
      z.object({
        imageUrl: z.string(),
        xPercent: z.number().min(0).max(100),
        yPercent: z.number().min(0).max(100),
        widthPercent: z.number().min(0).max(100),
        heightPercent: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // TODO: Trigger Trigger.dev task
        // For now, simulate processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // In production, this would call the Trigger.dev crop task
        // const result = await trigger.runTask('crop-image', input);
        
        return { croppedImageUrl: input.imageUrl }; // Placeholder
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to crop image',
        });
      }
    }),

  extractFrame: publicProcedure
    .input(
      z.object({
        videoUrl: z.string(),
        timestamp: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // TODO: Trigger Trigger.dev task
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // In production, this would call the Trigger.dev extract-frame task
        // const result = await trigger.runTask('extract-frame', input);
        
        return { frameImageUrl: input.videoUrl }; // Placeholder
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to extract frame',
        });
      }
    }),
});