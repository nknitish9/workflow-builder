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

  // History tracking
  const createRun = trpc.execution.createRun.useMutation();
  const updateRun = trpc.execution.updateRun.useMutation();
  const addNodeExecution = trpc.execution.addNodeExecution.useMutation();

  const handleRun = async () => {
    updateNodeData(id, { isLoading: true, error: undefined, result: undefined });
    setNodeProcessing(id, true);
  
    // Force UI update before heavy processing
    await new Promise(resolve => setTimeout(resolve, 100));

    const startTime = Date.now();
    let runId: string | undefined;

    try {
      // Create run entry
      const run = await createRun.mutateAsync({
        runType: 'single',
        nodeCount: 1,
      });
      runId = run.id;

      console.log('Starting crop operation...');

      const edges = getEdges();
      const nodes = getNodes();

      console.log('Looking for connected image...');
      // Find connected image
      const imageEdge = edges.find((e) => e.target === id && e.targetHandle === 'image_url');
      if (!imageEdge) {
        throw new Error('No image connected. Connect an Image Node to the image_url input.');
      }

      const imageNode = nodes.find((n) => n.id === imageEdge.source);
      const imageData = imageNode?.data?.imageData || imageNode?.data?.imageUrl;

      console.log('Image node found:', imageNode?.type, 'Has data:', !!imageData);

      if (!imageData) {
        throw new Error('Connected image node has no image.');
      }

      // Get crop parameters (from connected nodes or manual input)
      const getParamValue = (handle: string, defaultValue: number) => {
        const edge = edges.find((e) => e.target === id && e.targetHandle === handle);
        if (edge) {
          const node = nodes.find((n) => n.id === edge.source);
          return parseFloat(node?.data?.text || node?.data?.result || defaultValue);
        }
        return data[handle as keyof CropImageNodeData] as number || defaultValue;
      };

      const xPercent = getParamValue('x_percent', 0);
      const yPercent = getParamValue('y_percent', 0);
      const widthPercent = getParamValue('width_percent', 100);
      const heightPercent = getParamValue('height_percent', 100);

      console.log('Crop params:', { xPercent, yPercent, widthPercent, heightPercent });

      // CLIENT-SIDE CROP USING CANVAS (avoids sending large data to server)
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      console.log('Loading image...');
      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log('Image loaded:', img.width, 'x', img.height);
          resolve(null);
        };
        img.onerror = (err) => {
          console.error('Image load error:', err);
          reject(new Error('Failed to load image'));
        };
        img.src = imageData;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Calculate crop dimensions
      const cropX = Math.floor((xPercent / 100) * img.width);
      const cropY = Math.floor((yPercent / 100) * img.height);
      const cropWidth = Math.floor((widthPercent / 100) * img.width);
      const cropHeight = Math.floor((heightPercent / 100) * img.height);

      console.log('Calculated crop:', { cropX, cropY, cropWidth, cropHeight });

      // Validate crop dimensions
      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Invalid crop dimensions. Width and height must be greater than 0.');
      }

      if (cropX + cropWidth > img.width || cropY + cropHeight > img.height) {
        throw new Error('Crop area exceeds image boundaries.');
      }

      // Set canvas size to crop dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      console.log('Drawing cropped image...');
      // Draw cropped portion
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight, // Source rectangle
        0, 0, cropWidth, cropHeight // Destination rectangle
      );

      // Convert to data URL
      const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95);
      console.log('Crop complete! Size:', croppedImageUrl.length, 'bytes');

      updateNodeData(id, { result: croppedImageUrl, isLoading: false });
      setNodeProcessing(id, false);

      // Log successful execution
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

      // Cleanup
      canvas.remove();
    } catch (error) {
      console.error('Crop error:', error);
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

  // Check if inputs are connected
  const hasConnection = (handle: string) => {
    const edges = useReactFlow().getEdges();
    return edges.some((e) => e.target === id && e.targetHandle === handle);
  };

  return (
    <Card className={`w-80 bg-gradient-to-br from-white to-yellow-50/30 border border-yellow-200/60 shadow-lg hover:shadow-xl transition-all duration-300 group ${data.isLoading || data.isProcessing ? 'processing' : ''}`}>
      <div className="p-4 border-b rounded-t-lg border-yellow-100 bg-gradient-to-r from-yellow-50 to-yellow-100/50 flex items-center gap-3 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center justify-center shadow-sm">
          <Crop className="h-4 w-4 text-white" />
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">X %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.xPercent}
              onChange={(e) => updateNodeData(id, { xPercent: parseFloat(e.target.value) || 0 })}
              disabled={hasConnection('x_percent')}
              className="nodrag h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Y %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.yPercent}
              onChange={(e) => updateNodeData(id, { yPercent: parseFloat(e.target.value) || 0 })}
              disabled={hasConnection('y_percent')}
              className="nodrag h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Width %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.widthPercent}
              onChange={(e) => updateNodeData(id, { widthPercent: parseFloat(e.target.value) || 100 })}
              disabled={hasConnection('width_percent')}
              className="nodrag h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Height %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.heightPercent}
              onChange={(e) => updateNodeData(id, { heightPercent: parseFloat(e.target.value) || 100 })}
              disabled={hasConnection('height_percent')}
              className="nodrag h-8"
            />
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={data.isLoading}
          className="w-full nodrag bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{data.error}</AlertDescription>
          </Alert>
        )}

        {data.result && (
          <div className="border rounded-lg p-2">
            <img src={data.result} alt="Cropped" className="w-full rounded" />
            <p className="text-xs text-slate-500 mt-1">Crop applied successfully</p>
          </div>
        )}
      </div>

      {/* Input handles */}
      <Handle type="target" position={Position.Left} id="image_url" className="w-3 h-3 bg-green-500 border-2 border-white" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Left} id="x_percent" className="w-3 h-3 bg-blue-500 border-2 border-white" style={{ top: '40%' }} />
      <Handle type="target" position={Position.Left} id="y_percent" className="w-3 h-3 bg-blue-500 border-2 border-white" style={{ top: '55%' }} />
      <Handle type="target" position={Position.Left} id="width_percent" className="w-3 h-3 bg-blue-500 border-2 border-white" style={{ top: '70%' }} />
      <Handle type="target" position={Position.Left} id="height_percent" className="w-3 h-3 bg-blue-500 border-2 border-white" style={{ top: '85%' }} />
      
      {/* Output handle */}
      <Handle type="source" position={Position.Right} id="output" className="w-3 h-3 bg-yellow-500 border-2 border-white" />
    </Card>
  );
}

export default memo(CropImageNode);