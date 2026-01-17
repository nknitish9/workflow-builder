import { Node, Edge } from 'reactflow';

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

  private getReadyNodes(
    dependencies: Map<string, string[]>,
    completed: Set<string>
  ): Node[] {
    return this.nodes.filter(node => {
      if (completed.has(node.id) || this.executing.has(node.id)) {
        return false;
      }
      
      const deps = dependencies.get(node.id) || [];
      return deps.every(dep => completed.has(dep));
    });
  }

  private async executeNode(
    node: Node,
    onProgress?: (nodeId: string, status: 'running' | 'success' | 'failed') => void
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.executing.add(node.id);
    
    if (onProgress) {
      onProgress(node.id, 'running');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));

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
        setTimeout(() => onProgress(node.id, 'success'), 0);
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
        setTimeout(() => onProgress(node.id, 'failed'), 0);
      }

      return {
        nodeId: node.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  // FIXED: Execute LLM node with proper error handling
  private async executeLLMNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    let systemPrompt = '';
    let userMessage = '';
    const images: Array<{ mimeType: string; data: string }> = [];

    for (const edge of incomingEdges) {
      if (!this.results.has(edge.source)) {
        continue;
      }
      
      const sourceOutput = this.results.get(edge.source);
      
      if (edge.targetHandle === 'system_prompt' || edge.targetHandle === 'systemPrompt') {
        systemPrompt = sourceOutput || '';
      } else if (edge.targetHandle === 'user_message' || edge.targetHandle === 'userMessage' || edge.targetHandle === 'prompt') {
        userMessage = sourceOutput || '';
      } else if (edge.targetHandle === 'images' || edge.targetHandle === 'image') {
        if (sourceOutput && typeof sourceOutput === 'string') {
          if (sourceOutput.startsWith('data:image')) {
            const base64Data = sourceOutput.split(',')[1];
            const mimeType = sourceOutput.match(/data:(.*?);/)?.[1] || 'image/jpeg';
            images.push({ mimeType, data: base64Data });
          }
        }
      }
    }

    if (!userMessage) {
      throw new Error('User message is required for LLM node');
    }

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
    
    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data) || 'LLM execution failed');
    }
    
    // Handle different response formats
    let result;
    if (data.result?.json?.result) {
      result = data.result.json.result;
    } else if (data.result?.data?.json?.result) {
      result = data.result.data.json.result;
    } else if (data.result) {
      result = data.result;
    } else {
      throw new Error('Unexpected LLM response format');
    }
    
    return result;
  }

  private async executeCropNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);

    const imageEdge = incomingEdges.find(e => e.targetHandle === 'image_url' || e.targetHandle === 'image');
    if (!imageEdge) throw new Error('No image connected to crop node');

    // Get image from results OR from source node data (for "Run Selected")
    let imageData = this.results.get(imageEdge.source);

    if (!imageData) {
      // Get from source node's stored data
      const sourceNode = this.nodes.find(n => n.id === imageEdge.source);
      imageData = sourceNode?.data?.imageData ||
                  sourceNode?.data?.imageUrl ||
                  sourceNode?.data?.result;

      if (!imageData) {
        throw new Error(`No image data available from node ${imageEdge.source}`);
      }
    }

    const getParam = (handle: string, defaultVal: number): number => {
      const edge = incomingEdges.find(e => e.targetHandle === handle);
      if (edge) {
        const value = this.results.get(edge.source);
        return parseFloat(value) || defaultVal;
      }
      // Map handle name to data key (remove underscores)
      const dataKey = handle.replace(/_/g, '') as keyof typeof node.data;
      return (node.data[dataKey] as number) || defaultVal;
    };

    let xPercent = getParam('x_percent', node.data.xPercent || 0);
    let yPercent = getParam('y_percent', node.data.yPercent || 0);
    const widthPercent = getParam('width_percent', node.data.widthPercent || 100);
    const heightPercent = getParam('height_percent', node.data.heightPercent || 100);

    // If center crop is enabled, calculate centered position
    if (node.data.centerCrop) {
      xPercent = (100 - widthPercent) / 2;
      yPercent = (100 - heightPercent) / 2;
    }

    // Validate percentages
    if (widthPercent <= 0 || heightPercent <= 0) {
      throw new Error('Width and height must be greater than 0%');
    }

    if (xPercent + widthPercent > 100 || yPercent + heightPercent > 100) {
      throw new Error('Crop area exceeds image boundaries (x+width or y+height > 100%)');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      // Only set crossOrigin for external URLs, not data URLs
      if (!imageData.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: false });
          if (!ctx) throw new Error('Failed to get canvas context');

          const cropX = Math.floor((xPercent / 100) * img.width);
          const cropY = Math.floor((yPercent / 100) * img.height);
          const cropWidth = Math.floor((widthPercent / 100) * img.width);
          const cropHeight = Math.floor((heightPercent / 100) * img.height);

          if (cropWidth <= 0 || cropHeight <= 0) {
            throw new Error(`Invalid crop dimensions: ${cropWidth}x${cropHeight}`);
          }

          if (cropX + cropWidth > img.width || cropY + cropHeight > img.height) {
            throw new Error(`Crop area exceeds image boundaries`);
          }

          canvas.width = cropWidth;
          canvas.height = cropHeight;
          ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

          const result = canvas.toDataURL('image/png');
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

  private async executeExtractFrameNode(node: Node): Promise<string> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    const videoEdge = incomingEdges.find(e => e.targetHandle === 'video_url' || e.targetHandle === 'video');
    if (!videoEdge) throw new Error('No video connected to extract frame node');
    
    // Get video from results OR from source node data (for "Run Selected")
    let videoData = this.results.get(videoEdge.source);
    
    if (!videoData) {
      // Get from source node's stored data
      const sourceNode = this.nodes.find(n => n.id === videoEdge.source);
      videoData = sourceNode?.data?.videoData || sourceNode?.data?.videoUrl || sourceNode?.data?.result;
      
      if (!videoData) {
        throw new Error(`No video data available from node ${videoEdge.source}`);
      }
    }

    const timestampEdge = incomingEdges.find(e => e.targetHandle === 'timestamp');
    let timestamp = node.data.timestamp || '0';
    if (timestampEdge) {
      timestamp = this.results.get(timestampEdge.source) || '0';
    }

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

  async execute(
    onProgress?: (nodeId: string, status: 'running' | 'success' | 'failed') => void
  ): Promise<Map<string, ExecutionResult>> {
    const dependencies = this.buildDependencyGraph();
    const completed = new Set<string>();
    const results = new Map<string, ExecutionResult>();

    while (completed.size < this.nodes.length) {
      const readyNodes = this.getReadyNodes(dependencies, completed);
      
      if (readyNodes.length === 0) {
        const remaining = this.nodes.filter(n => !completed.has(n.id));
        if (remaining.length > 0) {
          throw new Error(`Workflow stuck: ${remaining.length} nodes cannot execute. Check for cycles or failed dependencies.`);
        }
        break;
      }

      const executions = readyNodes.map(node => this.executeNode(node, onProgress));
      const batchResults = await Promise.all(executions);

      batchResults.forEach(result => {
        completed.add(result.nodeId);
        results.set(result.nodeId, result);
      });
    }

    return results;
  }
}