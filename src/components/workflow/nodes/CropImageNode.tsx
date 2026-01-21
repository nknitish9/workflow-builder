'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { CropImageNodeData } from '@/types/nodes';
import { trpc } from '@/lib/trpc/client';
import { Crop, Play, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function CropImageNode({ id, data }: NodeProps<CropImageNodeData>) {
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

      const imageEdge = edges.find((e) => e.target === id && e.targetHandle === 'image_url');
      if (!imageEdge) {
        throw new Error('No image connected. Connect an Image Node to the image_url input.');
      }

      const imageNode = nodes.find((n) => n.id === imageEdge.source);
      const imageData = imageNode?.data?.imageData || imageNode?.data?.imageUrl || imageNode?.data?.result;

      if (!imageData) {
        throw new Error('Connected image node has no image.');
      }

      let xPercent = data.xPercent ?? 0;
      let yPercent = data.yPercent ?? 0;
      const widthPercent = data.widthPercent ?? 100;
      const heightPercent = data.heightPercent ?? 100;

      if (data.centerCrop) {
        xPercent = (100 - widthPercent) / 2;
        yPercent = (100 - heightPercent) / 2;
      }

      const img = new Image();
      if (!imageData.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          resolve(null);
        };
        img.onerror = (err) => {
          reject(new Error('Failed to load image'));
        };
        img.src = imageData;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const cropX = Math.floor((xPercent / 100) * img.width);
      const cropY = Math.floor((yPercent / 100) * img.height);
      const cropWidth = Math.floor((widthPercent / 100) * img.width);
      const cropHeight = Math.floor((heightPercent / 100) * img.height);

      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Invalid crop dimensions. Width and height must be greater than 0.');
      }

      if (cropX + cropWidth > img.width || cropY + cropHeight > img.height) {
        throw new Error('Crop area exceeds image boundaries.');
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95);

      updateNodeData(id, { result: croppedImageUrl, isLoading: false });
      setNodeProcessing(id, false);

      const duration = Date.now() - startTime;
      await addNodeExecution.mutateAsync({
        runId,
        nodeId: id,
        nodeType: 'crop',
        status: 'success',
        inputs: {
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
        },
        outputs: {
          result: 'Cropped image generated',
          size: croppedImageUrl.length,
        },
        duration,
      });

      await updateRun.mutateAsync({
        runId,
        status: 'success',
        duration,
      });

      canvas.remove();
    } catch (error) {
      const duration = Date.now() - startTime;

      if (runId) {
        await addNodeExecution.mutateAsync({
          runId,
          nodeId: id,
          nodeType: 'crop',
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
        error: error instanceof Error ? error.message : 'Failed to crop image',
        isLoading: false,
      });
      setNodeProcessing(id, false);
    }
  };

  return (
    <Card className={`w-80 bg-zinc-900 border border-zinc-800 shadow-lg hover:shadow-xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3 relative">
        <div className="flex items-center justify-center">
          <Crop className="h-4 w-4 text-zinc-400" />
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
        <div className="flex items-center space-x-2 mb-3">
          <input
            type="checkbox"
            id={`center-crop-${id}`}
            checked={data.centerCrop ?? false}
            onChange={(e) => updateNodeData(id, { centerCrop: e.target.checked })}
            className="nodrag h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-yellow-500 focus:ring-yellow-500"
          />
          <Label htmlFor={`center-crop-${id}`} className="text-xs font-medium cursor-pointer text-zinc-300">
            Center Crop
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-zinc-400">X %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.xPercent ?? 0}
              onChange={(e) => updateNodeData(id, { xPercent: parseFloat(e.target.value) || 0 })}
              disabled={data.centerCrop}
              className="nodrag h-8 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Y %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.yPercent ?? 0}
              onChange={(e) => updateNodeData(id, { yPercent: parseFloat(e.target.value) || 0 })}
              disabled={data.centerCrop}
              className="nodrag h-8 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Width %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.widthPercent ?? 100}
              onChange={(e) => updateNodeData(id, { widthPercent: parseFloat(e.target.value) || 100 })}
              className="nodrag h-8 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Height %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.heightPercent ?? 100}
              onChange={(e) => updateNodeData(id, { heightPercent: parseFloat(e.target.value) || 100 })}
              className="nodrag h-8 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-full nodrag bg-yellow-600 hover:bg-yellow-700 text-white"
          size="sm"
        >
          {data.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Cropping...
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
            <img src={data.result} alt="Cropped" className="w-full rounded" />
            <p className="text-xs text-zinc-400 mt-1">Crop applied successfully</p>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="image_url" className="w-3 h-3 bg-green-500 border-2 border-zinc-900" style={{ top: '50%' }} />
      
      <Handle type="source" position={Position.Right} id="output" className="w-3 h-3 bg-yellow-500 border-2 border-zinc-900" />
    </Card>
  );
}

export default memo(CropImageNode);