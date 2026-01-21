'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { LLMNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { GEMINI_MODELS } from '@/lib/gemini';
import { Bot, Play, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LLMNode({ id, data }: NodeProps<LLMNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const setNodeProcessing = useWorkflowStore((state) => state.setNodeProcessing);
  const { getEdges, getNodes } = useReactFlow();
  const runLLM = trpc.llm.run.useMutation();
  
  const createRun = trpc.execution.createRun.useMutation();
  const updateRun = trpc.execution.updateRun.useMutation();
  const addNodeExecution = trpc.execution.addNodeExecution.useMutation();

  const handleRun = async () => {
    updateNodeData(id, { isLoading: true, error: undefined, result: undefined });
    setNodeProcessing(id, true);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    const startTime = Date.now();
    let runId: string | undefined;

    try {
      const run = await createRun.mutateAsync({
        runType: 'single',
        nodeCount: 1,
      });
      runId = run.id;

      const edges = getEdges();
      const nodes = getNodes();

      const systemPromptEdges = edges.filter(
        (e) => e.target === id && (e.targetHandle === 'system_prompt' || !e.targetHandle)
      );
      const systemPromptNode = systemPromptEdges.length > 0
        ? nodes.find((n) => n.id === systemPromptEdges[0].source)
        : null;
      const systemPrompt = systemPromptNode?.data?.text || '';

      const userMessageEdges = edges.filter(
        (e) => e.target === id && (e.targetHandle === 'user_message' || e.targetHandle === null)
      );
      let userMessageNode = null;
      if (userMessageEdges.length > 0) {
        userMessageNode = nodes.find((n) => n.id === userMessageEdges[0].source);
      } else {
        const anyTextEdge = edges.find(
          (e) => e.target === id && nodes.find(n => n.id === e.source && n.type === 'text')
        );
        if (anyTextEdge) {
          userMessageNode = nodes.find((n) => n.id === anyTextEdge.source);
        }
      }
      const userMessage = userMessageNode?.data?.text || userMessageNode?.data?.result || '';

      if (!userMessage || userMessage.trim() === '') {
        throw new Error('User message is required. Connect a Text Node to the green handle.');
      }

      const imageEdges = edges.filter(
        (e) => e.target === id && (e.targetHandle === 'images' || (e.targetHandle === null && nodes.find(n => n.id === e.source && n.type === 'image')))
      );
      const images = imageEdges
        .map((edge) => {
          const imageNode = nodes.find((n) => n.id === edge.source);
          if (imageNode?.data?.imageData) {
            const base64Data = imageNode.data.imageData.split(',')[1];
            const mimeType = imageNode.data.imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg';
            return { mimeType, data: base64Data };
          }
          return null;
        })
        .filter(Boolean) as Array<{ mimeType: string; data: string }>;

      await addNodeExecution.mutateAsync({
        runId,
        nodeId: id,
        nodeType: 'llm',
        status: 'running',
        inputs: {
          model: data.model,
          systemPrompt,
          userMessage,
          imageCount: images.length,
        },
      });

      const result = await runLLM.mutateAsync({
        model: data.model,
        systemPrompt: systemPrompt || undefined,
        userMessage,
        images: images.length > 0 ? images : undefined,
      });

      const duration = Date.now() - startTime;

      await addNodeExecution.mutateAsync({
        runId,
        nodeId: id,
        nodeType: 'llm',
        status: 'success',
        inputs: {
          model: data.model,
          systemPrompt,
          userMessage: userMessage.substring(0, 100) + '...',
        },
        outputs: { result: result.result.substring(0, 200) + '...' },
        duration,
      });

      await updateRun.mutateAsync({
        runId,
        status: 'success',
        duration,
      });

      updateNodeData(id, { result: result.result, isLoading: false });
      setNodeProcessing(id, false);
    } catch (error) {
      const duration = Date.now() - startTime;

      if (runId) {
        await addNodeExecution.mutateAsync({
          runId,
          nodeId: id,
          nodeType: 'llm',
          status: 'failed',
          inputs: { model: data.model },
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        });

        await updateRun.mutateAsync({
          runId,
          status: 'failed',
          duration,
        });
      }

      updateNodeData(id, {
        error: error instanceof Error ? error.message : 'Failed to run LLM',
        isLoading: false,
      });
      setNodeProcessing(id, false);
    }
  };

  return (
    <Card className={`w-[420px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-5 border-b border-[#3a3a3a] flex items-center gap-3 relative">
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
      
      <div className="p-5 space-y-4">
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

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-full nodrag bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md transition-all duration-200 h-11 rounded-xl font-normal"
          size="sm"
        >
          {data.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run
            </>
          )}
        </Button>

        {data.error && (
          <Alert variant="destructive" className="bg-red-950 border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs text-red-400">{data.error}</AlertDescription>
          </Alert>
        )}

        {data.result && (
          <div className="border border-[#3a3a3a] rounded-xl p-4 bg-[#1a1a1a] max-h-64 overflow-y-auto">
            <Label className="text-sm text-zinc-400 mb-2 block font-normal">Result:</Label>
            <p className="text-sm text-white whitespace-pre-wrap leading-relaxed font-normal">{data.result}</p>
          </div>
        )}
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