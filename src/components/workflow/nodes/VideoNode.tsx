'use client';

import { memo, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkflowStore } from '@/store/workflowStore';
import { VideoNodeData } from '@/types/nodes';
import { Video, Upload, X, Trash2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function VideoNode({ id, data }: NodeProps<VideoNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload MP4, MOV, WEBM, or M4V.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      let videoBlobUrl = result.url;
      try {
        const videoResponse = await fetch(result.url);
        if (videoResponse.ok) {
          const videoBlob = await videoResponse.blob();
          videoBlobUrl = URL.createObjectURL(videoBlob);
        }
      } catch (blobError) {
        console.warn('Failed to create blob URL, using remote URL:', blobError);
      }

      updateNodeData(id, {
        videoUrl: result.url,
        videoData: videoBlobUrl,
        thumbnailUrl: result.thumbnailUrl,
        fileName: result.fileName,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearVideo = () => {
    updateNodeData(id, {
      videoData: undefined,
      videoUrl: undefined,
      thumbnailUrl: undefined,
      fileName: undefined,
    });
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-72 bg-zinc-900 border border-zinc-800 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Video className="h-4 w-4 text-zinc-400" />
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

      <div className="p-4 space-y-3">
        {!data.videoData && !data.videoUrl ? (
          <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center bg-zinc-800/30 hover:border-zinc-700 transition-all duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="nodrag bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600 text-white transition-all duration-200 shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <p className="text-xs text-zinc-500 mt-3 font-medium">
              MP4, MOV, WEBM, M4V (max 50MB)
            </p>
          </div>
        ) : (
          <div className="relative group/video">
            <video
              src={data.videoData || data.videoUrl}
              controls
              className="w-full h-40 rounded-lg border border-zinc-800 shadow-sm bg-black"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 nodrag opacity-0 group-hover/video:opacity-100 transition-all duration-200 shadow-lg hover:scale-110"
              onClick={handleClearVideo}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
            <p className="text-xs text-zinc-400 mt-2 truncate font-medium">
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
        className="w-4 h-4 bg-orange-500 border-2 border-zinc-900 shadow-sm"
      />
    </Card>
  );
}

export default memo(VideoNode);