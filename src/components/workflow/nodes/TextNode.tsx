'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkflowStore } from '@/store/workflowStore';
import { TextNodeData } from '@/types/nodes';
import { Type, Trash2 } from 'lucide-react';

function TextNode({ id, data }: NodeProps<TextNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);

  return (
    <Card className="w-[420px] bg-[#212126] border rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group">
      <div className="p-5 border-[#3a3a3a] flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Type className="h-4 w-4 text-zinc-400" />
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
      <div className="pt-0 px-5 pb-5 space-y-2">
        <Textarea
          id={`text-${id}`}
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="Enter text..."
          className="min-h-[150px] text-base nodrag bg-[#353539] border-[rgba(255,255,255,0.04)] text-white placeholder:text-zinc-600 focus:border-[#4a4a4a] focus:ring-0 rounded-xl leading-relaxed font-normal resize-none"
          rows={8}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-4 h-4 bg-purple-500 border-2 border-[#2a2a2a] rounded-full"
      />
    </Card>
  );
}

export default memo(TextNode);