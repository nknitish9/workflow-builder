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
import { 
  TextNodeData, 
  ImageNodeData, 
  VideoNodeData, 
  LLMNodeData, 
  CropImageNodeData, 
  ExtractFrameNodeData 
} from '@/types/nodes';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addTextNode: (position: { x: number; y: number }) => void;
  addImageNode: (position: { x: number; y: number }) => void;
  addVideoNode: (position: { x: number; y: number }) => void;
  addLLMNode: (position: { x: number; y: number }) => void;
  addCropImageNode: (position: { x: number; y: number }) => void;
  addExtractFrameNode: (position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearWorkflow: () => void;
  setNodeProcessing: (nodeId: string, isProcessing: boolean) => void;
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
    const sourceNode = get().nodes.find((n) => n.id === connection.source);
    const targetNode = get().nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) return;
    if (!connection.source || !connection.target) return;

    // DAG validation
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
      return;
    }

    // Type validation
    const targetHandle = connection.targetHandle;

    // Image outputs can only connect to image inputs
    if (sourceNode.type === 'image' && targetHandle !== 'images' && targetHandle !== 'image_url') {
      return;
    }

    // Video outputs can only connect to video inputs
    if (sourceNode.type === 'video' && targetHandle !== 'video_url') {
      return;
    }

    // Text outputs cannot connect to image/video inputs
    if (sourceNode.type === 'text' && (targetHandle === 'images' || targetHandle === 'image_url' || targetHandle === 'video_url')) {
      return;
    }

    if (!targetHandle) return;

    set({
      edges: addEdge({ ...connection, animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } }, get().edges),
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

  addVideoNode: (position) => {
    const newNode: Node<VideoNodeData> = {
      id: uuidv4(),
      type: 'video',
      position,
      data: { label: 'Video Node' },
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
        model: 'gemini-2.5-flash',
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  addCropImageNode: (position) => {
    const newNode: Node<CropImageNodeData> = {
      id: uuidv4(),
      type: 'crop',
      position,
      data: {
        label: 'Crop Image',
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  addExtractFrameNode: (position) => {
    const newNode: Node<ExtractFrameNodeData> = {
      id: uuidv4(),
      type: 'extract',
      position,
      data: {
        label: 'Extract Frame',
        timestamp: '0',
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveToHistory();
  },

  updateNodeData: (nodeId, data) => {
    set((state) => {
      let changed = false;

      const nodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          const newData = { ...node.data, ...data };
          if (JSON.stringify(newData) !== JSON.stringify(node.data)) {
            changed = true;
            return { ...node, data: newData };
          }
        }
        return node;
      });

      return changed ? { nodes } : state;
    });
  },

  setNodeProcessing: (nodeId, isProcessing) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, isProcessing } }
          : node
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