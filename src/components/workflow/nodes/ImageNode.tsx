'use client';

import { memo, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkflowStore } from '@/store/workflowStore';
import { ImageNodeData } from '@/types/nodes';
import { Image as ImageIcon, Upload, X, Trash2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ImageNode({ id, data }: NodeProps<ImageNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload JPG, PNG, WEBP, or GIF.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      updateNodeData(id, {
        imageUrl: result.url,
        imageData: result.thumbnailUrl || result.url,
        fileName: result.fileName,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearImage = () => {
    updateNodeData(id, {
      imageData: undefined,
      imageUrl: undefined,
      fileName: undefined,
    });
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-[420px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group">
      <div className="p-5 border-b border-[#3a3a3a] flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-zinc-400" />
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

      <div className="p-5 space-y-3">
        {!data.imageData && !data.imageUrl ? (
          <div className="border-2 border-dashed border-[#3a3a3a] rounded-xl p-12 text-center bg-[#1a1a1a] hover:border-[#4a4a4a] transition-all duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="nodrag bg-[#2a2a2a] hover:bg-[#3a3a3a] border-[#3a3a3a] hover:border-[#4a4a4a] text-white transition-all duration-200 shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <p className="text-xs text-zinc-500 mt-3 font-normal">
              JPG, PNG, WEBP, GIF (max 50MB)
            </p>
          </div>
        ) : (
          <div className="relative group/img">
            <img
              src={data.imageData || data.imageUrl}
              alt={data.fileName || 'Uploaded'}
              className="w-full h-48 object-cover rounded-xl border border-[#3a3a3a] shadow-sm"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 nodrag opacity-0 group-hover/img:opacity-100 transition-all duration-200 shadow-lg hover:scale-110"
              onClick={handleClearImage}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
            <p className="text-xs text-zinc-400 mt-2 truncate font-normal">
              {data.fileName}
            </p>
          </div>
        )}

        {uploadError && (
          <Alert variant="destructive" className="bg-red-950 border-red-900">
            <AlertDescription className="text-xs text-red-400">{uploadError}</AlertDescription>
          </Alert>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-4 h-4 bg-green-500 border-2 border-[#2a2a2a] rounded-full"
      />
    </Card>
  );
}

export default memo(ImageNode);