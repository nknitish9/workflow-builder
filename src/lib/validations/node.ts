import { z } from 'zod';

// Crop Image Node validation
export const cropImageSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(0).max(100),
  heightPercent: z.number().min(0).max(100),
});

// Extract Frame Node validation
export const extractFrameSchema = z.object({
  videoUrl: z.string().url('Invalid video URL'),
  timestamp: z.union([
    z.number().min(0),
    z.string().regex(/^\d+%?$/, 'Timestamp must be a number or percentage (e.g., "50%")')
  ]),
});

// Text Node validation
export const textNodeSchema = z.object({
  text: z.string().min(1, 'Text content is required'),
});

// Image Node validation
export const imageNodeSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageData: z.string().optional(),
  fileName: z.string().optional(),
});

// Video Node validation
export const videoNodeSchema = z.object({
  videoUrl: z.string().url().optional(),
  videoData: z.string().optional(),
  fileName: z.string().optional(),
});

// Generic node execution input
export const nodeExecutionSchema = z.object({
  nodeId: z.string(),
  nodeType: z.enum(['text', 'image', 'video', 'llm', 'crop', 'extract']),
  inputs: z.record(z.any()),
});

export type CropImageInput = z.infer<typeof cropImageSchema>;
export type ExtractFrameInput = z.infer<typeof extractFrameSchema>;
export type TextNodeInput = z.infer<typeof textNodeSchema>;
export type ImageNodeInput = z.infer<typeof imageNodeSchema>;
export type VideoNodeInput = z.infer<typeof videoNodeSchema>;
export type NodeExecutionInput = z.infer<typeof nodeExecutionSchema>;