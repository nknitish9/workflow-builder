'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { ExtractFrameNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { Film, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ExtractFrameNode({ id, data }: NodeProps<ExtractFrameNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const { getEdges, getNodes } = useReactFlow();
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  const executeSingleNode = trpc.execution.executeSingleNode.useMutation();
  
  const { data: runStatus } = trpc.execution.getRun.useQuery(
    { runId: pollingRunId || '' },
    { 
      enabled: !!pollingRunId,
      refetchInterval: pollingRunId ? 2000 : false,
    }
  );

  const handleRun = async () => {
    updateNodeData(id, { isLoading: true, error: undefined, result: undefined, isProcessing: true });
    try {
      const edges = getEdges();
      const nodes = getNodes();

      // Recursively collect ALL transitive dependencies
      const collectDependencies = (nodeId: string, visited = new Set<string>()): any[] => {
        if (visited.has(nodeId)) return [];
        visited.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return [];

        const dependencies = [node];

        // Find all incoming edges to this node
        const incomingEdges = edges.filter(e => e.target === nodeId);

        // Recursively collect dependencies for each source node
        incomingEdges.forEach(edge => {
          const deps = collectDependencies(edge.source, visited);
          dependencies.push(...deps);
        });

        return dependencies;
      };

      // Validate video input exists
      const videoEdge = edges.find((e) => e.target === id && e.targetHandle === 'video_url');
      if (!videoEdge) {
        throw new Error('No video connected. Connect a Video Node to the video_url input.');
      }

      // Get all dependencies for current node (excluding itself)
      const allDependencies = collectDependencies(id);
      const dependencies = allDependencies.filter(n => n.id !== id);

      // Get all edges that connect these dependencies
      const dependencyIds = new Set(allDependencies.map(n => n.id));
      const relevantEdges = edges.filter(e => 
        dependencyIds.has(e.source) && dependencyIds.has(e.target)
      );

      const currentNode = nodes.find(n => n.id === id);
      if (!currentNode) {
        throw new Error('Current node not found');
      }

      const result = await executeSingleNode.mutateAsync({
        node: currentNode,
        dependencies,
        edges: relevantEdges,
      });

      setPollingRunId(result.runId);
    } catch (error) {
      updateNodeData(id, {
        error: error instanceof Error ? error.message : 'Failed to run node',
        isLoading: false,
        isProcessing: false,
      });
    }
  };

  React.useEffect(() => {
    if (!runStatus || !pollingRunId) return;

    if (['success', 'failed', 'partial'].includes(runStatus.status)) {
      const execution = runStatus.nodeExecutions?.find((e: any) => e.nodeId === id);
      
      if (execution) {
        if (execution.status === 'success') {
          updateNodeData(id, {
            result: (execution.outputs as any)?.result || 'Success',
            isLoading: false,
            isProcessing: false,
            error: undefined,
          });
        } else {
          updateNodeData(id, {
            error: execution.error || 'Failed',
            isLoading: false,
            isProcessing: false,
          });
        }
      }

      setPollingRunId(null);
    }
  }, [runStatus, pollingRunId, id, updateNodeData]);

  const hasConnection = (handle: string) => {
    const edges = useReactFlow().getEdges();
    return edges.some((e) => e.target === id && e.targetHandle === handle);
  };

  return (
    <Card className={`w-[360px] bg-[#212126] shadow-lg hover:shadow-xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-4 border-zinc-800 flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Film className="h-4 w-4 text-zinc-400" />
        </div>
        <span className="font-semibold text-sm text-white">{data.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity nodrag hover:bg-zinc-800 hover:text-red-400"
          onClick={() => deleteNode(id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="pt-0 px-5 pb-5 space-y-3">
        {data.error && (
          <Alert variant="destructive" className="bg-red-950 border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs text-red-400">{data.error}</AlertDescription>
          </Alert>
        )}

        {data.result && (
          <div className="rounded-lg">
            <img src={data.result} alt="Extracted frame" className="w-full rounded" />
            <p className="text-xs text-zinc-400 m-1">Frame extracted successfully</p>
          </div>
        )}
      <div>
      <Label className="text-xs text-zinc-400">Timestamp (seconds or %)</Label>
      <Input
        type="text"
        value={data.timestamp}
        onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
        disabled={hasConnection('timestamp')}
        placeholder="0 or 50%"
        className="nodrag rounded-[8px] h-8 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
      />
      <p className="text-xs text-zinc-500 mt-1">e.g., "5" for 5 seconds or "50%" for middle</p>
    </div>

    <Button
      onClick={handleRun}
      disabled={data.isLoading}
      className="w-2/5 nodrag justify-self-end flex rounded-[8px] border-[1px] bg-zinc-800 border-zinc-500 hover:bg-zinc-700 text-white"
      size="sm"
    >
      {data.isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Running...
        </>
      ) : (
        <span className="flex items-center gap-4">
          <span>--&gt;</span>
          <span>Run</span>
        </span>
      )}
    </Button>
  </div>

  <Handle type="target" position={Position.Left} id="video_url" className="w-3 h-3 bg-orange-500 border-2 border-zinc-900" style={{ top: '35%' }} />
  
  <Handle type="source" position={Position.Right} id="output" className="w-3 h-3 bg-pink-500 border-2 border-zinc-900" />
</Card>
  );
}

export default memo(ExtractFrameNode);