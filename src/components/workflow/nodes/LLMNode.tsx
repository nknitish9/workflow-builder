'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { LLMNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { GEMINI_MODELS } from '@/lib/gemini';
import { Bot, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import React from 'react';

function LLMNode({ id, data }: NodeProps<LLMNodeData>) {
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

      // ✅ Recursively collect ALL transitive dependencies
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

      // Validate that required dependencies exist
      const userMessageEdge = edges.find((e) => e.target === id && e.targetHandle === 'user_message');
      if (!userMessageEdge) {
        throw new Error('No user message connected. Connect a Text Node to the green handle.');
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
    <Card className={`w-[420px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-5 border-[#3a3a3a] flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Bot className="h-4 w-4 text-zinc-400" />
        </div>
        <span className="font-medium text-base text-white tracking-wide">{data.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity nodrag hover:bg-zinc-800 hover:text-red-400"
          onClick={() => deleteNode(id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="pt-0 px-5 pb-5 space-y-4">
        <div>
          <Label htmlFor={`model-${id}`} className="text-sm font-normal text-zinc-400 mb-2 block">Model</Label>
          <Select
            value={data.model}
            onValueChange={(value) => updateNodeData(id, { model: value })}
          >
            <SelectTrigger id={`model-${id}`} className="nodrag bg-[#1a1a1a] border-[#3a3a3a] text-white h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#2a2a2a] border-[#3a3a3a]">
              {GEMINI_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value} className="text-white hover:bg-[#3a3a3a]">
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.error && (
          <Alert variant="destructive" className="bg-red-950 border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs text-red-400">{data.error}</AlertDescription>
          </Alert>
        )}

        {data.result && (
          <div className="border border-[#3a3a3a] rounded-xl p-4 bg-[#1a1a1a] max-h-64 overflow-y-auto scrollbar-dark">
            <Label className="text-sm text-zinc-400 mb-2 block font-normal">Result:</Label>
            <p className="text-sm text-white whitespace-pre-wrap leading-relaxed font-normal">{data.result}</p>
          </div>
        )}

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-2/5 rounded-[8px] nodrag justify-self-end flex border-[1px] bg-zinc-800 border-zinc-500 hover:bg-zinc-700 text-white shadow-sm hover:shadow-md transition-all duration-200 h-11 font-normal"
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

      <div className="absolute left-0 top-[30%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="system_prompt"
          className="w-4 h-4 bg-blue-500 border-2 border-[#2a2a2a] rounded-full shadow-sm relative"
        />
      </div>
      
      <div className="absolute left-0 top-[50%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="user_message"
          className="w-4 h-4 bg-green-500 border-2 border-[#2a2a2a] rounded-full shadow-sm relative"
        />
      </div>
      
      <div className="absolute left-0 top-[70%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="images"
          className="w-4 h-4 bg-orange-500 border-2 border-[#2a2a2a] rounded-full shadow-sm relative"
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-4 h-4 bg-purple-500 border-2 border-[#2a2a2a] rounded-full shadow-sm"
      />
    </Card>
  );
}

export default memo(LLMNode);