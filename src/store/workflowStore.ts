import { create } from 'zustand';
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { TextNodeData, ImageNodeData, LLMNodeData } from '@/types/nodes';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addTextNode: (position: { x: number; y: number }) => void;
  addImageNode: (position: { x: number; y: number }) => void;
  addLLMNode: (position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<TextNodeData | ImageNodeData | LLMNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearWorkflow: () => void;
  // Undo/Redo
  history: Array<{ nodes: Node[]; edges: Edge[] }>;
  currentIndex: number;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  history: [],
  currentIndex: -1,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    // Type-safe connection validation
    const sourceNode = get().nodes.find((n) => n.id === connection.source);
    const targetNode = get().nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) return;
    if (!connection.source || !connection.target) return;

    // Prevent cycles (DAG validation)
    const wouldCreateCycle = (targetId: string, sourceId: string): boolean => {
      const visited = new Set<string>();
      const queue = [sourceId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === targetId) return true;
        if (visited.has(current)) continue;
        visited.add(current);

        const outgoingEdges = get().edges.filter((e) => e.source === current);
        outgoingEdges.forEach((e) => queue.push(e.target));
      }
      return false;
    };

    if (wouldCreateCycle(connection.target, connection.source)) {
      console.warn('Connection would create a cycle');
      return;
    }

    // Type validation for handles
    const targetHandle = connection.targetHandle;

    // Image outputs can only connect to image inputs
    if (sourceNode.type === 'image' && targetHandle !== 'images') {
      console.warn('Image nodes can only connect to image inputs');
      return;
    }

    // Text outputs cannot connect to image inputs
    if (sourceNode.type === 'text' && targetHandle === 'images') {
      console.warn('Text nodes cannot connect to image inputs');
      return;
    }

    if (!targetHandle) return;

    set({
      edges: addEdge({ ...connection, animated: true, style: { stroke: '#8b5cf6' } }, get().edges),
    });
    get().saveToHistory();
  },

  addTextNode: (position) => {
    const newNode: Node<TextNodeData> = {
      id: uuidv4(),
      type: 'text',
      position,
      data: { label: 'Text Node', text: '' },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  addImageNode: (position) => {
    const newNode: Node<ImageNodeData> = {
      id: uuidv4(),
      type: 'image',
      position,
      data: { label: 'Image Node' },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  addLLMNode: (position) => {
    const newNode: Node<LLMNodeData> = {
      id: uuidv4(),
      type: 'llm',
      position,
      data: {
        label: 'LLM Node',
        model: 'gemini-1.5-flash',
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
    get().saveToHistory();
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  clearWorkflow: () => {
    set({ nodes: [], edges: [], history: [], currentIndex: -1 });
  },

  saveToHistory: () => {
    const { nodes, edges, history, currentIndex } = get();
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    set({
      history: newHistory,
      currentIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, currentIndex } = get();
    if (currentIndex > 0) {
      const previousState = history[currentIndex - 1];
      set({
        nodes: previousState!.nodes,
        edges: previousState!.edges,
        currentIndex: currentIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, currentIndex } = get();
    if (currentIndex < history.length - 1) {
      const nextState = history[currentIndex + 1];
      set({
        nodes: nextState!.nodes,
        edges: nextState!.edges,
        currentIndex: currentIndex + 1,
      });
    }
  },
}));