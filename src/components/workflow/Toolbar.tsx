'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useWorkflowStore } from '@/store/workflowStore';
import { trpc } from '@/lib/trpc/client';
import { WorkflowsDialog } from './WorkflowsDialog';
import { WorkflowExecutor } from '@/lib/workflowExecutor';
import { UserButton } from '@clerk/nextjs';
import {
  Save,
  Download,
  Upload,
  Undo,
  Redo,
  Trash2,
  Check,
  Play,
} from 'lucide-react';
import { useState } from 'react';

// Helper function to strip binary data from nodes before saving
function stripBinaryData(nodes: any[]) {
  return nodes.map(node => {
    const cleanNode = { ...node };
    
    if (cleanNode.data) {
      const cleanData = { ...cleanNode.data };
      
      if (cleanData.imageData && typeof cleanData.imageData === 'string' && cleanData.imageData.startsWith('data:')) {
        delete cleanData.imageData;
        cleanData.hasImageData = true;
      }
      
      if (cleanData.videoData && typeof cleanData.videoData === 'string' && cleanData.videoData.startsWith('data:')) {
        delete cleanData.videoData;
        cleanData.hasVideoData = true;
      }

      if (cleanData.result && typeof cleanData.result === 'string' && cleanData.result.startsWith('data:')) {
        delete cleanData.result;
        cleanData.hasResult = true;
      }
      
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
      const cleanNodes = stripBinaryData(nodes);

      await saveWorkflow.mutateAsync({
        name: workflowName,
        nodes: cleanNodes,
        edges,
      });
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleExport = () => {
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
          console.error('Import error:', error);
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
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();

    let runId: string | null = null;
    try {
      const run = await createRun.mutateAsync({
        runType: selectedNodes.length > 0 ? 'partial' : 'full',
        nodeCount: nodesToRun.length,
      });
      runId = run.id;
    } catch (dbError) {
      console.warn('Failed to create run record:', dbError);
    }

    try {
      const nodeIds = new Set(nodesToRun.map(n => n.id));
      const relevantEdges = edges.filter(e => 
        nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      const executor = new WorkflowExecutor(nodesToRun, relevantEdges);

      const results = await executor.execute((nodeId, status) => {
        if (status === 'running') {
          setNodeProcessing(nodeId, true);
          updateNodeData(nodeId, { 
            isProcessing: true, 
            isLoading: true,
            error: undefined 
          });
        } else if (status === 'success') {
          const executorResults = (executor as any).results;
          const result = executorResults.get(nodeId);
          
          setTimeout(() => {
            setNodeProcessing(nodeId, false);
            updateNodeData(nodeId, { 
              isProcessing: false, 
              isLoading: false,
              result: result,
              error: undefined 
            });
          }, 300);
        } else if (status === 'failed') {
          setTimeout(() => {
            setNodeProcessing(nodeId, false);
            updateNodeData(nodeId, { 
              isProcessing: false, 
              isLoading: false 
            });
          }, 300);
        }
      });

      results.forEach((result, nodeId) => {
        if (result.status === 'success' && result.output) {
          updateNodeData(nodeId, { 
            result: result.output, 
            error: undefined,
            isProcessing: false,
            isLoading: false 
          });
        } else if (result.status === 'failed' && result.error) {
          updateNodeData(nodeId, { 
            error: result.error, 
            result: undefined,
            isProcessing: false,
            isLoading: false 
          });
        }
      });

      const duration = Date.now() - startTime;
      const successCount = Array.from(results.values()).filter(r => r.status === 'success').length;

      if (runId) {
        try {
          for (const [nodeId, result] of results) {
            const node = nodes.find(n => n.id === nodeId);
            
            let outputForDb;
            if (result.output) {
              if (typeof result.output === 'string' && result.output.startsWith('data:')) {
                outputForDb = { 
                  type: 'media',
                  format: result.output.substring(0, 30),
                  size: result.output.length 
                };
              } else if (typeof result.output === 'string' && result.output.length > 1000) {
                outputForDb = { 
                  result: result.output.substring(0, 1000) + '... (truncated)'
                };
              } else {
                outputForDb = { result: String(result.output).substring(0, 1000) };
              }
            }
            
            try {
              await addNodeExecution.mutateAsync({
                runId: runId,
                nodeId,
                nodeType: node?.type || 'unknown',
                status: result.status,
                inputs: node?.data || {},
                outputs: outputForDb,
                error: result.error,
                duration: result.duration,
              });
            } catch (nodeError) {
              console.error(`✗ Failed to save node ${nodeId}:`, nodeError);
            }
          }

          const hasFailures = Array.from(results.values()).some(r => r.status === 'failed');
          await updateRun.mutateAsync({
            runId: runId,
            status: hasFailures ? (successCount > 0 ? 'partial' : 'failed') : 'success',
            duration,
          });
        } catch (dbError) {
          console.error('Failed to save execution history:', dbError);
        }
      }
    } catch (error) {
      if (runId) {
        try {
          await updateRun.mutateAsync({
            runId: runId,
            status: 'failed',
            duration: Date.now() - startTime,
          });
        } catch (updateError) {
          console.error('Failed to update run status:', updateError);
        }
      }
    } finally {
      setIsExecuting(false);
      nodes.forEach(node => {
        setNodeProcessing(node.id, false);
        updateNodeData(node.id, { isProcessing: false, isLoading: false });
      });
    }
  };

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-48 h-8 text-sm bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          placeholder="Workflow name"
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="default"
          size="sm"
          onClick={handleRunWorkflow}
          disabled={isExecuting}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Play className="h-4 w-4 mr-2" />
          {isExecuting ? 'Running...' : 'Run All'}
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={currentIndex <= 0}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={currentIndex >= history.length - 1}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSave}
          disabled={saveWorkflow.isPending}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-400" />
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
        
        <Button variant="ghost" size="sm" onClick={handleExport} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImport} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <Button variant="ghost" size="sm" onClick={handleClear} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Trash2 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <UserButton 
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8"
            }
          }}
        />
      </div>
    </div>
  );
}