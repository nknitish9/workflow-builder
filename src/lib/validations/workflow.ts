import { z } from 'zod';

export const workflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
});

export const workflowIdSchema = z.object({
  id: z.string(),
});