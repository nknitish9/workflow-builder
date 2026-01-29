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

    // Execute nodes in waves with TRUE parallel execution
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

      // Parallel execution: Trigger all tasks simultaneously
      const taskPromises = nodesToExecute.map(async (node, i) => {
        const executionRecord = executionRecords[i]!;
        const startTime = Date.now();

        try {
          let taskHandle: any;
          let taskType: 'crop' | 'extract' | 'llm' | 'simple';
          let output: any;

          switch (node.type) {
            case 'text':
              taskType = 'simple';
              output = node.data.text;
              return {
                nodeId: node.id,
                recordId: executionRecord.id,
                output,
                taskType,
                startTime,
                duration: Date.now() - startTime,
              };

            case 'image':
              taskType = 'simple';
              output = node.data.imageData || node.data.imageUrl;
              return {
                nodeId: node.id,
                recordId: executionRecord.id,
                output,
                taskType,
                startTime,
                duration: Date.now() - startTime,
              };

            case 'video':
              taskType = 'simple';
              output = node.data.videoUrl || node.data.videoData;
              return {
                nodeId: node.id,
                recordId: executionRecord.id,
                output,
                taskType,
                startTime,
                duration: Date.now() - startTime,
              };

            case 'crop':
              const cropImageEdge = edges.find(
                e => e.target === node.id && e.targetHandle === 'image_url'
              );
              if (!cropImageEdge) throw new Error('No image connected to crop node');
              const imageData = nodeOutputs.get(cropImageEdge.source);
              if (!imageData) throw new Error('Connected image node has no output');

              taskHandle = await cropImageTask.trigger({
                imageUrl: imageData,
                xPercent: node.data.xPercent ?? 0,
                yPercent: node.data.yPercent ?? 0,
                widthPercent: node.data.widthPercent ?? 100,
                heightPercent: node.data.heightPercent ?? 100,
              });
              taskType = 'crop';
              break;

            case 'extract':
              const videoEdge = edges.find(
                e => e.target === node.id && e.targetHandle === 'video_url'
              );
              if (!videoEdge) throw new Error('No video connected to extract node');
              const videoData = nodeOutputs.get(videoEdge.source);
              if (!videoData) throw new Error('Connected video node has no output');

              const timestampEdge = edges.find(
                e => e.target === node.id && e.targetHandle === 'timestamp'
              );
              let timestamp = node.data.timestamp || '0';
              if (timestampEdge) {
                timestamp = nodeOutputs.get(timestampEdge.source) || '0';
              }

              taskHandle = await extractFrameTask.trigger({
                videoUrl: videoData,
                timestamp,
              });
              taskType = 'extract';
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

              if (!userMessage) throw new Error('No user message provided to LLM node');

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

              // Trigger without waiting
              taskHandle = await runLLMTask.trigger({
                model: node.data.model || 'gemini-2.5-flash',
                systemPrompt: systemPrompt || undefined,
                userMessage: userMessage,
                images: images.length > 0 ? images : undefined,
              });
              taskType = 'llm';
              break;

            default:
              throw new Error(`Unknown node type: ${node.type}`);
          }

          // Return metadata for async tasks
          return {
            nodeId: node.id,
            recordId: executionRecord.id,
            taskHandle,
            taskType,
            startTime,
          };

        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          return {
            nodeId: node.id,
            recordId: executionRecord.id,
            error: errorMessage,
            taskType: 'simple' as const,
            startTime,
            duration,
          };
        }
      });

      const triggeredTasks = await Promise.all(taskPromises);

      const completedTasks = await Promise.all(
        triggeredTasks.map(async (task) => {
          // If it's a simple task or already errored, return immediately
          if (task.taskType === 'simple' || task.error || task.duration !== undefined) {
            return task;
          }

          // Import runs module for polling
          const { runs } = await import("@trigger.dev/sdk/v3");

          // Poll for async task completion
          let attempts = 0;
          const maxAttempts = 180; // 3 minutes max

          while (attempts < maxAttempts) {
            try {
              // Use runs.retrieve to check status
              const run = await runs.retrieve(task.taskHandle.id);
              
              if (run.status === 'COMPLETED') {
                return {
                  ...task,
                  output: run.output,
                  duration: Date.now() - task.startTime,
                };
              } else if (run.status === 'FAILED' || run.status === 'CRASHED' || run.status === 'SYSTEM_FAILURE') {
                return {
                  ...task,
                  error: run.error?.message || 'Task failed',
                  duration: Date.now() - task.startTime,
                };
              } else if (run.status === 'CANCELED') {
                return {
                  ...task,
                  error: `Task ${run.status.toLowerCase()}`,
                  duration: Date.now() - task.startTime,
                };
              }

              // Still running, wait before next poll
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            } catch (error) {
              return {
                ...task,
                error: error instanceof Error ? error.message : 'Polling failed',
                duration: Date.now() - task.startTime,
              };
            }
          }

          // Timeout
          return {
            ...task,
            error: 'Task timeout (3 minutes)',
            duration: Date.now() - task.startTime,
          };
        })
      );

      // ✅ Update database and store outputs for all completed tasks
      for (const task of completedTasks) {
        if (task.error) {
          hasFailures = true;
          completed.add(task.nodeId);
          results.set(task.nodeId, {
            nodeId: task.nodeId,
            status: 'failed',
            error: task.error,
            duration: task.duration || 0,
          });

          await db.nodeExecution.update({
            where: { id: task.recordId },
            data: {
              status: 'failed',
              error: task.error,
              duration: task.duration || 0,
            },
          });
        } else {
          // Extract output based on task type
          let output = task.output;
          if (task.taskType === 'crop') {
            output = task.output?.croppedImageUrl;
          } else if (task.taskType === 'extract') {
            output = task.output?.frameImageUrl;
          } else if (task.taskType === 'llm') {
            output = task.output?.result;
          }

          nodeOutputs.set(task.nodeId, output);
          completed.add(task.nodeId);
          results.set(task.nodeId, {
            nodeId: task.nodeId,
            status: 'success',
            output,
            duration: task.duration || 0,
          });

          await db.nodeExecution.update({
            where: { id: task.recordId },
            data: {
              status: 'success',
              outputs: output && typeof output === 'string' && output.startsWith('data:')
                ? { type: 'media', size: output.length }
                : output && typeof output === 'string' && output.length > 1000
                ? { result: output.substring(0, 1000) + '...' }
                : { result: String(output).substring(0, 1000) },
              duration: task.duration || 0,
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