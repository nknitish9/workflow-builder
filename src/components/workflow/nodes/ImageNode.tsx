'use client';

import { memo, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkflowStore } from '@/store/workflowStore';
import { ImageNodeData } from '@/types/nodes';
import { Image as ImageIcon, Upload, X, Trash2 } from 'lucide-react';

function ImageNode({ id, data }: NodeProps<ImageNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateNodeData(id, {
        imageData: base64,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    updateNodeData(id, { imageData: undefined, fileName: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-72 bg-gradient-to-br from-white to-green-50/30 border border-green-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-green-100/50 flex items-center gap-3 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center shadow-sm">
          <ImageIcon className="h-4 w-4 text-white" />
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
        {!data.imageData ? (
          <div className="border-2 border-dashed border-green-300/60 rounded-xl p-8 text-center bg-gradient-to-br from-green-50/50 to-green-100/30 hover:from-green-100/50 hover:to-green-50/50 transition-all duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="nodrag bg-white/80 hover:bg-white border-green-300 hover:border-green-400 transition-all duration-200 shadow-sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-slate-500 mt-3 font-medium">JPG, PNG, GIF</p>
          </div>
        ) : (
          <div className="relative group/img">
            <img
              src={data.imageData}
              alt={data.fileName || 'Uploaded'}
              className="w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 nodrag opacity-0 group-hover/img:opacity-100 transition-all duration-200 shadow-lg hover:scale-110"
              onClick={handleClearImage}
            >
              <X className="h-4 w-4" />
            </Button>
            <p className="text-xs text-slate-600 mt-2 truncate font-medium">{data.fileName}</p>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-600 border-2 border-white shadow-sm"
      />
    </Card>
  );
}

export default memo(ImageNode);