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
  const { getEdges, getNodes } = useReactFlow();
  const runLLM = trpc.llm.run.useMutation();

  const handleRun = async () => {
    try {
      updateNodeData(id, { isLoading: true, error: undefined, result: undefined });

      const edges = getEdges();
      const nodes = getNodes();

      // Find system prompt
      const systemPromptEdges = edges.filter(
        (e) => e.target === id && (e.targetHandle === 'system_prompt' || !e.targetHandle)
      );
      const systemPromptNode = systemPromptEdges.length > 0
        ? nodes.find((n) => n.id === systemPromptEdges[0].source)
        : null;
      const systemPrompt = systemPromptNode?.data?.text || '';

      // Find user message
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

      // Find images
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

      const result = await runLLM.mutateAsync({
        model: data.model,
        systemPrompt: systemPrompt || undefined,
        userMessage,
        images: images.length > 0 ? images : undefined,
      });

      updateNodeData(id, { result: result.result, isLoading: false });
    } catch (error) {
      console.error('LLM execution error:', error);
      updateNodeData(id, {
        error: error instanceof Error ? error.message : 'Failed to run LLM',
        isLoading: false,
      });
    }
  };

  return (
    <Card className="w-80 bg-gradient-to-br from-white to-purple-50/30 border border-purple-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-purple-100/50 flex items-center gap-3 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-sm text-slate-800">{data.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity nodrag hover:bg-red-100 hover:text-red-600"
          onClick={() => deleteNode(id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <Label htmlFor={`model-${id}`} className="text-xs font-semibold text-slate-700">Model</Label>
          <Select
            value={data.model}
            onValueChange={(value) => updateNodeData(id, { model: value })}
          >
            <SelectTrigger id={`model-${id}`} className="nodrag mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GEMINI_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-full nodrag bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-sm hover:shadow-md transition-all duration-200"
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
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{data.error}</AlertDescription>
          </Alert>
        )}

        {data.result && (
          <div className="border border-purple-200 rounded-lg p-3 bg-gradient-to-br from-purple-50/50 to-white max-h-48 overflow-y-auto shadow-inner">
            <Label className="text-xs text-purple-700 mb-1 block font-semibold">Result:</Label>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{data.result}</p>
          </div>
        )}
      </div>

      {/* Input handles with labels */}
      <div className="absolute left-0 top-[30%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="system_prompt"
          className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-600 border-2 border-white shadow-sm relative"
        />
      </div>
      
      <div className="absolute left-0 top-[50%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="user_message"
          className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-600 border-2 border-white shadow-sm relative"
        />
      </div>
      
      <div className="absolute left-0 top-[70%] -translate-x-1/2 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          id="images"
          className="w-3 h-3 bg-gradient-to-r from-orange-400 to-orange-600 border-2 border-white shadow-sm relative"
        />
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-gradient-to-r from-purple-400 to-purple-600 border-2 border-white shadow-sm"
      />
    </Card>
  );
}

export default memo(LLMNode);