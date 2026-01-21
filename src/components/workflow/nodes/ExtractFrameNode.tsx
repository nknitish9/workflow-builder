'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { ExtractFrameNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { Film, Play, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ExtractFrameNode({ id, data }: NodeProps<ExtractFrameNodeData>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const setNodeProcessing = useWorkflowStore((state) => state.setNodeProcessing);
  const { getEdges, getNodes } = useReactFlow();
  
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

      const videoEdge = edges.find((e) => e.target === id && e.targetHandle === 'video_url');
      if (!videoEdge) {
        throw new Error('No video connected. Connect a Video Node to the video_url input.');
      }

      const videoNode = nodes.find((n) => n.id === videoEdge.source);
      const videoData = videoNode?.data?.videoData || videoNode?.data?.videoUrl;

      if (!videoData) {
        throw new Error('Connected video node has no video.');
      }

      const timestampEdge = edges.find((e) => e.target === id && e.targetHandle === 'timestamp');
      let timestamp = data.timestamp || '0';
      
      if (timestampEdge) {
        const timestampNode = nodes.find((n) => n.id === timestampEdge.source);
        timestamp = timestampNode?.data?.text || timestampNode?.data?.result || '0';
      }

      let processableVideoUrl = videoData;

      try {
        if (!videoData.startsWith('data:')) {
          const response = await fetch(videoData, {
            mode: 'cors',
            credentials: 'omit'
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();
          processableVideoUrl = URL.createObjectURL(blob);
        }

        const video = document.createElement('video');
        video.src = processableVideoUrl;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, 60000);

          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve(null);
          };

          video.onerror = (e) => {
            clearTimeout(timeout);
            reject(new Error('Failed to load video metadata'));
          };
        });

        let seekTime = 0;
        if (typeof timestamp === 'string' && timestamp.includes('%')) {
          const percent = parseFloat(timestamp.replace('%', ''));
          seekTime = (percent / 100) * video.duration;
        } else {
          seekTime = parseFloat(timestamp.toString());
        }
        seekTime = Math.max(0, Math.min(seekTime, video.duration - 0.1));

        video.currentTime = seekTime;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Seek timeout'));
          }, 10000);

          video.onseeked = () => {
            clearTimeout(timeout);
            resolve(null);
          };

          video.onerror = (e) => {
            clearTimeout(timeout);
            reject(new Error('Seek failed'));
          };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        updateNodeData(id, { result: frameDataUrl, isLoading: false });
        setNodeProcessing(id, false);

        const duration = Date.now() - startTime;
        await addNodeExecution.mutateAsync({
          runId,
          nodeId: id,
          nodeType: 'extract',
          status: 'success',
          inputs: { timestamp } as any,
          outputs: {
            result: 'Frame extracted successfully',
            size: frameDataUrl.length,
          },
          duration,
        });

        await updateRun.mutateAsync({
          runId,
          status: 'success',
          duration,
        });

        video.remove();
        canvas.remove();
        if (processableVideoUrl !== videoData) {
          URL.revokeObjectURL(processableVideoUrl);
        }

        return;
      } catch (canvasError) {
        throw new Error(`Failed to extract frame from video: ${canvasError instanceof Error ? canvasError.message : 'Unknown error'}. Try with a smaller video file or different format.`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (runId) {
        await addNodeExecution.mutateAsync({
          runId,
          nodeId: id,
          nodeType: 'extract',
          status: 'failed',
          inputs: {},
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
        error: error instanceof Error ? error.message : 'Failed to extract frame',
        isLoading: false,
      });
      setNodeProcessing(id, false);
    }
  };

  const hasConnection = (handle: string) => {
    const edges = useReactFlow().getEdges();
    return edges.some((e) => e.target === id && e.targetHandle === handle);
  };

  return (
    <Card className={`w-80 bg-zinc-900 border border-zinc-800 shadow-lg hover:shadow-xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Film className="h-4 w-4 text-zinc-400" />
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
        <div>
          <Label className="text-xs text-zinc-400">Timestamp (seconds or %)</Label>
          <Input
            type="text"
            value={data.timestamp}
            onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
            disabled={hasConnection('timestamp')}
            placeholder="0 or 50%"
            className="nodrag h-8 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
          <p className="text-xs text-zinc-500 mt-1">e.g., "5" for 5 seconds or "50%" for middle</p>
        </div>

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-full nodrag bg-pink-600 hover:bg-pink-700 text-white"
          size="sm"
        >
          {data.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Extracting...
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
          <div className="border border-zinc-800 rounded-lg p-2 bg-zinc-800/30">
            <img src={data.result} alt="Extracted frame" className="w-full rounded" />
            <p className="text-xs text-zinc-400 mt-1">Frame extracted successfully</p>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="video_url" className="w-3 h-3 bg-orange-500 border-2 border-zinc-900" style={{ top: '35%' }} />
      
      <Handle type="source" position={Position.Right} id="output" className="w-3 h-3 bg-pink-500 border-2 border-zinc-900" />
    </Card>
  );
}

export default memo(ExtractFrameNode);