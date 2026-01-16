import { Node, Edge } from 'reactflow';
import { trpc } from '@/lib/trpc/client';

export interface ExecutionResult {
  nodeId: string;
  status: 'success' | 'failed';
  output?: any;
  error?: string;
  duration: number;
}

export class WorkflowExecutor {
  private nodes: Node[];
  private edges: Edge[];
  private results: Map<string, any> = new Map();
  private executing: Set<string> = new Set();
  
  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  // Build execution graph - identify dependencies
  private buildDependencyGraph(): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    this.nodes.forEach(node => {
      const deps = this.edges
        .filter(edge => edge.target === node.id)
        .map(edge => edge.source);
      dependencies.set(node.id, deps);
    });
    
    return dependencies;
  }

  // Get nodes that are ready to execute (all dependencies met)
  private getReadyNodes(
    dependencies: Map<string, string[]>,
    completed: Set<string>
  ): Node[] {
    return this.nodes.filter(node => {
      // Skip if already completed or currently executing
      if (completed.has(node.id) || this.executing.has(node.id)) {
        return false;
      }
      
      // Check if all dependencies are completed
      const deps = dependencies.get(node.id) || [];
      return deps.every(dep => completed.has(dep));
    });
  }

  // Execute a single node
  private async executeNode(
    node: Node,
    onProgress?: (nodeId: string, status: 'running' | 'success' | 'failed') => void
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.executing.add(node.id);
    
    if (onProgress) {
      onProgress(node.id, 'running');
    }

    try {
      let output: any;

      switch (node.type) {
        case 'text':
          output = node.data.text || '';
          break;

        case 'image':
          output = node.data.imageData || node.data.imageUrl || '';
          if (!output) throw new Error('No image data available');
          break;

        case 'video':
          output = node.data.videoData || node.data.videoUrl || '';
          if (!output) throw new Error('No video data available');
          break;

        case 'llm':
          output = await this.executeLLMNode(node);
          break;

        case 'crop':
          output = await this.executeCropNode(node);
          break;

        case 'extract':
          output = await this.executeExtractFrameNode(node);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      this.results.set(node.id, output);
      this.executing.delete(node.id);
      
      const duration = Date.now() - startTime;
      
      if (onProgress) {
        onProgress(node.id, 'success');
      }

      return {
        nodeId: node.id,
        status: 'success',
        output,
        duration,
      };
    } catch (error) {
      this.executing.delete(node.id);
      const duration = Date.now() - startTime;
      
      if (onProgress) {
        onProgress(node.id, 'failed');
      }

      return {
        nodeId: node.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  // Execute LLM node
  private async executeLLMNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    let systemPrompt = '';
    let userMessage = '';
    const images: Array<{ mimeType: string; data: string }> = [];

    for (const edge of incomingEdges) {
      const sourceOutput = this.results.get(edge.source);
      
      if (edge.targetHandle === 'system_prompt') {
        systemPrompt = sourceOutput || '';
      } else if (edge.targetHandle === 'user_message') {
        userMessage = sourceOutput || '';
      } else if (edge.targetHandle === 'images') {
        if (sourceOutput && typeof sourceOutput === 'string' && sourceOutput.startsWith('data:image')) {
          const base64Data = sourceOutput.split(',')[1];
          const mimeType = sourceOutput.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          images.push({ mimeType, data: base64Data });
        }
      }
    }

    if (!userMessage) {
      throw new Error('User message is required for LLM node');
    }

    // Call LLM API
    const response = await fetch('/api/trpc/llm.run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          model: node.data.model || 'gemini-2.5-flash',
          systemPrompt: systemPrompt || undefined,
          userMessage,
          images: images.length > 0 ? images : undefined,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'LLM execution failed');
    
    return data.result.json.result;
  }

  // Execute crop node (client-side)
  private async executeCropNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    // Get image input
    const imageEdge = incomingEdges.find(e => e.targetHandle === 'image_url');
    if (!imageEdge) throw new Error('No image connected to crop node');
    
    const imageData = this.results.get(imageEdge.source);
    if (!imageData) throw new Error('No image data available');

    // Get crop parameters
    const getParam = (handle: string, defaultVal: number): number => {
      const edge = incomingEdges.find(e => e.targetHandle === handle);
      if (edge) {
        const value = this.results.get(edge.source);
        return parseFloat(value) || defaultVal;
      }
      return node.data[handle.replace('_', '')] || defaultVal;
    };

    const xPercent = getParam('x_percent', 0);
    const yPercent = getParam('y_percent', 0);
    const widthPercent = getParam('width_percent', 100);
    const heightPercent = getParam('height_percent', 100);

    // Perform crop using canvas
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          const cropX = Math.floor((xPercent / 100) * img.width);
          const cropY = Math.floor((yPercent / 100) * img.height);
          const cropWidth = Math.floor((widthPercent / 100) * img.width);
          const cropHeight = Math.floor((heightPercent / 100) * img.height);

          canvas.width = cropWidth;
          canvas.height = cropHeight;
          ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          
          const result = canvas.toDataURL('image/jpeg', 0.95);
          canvas.remove();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }

  // Execute extract frame node (client-side)
  private async executeExtractFrameNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    // Get video input
    const videoEdge = incomingEdges.find(e => e.targetHandle === 'video_url');
    if (!videoEdge) throw new Error('No video connected to extract frame node');
    
    const videoData = this.results.get(videoEdge.source);
    if (!videoData) throw new Error('No video data available');

    // Get timestamp
    const timestampEdge = incomingEdges.find(e => e.targetHandle === 'timestamp');
    let timestamp = node.data.timestamp || '0';
    if (timestampEdge) {
      timestamp = this.results.get(timestampEdge.source) || '0';
    }

    // Extract frame using video element
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoData;

      video.onloadedmetadata = () => {
        let seekTime = 0;
        if (typeof timestamp === 'string' && timestamp.includes('%')) {
          const percent = parseFloat(timestamp.replace('%', ''));
          seekTime = (percent / 100) * video.duration;
        } else {
          seekTime = parseFloat(timestamp.toString());
        }

        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const result = canvas.toDataURL('image/jpeg', 0.9);
          
          video.remove();
          canvas.remove();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
    });
  }

  // Execute workflow with parallel processing
  async execute(
    onProgress?: (nodeId: string, status: 'running' | 'success' | 'failed') => void
  ): Promise<Map<string, ExecutionResult>> {
    const dependencies = this.buildDependencyGraph();
    const completed = new Set<string>();
    const results = new Map<string, ExecutionResult>();

    while (completed.size < this.nodes.length) {
      // Get all nodes ready to execute
      const readyNodes = this.getReadyNodes(dependencies, completed);
      
      if (readyNodes.length === 0) {
        // No more nodes can execute - check for cycles or failed dependencies
        const remaining = this.nodes.filter(n => !completed.has(n.id));
        if (remaining.length > 0) {
          throw new Error(`Workflow stuck: ${remaining.length} nodes cannot execute. Check for cycles or failed dependencies.`);
        }
        break;
      }

      // Execute all ready nodes in parallel
      const executions = readyNodes.map(node => this.executeNode(node, onProgress));
      const batchResults = await Promise.all(executions);

      // Mark completed and store results
      batchResults.forEach(result => {
        completed.add(result.nodeId);
        results.set(result.nodeId, result);
      });
    }

    return results;
  }
}