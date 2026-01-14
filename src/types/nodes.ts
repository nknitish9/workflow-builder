export type NodeType = 'text' | 'image' | 'llm';

export interface BaseNodeData {
  label: string;
}

export interface TextNodeData extends BaseNodeData {
  text: string;
}

export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  imageData?: string;
  fileName?: string;
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

export type NodeData = TextNodeData | ImageNodeData | LLMNodeData;