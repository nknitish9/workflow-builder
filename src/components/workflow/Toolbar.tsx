'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useWorkflowStore } from '@/store/workflowStore';
import { trpc } from '@/lib/trpc/client';
import { WorkflowsDialog } from './WorkflowsDialog';
import { WorkflowExecutor } from '@/lib/workflowExecutor';
import {
  Save,
  Download,
  Upload,
  Undo,
  Redo,
  Trash2,
  Check,
  Play,
  PlayCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

// Helper function to strip binary data from nodes before saving
function stripBinaryData(nodes: any[]) {
  return nodes.map(node => {
    const cleanNode = { ...node };
    
    // Remove large binary data fields
    if (cleanNode.data) {
      const cleanData = { ...cleanNode.data };
      
      // Remove image/video data URLs (keep metadata)
      if (cleanData.imageData && typeof cleanData.imageData === 'string' && cleanData.imageData.startsWith('data:')) {
        delete cleanData.imageData;
        cleanData.hasImageData = true; // Flag to indicate image was present
      }
      
      if (cleanData.videoData && typeof cleanData.videoData === 'string' && cleanData.videoData.startsWith('data:')) {
        delete cleanData.videoData;
        cleanData.hasVideoData = true; // Flag to indicate video was present
      }

      // Remove result images from crop/extract nodes
      if (cleanData.result && typeof cleanData.result === 'string' && cleanData.result.startsWith('data:')) {
        delete cleanData.result;
        cleanData.hasResult = true; // Flag to indicate result was present
      }
      
      // Remove large image arrays from LLM nodes
      if (cleanData.images && Array.isArray(cleanData.images)) {
        delete cleanData.images;
        cleanData.imageCount = cleanData.images.length;
      }
      
      cleanNode.data = cleanData;
    }
    
    return cleanNode;
  });
}

export function Toolbar() {
  const { nodes, edges, undo, redo, clearWorkflow, history, currentIndex, setNodeProcessing, updateNodeData } = useWorkflowStore();
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [isSaved, setIsSaved] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const saveWorkflow = trpc.workflow.create.useMutation();
  const createRun = trpc.execution.createRun.useMutation();
  const updateRun = trpc.execution.updateRun.useMutation();
  const addNodeExecution = trpc.execution.addNodeExecution.useMutation();

  const handleSave = async () => {
    try {
      // Strip binary data before saving
      const cleanNodes = stripBinaryData(nodes);
      
      console.log('Saving workflow:', {
        name: workflowName,
        nodeCount: cleanNodes.length,
        edgeCount: edges.length,
        originalSize: JSON.stringify({ nodes, edges }).length,
        cleanSize: JSON.stringify({ nodes: cleanNodes, edges }).length,
      });

      await saveWorkflow.mutateAsync({
        name: workflowName,
        nodes: cleanNodes,
        edges,
      });
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      alert('Failed to save workflow');
      console.error('Save error:', error);
    }
  };

  const handleExport = () => {
    // Export with binary data for local use
    const workflow = {
      name: workflowName,
      nodes,
      edges,
      version: '1.0',
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workflow = JSON.parse(event.target?.result as string);
          useWorkflowStore.setState({
            nodes: workflow.nodes,
            edges: workflow.edges,
          });
          setWorkflowName(workflow.name);
        } catch (error) {
          alert('Failed to import workflow');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the workflow?')) {
      clearWorkflow();
    }
  };

  const handleRunWorkflow = async () => {
    if (isExecuting) return;
    
    const selectedNodes = nodes.filter(n => n.selected);
    const nodesToRun = selectedNodes.length > 0 ? selectedNodes : nodes;
    
    if (nodesToRun.length === 0) {
      alert('No nodes to execute');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();
    let runId: string | undefined;

    try {
      // Create workflow run
      const run = await createRun.mutateAsync({
        runType: selectedNodes.length > 0 ? 'partial' : 'full',
        nodeCount: nodesToRun.length,
      });
      runId = run.id;

      // Get edges for selected nodes only
      const nodeIds = new Set(nodesToRun.map(n => n.id));
      const relevantEdges = edges.filter(e => 
        nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      // Create executor
      const executor = new WorkflowExecutor(nodesToRun, relevantEdges);

      // Execute with progress tracking
      const results = await executor.execute((nodeId, status) => {
        setNodeProcessing(nodeId, status === 'running');
        
        if (status === 'success' || status === 'failed') {
          const result = Array.from(results.values()).find(r => r.nodeId === nodeId);
          if (result) {
            // Update node data with result
            const node = nodes.find(n => n.id === nodeId);
            if (node && result.output) {
              updateNodeData(nodeId, { result: result.output });
            }
          }
        }
      });

      // Log all node executions
      for (const [nodeId, result] of results) {
        const node = nodes.find(n => n.id === nodeId);
        await addNodeExecution.mutateAsync({
          runId,
          nodeId,
          nodeType: node?.type || 'unknown',
          status: result.status,
          inputs: node?.data || {},
          outputs: result.output ? { result: String(result.output).substring(0, 500) } : undefined,
          error: result.error,
          duration: result.duration,
        });
      }

      // Update run status
      const duration = Date.now() - startTime;
      const hasFailures = Array.from(results.values()).some(r => r.status === 'failed');
      await updateRun.mutateAsync({
        runId,
        status: hasFailures ? 'partial' : 'success',
        duration,
      });

      alert(`Workflow executed successfully! ${results.size} nodes processed in ${(duration / 1000).toFixed(1)}s`);
    } catch (error) {
      console.error('Workflow execution error:', error);
      
      if (runId) {
        await updateRun.mutateAsync({
          runId,
          status: 'failed',
          duration: Date.now() - startTime,
        });
      }
      
      alert(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
      // Clear processing state from all nodes
      nodes.forEach(node => setNodeProcessing(node.id, false));
    }
  };

  const handleRunSelected = async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    
    if (selectedNodes.length === 0) {
      alert('No nodes selected. Select one or more nodes to run.');
      return;
    }
    
    // Use same logic as handleRunWorkflow
    await handleRunWorkflow();
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-48 h-8 text-sm"
          placeholder="Workflow name"
        />
      </div>

      <div className="flex items-center gap-1">
        {/* Execution Controls */}
        <Button
          variant="default"
          size="sm"
          onClick={handleRunWorkflow}
          disabled={isExecuting}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        >
          <Play className="h-4 w-4 mr-2" />
          {isExecuting ? 'Running...' : 'Run All'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunSelected}
          disabled={isExecuting}
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Run Selected
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={currentIndex <= 0}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={currentIndex >= history.length - 1}
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSave}
          disabled={saveWorkflow.isPending}
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-600" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
        
        <WorkflowsDialog />
        
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImport}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <Button variant="ghost" size="sm" onClick={handleClear}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}