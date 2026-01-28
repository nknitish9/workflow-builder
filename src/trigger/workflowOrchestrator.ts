import { task } from "@trigger.dev/sdk/v3";
import { runLLMTask } from "./llm";
import { cropImageTask } from "./crop-image";
import { extractFrameTask } from "./extract-frame";
import type { Node, Edge } from "reactflow";
const { db } = await import("@/server/db");

interface WorkflowExecutionPayload {
  nodes: Node[];
  edges: Edge[];
  runId: string;
  targetNodeId?: string;
}

interface NodeExecutionResult {
  nodeId: string;
  status: 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  duration: number;
}

export const workflowOrchestratorTask = task({
  id: 'workflow-orchestrator',
  run: async (payload: WorkflowExecutionPayload, { ctx }) => {
    const { nodes, edges, runId, targetNodeId } = payload;
    const results = new Map<string, NodeExecutionResult>();
    const nodeOutputs = new Map<string, any>();

    nodes.forEach(node => {
      if (node.data?.result) {
        nodeOutputs.set(node.id, node.data.result);
      } else if (node.data?.imageUrl || node.data?.imageData) {
        nodeOutputs.set(node.id, node.data.imageUrl || node.data.imageData);
      } else if (node.data?.videoUrl || node.data?.videoData) {
        nodeOutputs.set(node.id, node.data.videoUrl || node.data.videoData);
      } else if (node.data?.text) {
        nodeOutputs.set(node.id, node.data.text);
      }
    });

    // Build dependency graph
    const dependencyGraph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach(node => {
      dependencyGraph.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    edges.forEach(edge => {
      dependencyGraph.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Topological sort for execution order
    const executionOrder: string[] = [];
    const queue: string[] = [];

    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      executionOrder.push(nodeId);

      dependencyGraph.get(nodeId)?.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      });
    }

    const workflowStartTime = Date.now();
    let hasFailures = false;

    // Execute nodes in order
    for (const nodeId of executionOrder) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) {
        continue;
      }

      // If targetNodeId is specified, skip all nodes except target and dependencies without results
      if (targetNodeId && nodeId !== targetNodeId) {
        if (nodeOutputs.has(nodeId)) {
          console.log(`[Orchestrator] Using cached result for ${node.type} node ${nodeId}`);
          results.set(nodeId, {
            nodeId,
            status: 'success',
            output: nodeOutputs.get(nodeId),
            duration: 0,
          });
          continue;
        }
      }

      // Check if any dependency failed
      const dependencies = edges
        .filter(e => e.target === nodeId)
        .map(e => e.source);
      
      const hasFailedDependency = dependencies.some(depId => {
        const depResult = results.get(depId);
        return depResult?.status === 'failed' || depResult?.status === 'skipped';
      });

      if (hasFailedDependency) {
        console.log(`[Orchestrator] Skipping node ${nodeId} due to failed dependency`);
        
        results.set(nodeId, {
          nodeId,
          status: 'skipped',
          error: 'Skipped due to failed dependency',
          duration: 0,
        });

        await db.nodeExecution.create({
          data: {
            workflowRunId: runId,
            nodeId,
            nodeType: node.type || 'unknown',
            status: 'failed',
            inputs: node.data,
            error: 'Skipped due to failed dependency',
            duration: 0,
          },
        });
        
        hasFailures = true;
        continue;
      }

      const startTime = Date.now();
      try {
        let output: any;
        switch (node.type) {
          case 'text':
            output = node.data.text;
            nodeOutputs.set(nodeId, output);
            break;

          case 'image':
            output = node.data.imageData || node.data.imageUrl;
            nodeOutputs.set(nodeId, output);
            break;

          case 'video':
            output = node.data.videoUrl || node.data.videoData;
            nodeOutputs.set(nodeId, output);
            break;

          case 'crop':
            const cropImageEdge = edges.find(
              e => e.target === nodeId && e.targetHandle === 'image_url'
            );
            if (!cropImageEdge) {
              throw new Error('No image connected to crop node');
            }

            const imageData = nodeOutputs.get(cropImageEdge.source);
            if (!imageData) {
              throw new Error('Connected image node has no output');
            }

            const cropResult = await cropImageTask.triggerAndWait({
              imageUrl: imageData,
              xPercent: node.data.xPercent ?? 0,
              yPercent: node.data.yPercent ?? 0,
              widthPercent: node.data.widthPercent ?? 100,
              heightPercent: node.data.heightPercent ?? 100,
            });

            if (!cropResult.ok) {
              throw cropResult.error;
            }

            output = cropResult.output?.croppedImageUrl;
            nodeOutputs.set(nodeId, output);
            break;

          case 'extract':
            const videoEdge = edges.find(
              e => e.target === nodeId && e.targetHandle === 'video_url'
            );
            if (!videoEdge) {
              throw new Error('No video connected to extract node');
            }

            const videoData = nodeOutputs.get(videoEdge.source);
            if (!videoData) {
              throw new Error('Connected video node has no output');
            }

            const timestampEdge = edges.find(
              e => e.target === nodeId && e.targetHandle === 'timestamp'
            );
            let timestamp = node.data.timestamp || '0';
            if (timestampEdge) {
              timestamp = nodeOutputs.get(timestampEdge.source) || '0';
            }

            const extractResult = await extractFrameTask.triggerAndWait({
              videoUrl: videoData,
              timestamp,
            });

            if (!extractResult.ok) {
              throw extractResult.error;
            }

            output = extractResult.output?.frameImageUrl;
            nodeOutputs.set(nodeId, output);
            break;

          case 'llm':
            const systemPromptEdge = edges.find(
              e => e.target === nodeId && e.targetHandle === 'system_prompt'
            );
            const systemPrompt = systemPromptEdge
              ? nodeOutputs.get(systemPromptEdge.source)
              : '';

            const userMessageEdge = edges.find(
              e => e.target === nodeId && e.targetHandle === 'user_message'
            );
            const userMessage = userMessageEdge
              ? nodeOutputs.get(userMessageEdge.source)
              : '';

            if (!userMessage) {
              throw new Error('No user message provided to LLM node');
            }

            const imageEdges = edges.filter(
              e => e.target === nodeId && e.targetHandle === 'images'
            );
            const images = imageEdges
              .map(edge => {
                const imageData = nodeOutputs.get(edge.source);
                if (imageData && imageData.startsWith('data:')) {
                  const base64Data = imageData.split(',')[1];
                  const mimeType = imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg';
                  return { mimeType, data: base64Data };
                }
                return null;
              })
              .filter(Boolean) as Array<{ mimeType: string; data: string }>;

            const llmResult = await runLLMTask.triggerAndWait({
              model: node.data.model || 'gemini-2.5-flash',
              systemPrompt: systemPrompt || undefined,
              userMessage: userMessage,
              images: images.length > 0 ? images : undefined,
            });

            if (!llmResult.ok) {
              throw llmResult.error;
            }

            output = llmResult.output?.result;
            nodeOutputs.set(nodeId, output);
            break;

          default:
            throw new Error(`Unknown node type: ${node.type}`);
        }

        const duration = Date.now() - startTime;
        results.set(nodeId, {
          nodeId,
          status: 'success',
          output,
          duration,
        });

        // Only save to database if this node was actually executed (not cached)
        if (!targetNodeId || nodeId === targetNodeId || duration > 0) {
          await db.nodeExecution.create({
            data: {
              workflowRunId: runId,
              nodeId,
              nodeType: node.type || 'unknown',
              status: 'success',
              inputs: node.data,
              outputs: output && typeof output === 'string' && output.startsWith('data:')
                ? { type: 'media', size: output.length }
                : output && typeof output === 'string' && output.length > 1000
                ? { result: output.substring(0, 1000) + '...' }
                : { result: String(output).substring(0, 1000) },
              duration,
            },
          });
        }

      } catch (error) {
        hasFailures = true;
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Orchestrator] Node ${nodeId} failed:`, errorMessage);
        
        results.set(nodeId, {
          nodeId,
          status: 'failed',
          error: errorMessage,
          duration,
        });

        await db.nodeExecution.create({
          data: {
            workflowRunId: runId,
            nodeId,
            nodeType: node.type || 'unknown',
            status: 'failed',
            inputs: node.data,
            error: errorMessage,
            duration,
          },
        });
      }
    }

    const totalDuration = Date.now() - workflowStartTime;
    const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;

    const finalStatus = hasFailures 
      ? (successCount > 0 ? 'partial' : 'failed') 
      : 'success';

    console.log(`[Orchestrator] Workflow completed with status: ${finalStatus}`);

    await db.workflowRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        duration: totalDuration,
      },
    });

    return {
      runId,
      status: finalStatus,
      results: Array.from(results.values()),
      duration: totalDuration,
    };
  },
});

export default workflowOrchestratorTask;