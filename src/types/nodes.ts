export type NodeType = 'text' | 'image' | 'video' | 'llm' | 'crop' | 'extract';

export interface BaseNodeData {
  label: string;
  isProcessing?: boolean;
}

export interface TextNodeData extends BaseNodeData {
  text: string;
}

export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  imageData?: string;
  fileName?: string;
  thumbnailUrl?: string;
}

export interface VideoNodeData extends BaseNodeData {
  videoUrl?: string;
  videoData?: string;
  fileName?: string;
  thumbnailUrl?: string;
}

export interface LLMNodeData extends BaseNodeData {
  model: string;
  systemPrompt?: string;
  userMessage?: string;
  images?: Array<{ mimeType: string; data: string }>;
  result?: string;
  isLoading?: boolean;
  error?: string;
}

export interface CropImageNodeData extends BaseNodeData {
  imageUrl?: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  centerCrop?: boolean;
  result?: string;
  isLoading?: boolean;
  error?: string;
}

export interface ExtractFrameNodeData extends BaseNodeData {
  videoUrl?: string;
  timestamp: string;
  result?: string;
  isLoading?: boolean;
  error?: string;
}

export type NodeData =
  | TextNodeData
  | ImageNodeData
  | VideoNodeData
  | LLMNodeData
  | CropImageNodeData
  | ExtractFrameNodeData;