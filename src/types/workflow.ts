import { Node, Edge } from 'reactflow';

export interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: Date;
  updatedAt: Date;
}