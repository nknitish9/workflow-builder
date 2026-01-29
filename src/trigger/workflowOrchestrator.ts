import { task } from "@trigger.dev/sdk/v3";
import { runLLMTask } from "./llm";
import { cropImageTask } from "./crop-image";
import { extractFrameTask } from "./extract-frame";
import type { Node, Edge } from "reactflow";

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

async function executeNode(
  node: Node,
  nodeOutputs: Map<string, any>,
  edges: Edge[],
  db: any,
  runId: string
): Promise<NodeExecutionResult> {
  const startTime = Date.now();
  
  try {
    let output: any;
    
    switch (node.type) {
      case 'text':
        output = node.data.text;
        break;

      case 'image':
        output = node.data.imageData || node.data.imageUrl;
        break;

      case 'video':
        output = node.data.videoUrl || node.data.videoData;
        break;

      case 'crop':
        const cropImageEdge = edges.find(
          e => e.target === node.id && e.targetHandle === 'image_url'
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
          throw cropResult.error || new Error('Crop task failed');
        }

        output = cropResult.output?.croppedImageUrl;
        break;

      case 'extract':
        const videoEdge = edges.find(
          e => e.target === node.id && e.targetHandle === 'video_url'
        );
        if (!videoEdge) {
          throw new Error('No video connected to extract node');
        }

        const videoData = nodeOutputs.get(videoEdge.source);
        if (!videoData) {
          throw new Error('Connected video node has no output');
        }

        const timestampEdge = edges.find(
          e => e.target === node.id && e.targetHandle === 'timestamp'
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
          throw extractResult.error || new Error('Extract frame task failed');
        }

        output = extractResult.output?.frameImageUrl;
        break;

      case 'llm':
        const systemPromptEdge = edges.find(
          e => e.target === node.id && e.targetHandle === 'system_prompt'
        );
        const systemPrompt = systemPromptEdge
          ? nodeOutputs.get(systemPromptEdge.source)
          : '';

        const userMessageEdge = edges.find(
          e => e.target === node.id && e.targetHandle === 'user_message'
        );
        const userMessage = userMessageEdge
          ? nodeOutputs.get(userMessageEdge.source)
          : '';

        if (!userMessage) {
          throw new Error('No user message provided to LLM node');
        }

        const imageEdges = edges.filter(
          e => e.target === node.id && e.targetHandle === 'images'
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
          throw llmResult.error || new Error('LLM task failed');
        }

        output = llmResult.output?.result;
        break;

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }

    const duration = Date.now() - startTime;
    return {
      nodeId: node.id,
      status: 'success',
      output,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      nodeId: node.id,
      status: 'failed',
      error: errorMessage,
      duration,
    };
  }
}

export const workflowOrchestratorTask = task({
  id: 'workflow-orchestrator',
  run: async (payload: WorkflowExecutionPayload, { ctx }) => {
    const { db } = await import("@/server/db");
    const { nodes, edges, runId, targetNodeId } = payload;
    const results = new Map<string, NodeExecutionResult>();
    const nodeOutputs = new Map<string, any>();

    // Cache existing node outputs
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

    const workflowStartTime = Date.now();
    let hasFailures = false;

    // Build dependency graph
    const incomingEdges = new Map<string, string[]>();
    nodes.forEach(node => {
      const deps = edges
        .filter(e => e.target === node.id)
        .map(e => e.source);
      incomingEdges.set(node.id, deps);
    });

    const completed = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Execute nodes dynamically - process ready nodes immediately after dependencies complete
    while (completed.size < nodes.length) {
      // Find all nodes ready to execute (all dependencies completed)
      const readyNodes = nodes.filter(node => {
        if (completed.has(node.id)) return false;
        const deps = incomingEdges.get(node.id) || [];
        return deps.every(depId => completed.has(depId));
      });

      if (readyNodes.length === 0) {
        const remaining = nodes.filter(n => !completed.has(n.id));
        if (remaining.length > 0) {
          throw new Error(`Workflow stuck: ${remaining.length} nodes cannot execute. Check for cycles or failed dependencies.`);
        }
        break;
      }

      // Filter nodes based on target and failed dependencies
      const nodesToExecute = readyNodes.filter(node => {
        // Skip if target node filter applies and cached
        if (targetNodeId && node.id !== targetNodeId && nodeOutputs.has(node.id)) {
          completed.add(node.id);
          results.set(node.id, {
            nodeId: node.id,
            status: 'success',
            output: nodeOutputs.get(node.id),
            duration: 0,
          });
          return false;
        }

        // Check for failed dependencies
        const deps = incomingEdges.get(node.id) || [];
        const hasFailedDep = deps.some(depId => {
          const depResult = results.get(depId);
          return depResult?.status === 'failed' || depResult?.status === 'skipped';
        });

        if (hasFailedDep) {
          completed.add(node.id);
          results.set(node.id, {
            nodeId: node.id,
            status: 'skipped',
            error: 'Skipped due to failed dependency',
            duration: 0,
          });
          hasFailures = true;

          db.nodeExecution.create({
            data: {
              workflowRunId: runId,
              nodeId: node.id,
              nodeType: node.type || 'unknown',
              status: 'failed',
              inputs: node.data,
              error: 'Skipped due to failed dependency',
              duration: 0,
            },
          }).catch(console.error);

          return false;
        }

        return true;
      });

      if (nodesToExecute.length === 0) {
        continue;
      }

      // Create execution records for all nodes before starting
      const executionRecords = await Promise.all(
        nodesToExecute.map(node =>
          db.nodeExecution.create({
            data: {
              workflowRunId: runId,
              nodeId: node.id,
              nodeType: node.type || 'unknown',
              status: 'running',
              inputs: node.data,
              duration: 0,
            },
          })
        )
      );

      // Serialized execution due to platform constraints
      for (let i = 0; i < nodesToExecute.length; i++) {
        const node = nodesToExecute[i]!;
        const executionRecord = executionRecords[i]!;

        try {
          const result = await executeNode(node, nodeOutputs, edges, db, runId);

          if (result.status === 'success') {
            nodeOutputs.set(node.id, result.output);
            completed.add(node.id);
            results.set(node.id, result);

            await db.nodeExecution.update({
              where: { id: executionRecord.id },
              data: {
                status: 'success',
                outputs: result.output && typeof result.output === 'string' && result.output.startsWith('data:')
                  ? { type: 'media', size: result.output.length }
                  : result.output && typeof result.output === 'string' && result.output.length > 1000
                  ? { result: result.output.substring(0, 1000) + '...' }
                  : { result: String(result.output).substring(0, 1000) },
                duration: result.duration,
              },
            });
          } else {
            hasFailures = true;
            completed.add(node.id);
            results.set(node.id, result);

            await db.nodeExecution.update({
              where: { id: executionRecord.id },
              data: {
                status: 'failed',
                error: result.error,
                duration: result.duration,
              },
            });
          }
        } catch (error) {
          hasFailures = true;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const result: NodeExecutionResult = {
            nodeId: node.id,
            status: 'failed',
            error: errorMessage,
            duration: 0,
          };

          completed.add(node.id);
          results.set(node.id, result);

          await db.nodeExecution.update({
            where: { id: executionRecord.id },
            data: {
              status: 'failed',
              error: errorMessage,
              duration: result.duration,
            },
          });
        }
      }
    }

    const totalDuration = Date.now() - workflowStartTime;
    const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;

    const finalStatus = hasFailures 
      ? (successCount > 0 ? 'partial' : 'failed') 
      : 'success';

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