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
    <Card className="w-72 bg-gradient-to-br from-white to-blue-50/30 border border-blue-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b rounded-t-lg border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/50 flex items-center gap-3 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
          <Type className="h-4 w-4 text-white" />
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
      <div className="p-4 space-y-2">
        <Label htmlFor={`text-${id}`} className="text-xs font-semibold text-slate-700">Text Content</Label>
        <Textarea
          id={`text-${id}`}
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="Enter text..."
          className="min-h-[100px] text-sm nodrag bg-white/80 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
          rows={4}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-4 h-4 bg-gradient-to-r from-blue-400 to-blue-600 border-2 border-white shadow-sm"
      />
    </Card>
  );
}

export default memo(TextNode);