'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { CropImageNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { Crop, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function CropImageNode({ id, data }: NodeProps<CropImageNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const { getEdges, getNodes } = useReactFlow();
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  const executeSingleNode = trpc.execution.executeSingleNode.useMutation();
  
  // Poll for run status
  const { data: runStatus } = trpc.execution.getRun.useQuery(
    { runId: pollingRunId || '' },
    { 
      enabled: !!pollingRunId,
      refetchInterval: pollingRunId ? 2000 : false,
    }
  );

  // Server-side execution via Trigger.dev
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

      // Validate image input exists
      const imageEdge = edges.find((e) => e.target === id && e.targetHandle === 'image_url');
      if (!imageEdge) {
        throw new Error('No image connected. Connect an Image Node to the image_url input.');
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

  return (
    <Card className={`w-[360px] bg-[#212126] shadow-lg hover:shadow-xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-5 border-zinc-800 flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Crop className="h-4 w-4 text-zinc-400" />
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
            <img src={data.result} alt="Cropped" className="w-full rounded" />
            <p className="text-xs text-zinc-400 m-1">Crop applied successfully</p>
          </div>
        )}

        <div className="flex items-center space-x-2 mb-3">
          <input
            type="checkbox"
            id={`center-crop-${id}`}
            checked={data.centerCrop ?? false}
            onChange={(e) => updateNodeData(id, { centerCrop: e.target.checked })}
            className="rounded-[8px] nodrag h-4 w-4 border-zinc-700 bg-zinc-800 text-yellow-500 focus:ring-yellow-500"
          />
          <Label htmlFor={`center-crop-${id}`} className="text-xs font-medium cursor-pointer text-zinc-300">
            Center Crop
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-zinc-400">X %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.xPercent ?? 0}
              onChange={(e) => updateNodeData(id, { xPercent: parseFloat(e.target.value) || 0 })}
              disabled={data.centerCrop}
              className="nodrag rounded-[8px] h-8 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Y %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.yPercent ?? 0}
              onChange={(e) => updateNodeData(id, { yPercent: parseFloat(e.target.value) || 0 })}
              disabled={data.centerCrop}
              className="nodrag rounded-[8px] h-8 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Width %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.widthPercent ?? 100}
              onChange={(e) => updateNodeData(id, { widthPercent: parseFloat(e.target.value) || 100 })}
              className="nodrag rounded-[8px] h-8 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Height %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.heightPercent ?? 100}
              onChange={(e) => updateNodeData(id, { heightPercent: parseFloat(e.target.value) || 100 })}
              className="nodrag rounded-[8px] h-8 bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-2/5 rounded-[8px] nodrag justify-self-end flex border-[1px] bg-zinc-800 border-zinc-500 hover:bg-zinc-700 text-white"
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

      <Handle type="target" position={Position.Left} id="image_url" className="w-3 h-3 bg-green-500 border-2 border-zinc-900" style={{ top: '50%' }} />
      
      <Handle type="source" position={Position.Right} id="output" className="w-3 h-3 bg-yellow-500 border-2 border-zinc-900" />
    </Card>
  );
}

export default memo(CropImageNode);