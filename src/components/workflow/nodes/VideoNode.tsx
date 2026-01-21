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

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload MP4, MOV, WEBM, or M4V.');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create FormData for API request
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');

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

      // For remote videos, download and create blob URL for local playback
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
    <Card className="w-72 bg-gradient-to-br from-white to-orange-50/30 border border-orange-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="p-4 border-b rounded-t-lg border-orange-100 bg-gradient-to-r from-orange-50 to-orange-100/50 flex items-center gap-3 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
          <Video className="h-4 w-4 text-white" />
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
        {!data.videoData && !data.videoUrl ? (
          <div className="border-2 border-dashed border-orange-300/60 rounded-xl p-8 text-center bg-gradient-to-br from-orange-50/50 to-orange-100/30 hover:from-orange-100/50 hover:to-orange-50/50 transition-all duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="nodrag bg-white/80 hover:bg-white border-orange-300 hover:border-orange-400 transition-all duration-200 shadow-sm"
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
            <p className="text-xs text-slate-500 mt-3 font-medium">
              MP4, MOV, WEBM, M4V (max 50MB)
            </p>
          </div>
        ) : (
          <div className="relative group/video">
            <video
              src={data.videoData || data.videoUrl}
              controls
              className="w-full h-40 rounded-lg border border-orange-200 shadow-sm"
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
        className="w-4 h-4 bg-gradient-to-r from-orange-400 to-orange-600 border-2 border-white shadow-sm"
      />
    </Card>
  );
}

export default memo(VideoNode);