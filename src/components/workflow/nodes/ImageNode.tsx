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

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload JPG, PNG, WEBP, or GIF.');
      return;
    }

    // Validate file size (max 50MB)
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

      // Upload via API route
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
        imageData: result.thumbnailUrl || result.url, // Use thumbnail for preview
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
    <Card className="w-72 bg-gradient-to-br from-white to-green-50/30 border border-green-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b rounded-t-lg border-green-100 bg-gradient-to-r from-green-50 to-green-100/50 flex items-center gap-3 relative">
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
        {!data.imageData && !data.imageUrl ? (
          <div className="border-2 border-dashed border-green-300/60 rounded-xl p-8 text-center bg-gradient-to-br from-green-50/50 to-green-100/30 hover:from-green-100/50 hover:to-green-50/50 transition-all duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="nodrag bg-white/80 hover:bg-white border-green-300 hover:border-green-400 transition-all duration-200 shadow-sm"
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
            <p className="text-xs text-slate-500 mt-3 font-medium">
              JPG, PNG, WEBP, GIF (max 50MB)
            </p>
          </div>
        ) : (
          <div className="relative group/img">
            <img
              src={data.imageData || data.imageUrl}
              alt={data.fileName || 'Uploaded'}
              className="w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
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
            <p className="text-xs text-slate-600 mt-2 truncate font-medium">
              {data.fileName}
            </p>
          </div>
        )}

        {uploadError && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{uploadError}</AlertDescription>
          </Alert>
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