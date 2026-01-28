'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useWorkflowStore } from '@/store/workflowStore';
import { trpc } from '@/lib/trpc/client';
import { WorkflowsDialog } from './WorkflowsDialog';
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
import { useState, useEffect, useRef } from 'react';

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
  const { nodes, edges, undo, redo, clearWorkflow, history, currentIndex, updateNodeData } = useWorkflowStore();
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [isSaved, setIsSaved] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);
  const processedExecutionsRef = useRef<Set<string>>(new Set());
  const isProcessingWorkflowRef = useRef(false);
  
  const saveWorkflow = trpc.workflow.create.useMutation();
  const executeWorkflow = trpc.execution.executeWorkflow.useMutation();

  // Use tRPC query with proper polling
  const { data: runStatus } = trpc.execution.getRun.useQuery(
    { runId: pollingRunId || '' },
    { 
      enabled: !!pollingRunId,
      refetchInterval: pollingRunId ? 2000 : false,
    }
  );

  useEffect(() => {
    if (!runStatus || !pollingRunId) return;
    
    // Prevent re-entrant calls
    if (isProcessingWorkflowRef.current) return;
    isProcessingWorkflowRef.current = true;

    // Update nodes with results
    if (runStatus.nodeExecutions && runStatus.nodeExecutions.length > 0) {
      runStatus.nodeExecutions.forEach((execution: any) => {
        // Create unique key for deduplication
        const executionKey = `${execution.nodeId}-${execution.executedAt}`;
        
        if (processedExecutionsRef.current.has(executionKey)) {
          return; // Skip already processed
        }
        
        processedExecutionsRef.current.add(executionKey);
        
        const node = nodes.find(n => n.id === execution.nodeId);
        if (node) {
          if (execution.status === 'success') {
            let result = (execution.outputs as any)?.result;
            if ((execution.outputs as any)?.type === 'media') {
              result = 'Media output (check History for details)';
            }
            
            updateNodeData(execution.nodeId, {
              result: result || 'Success',
              isProcessing: false,
              isLoading: false,
              error: undefined,
            });
          } else if (execution.status === 'failed') {
            updateNodeData(execution.nodeId, {
              error: execution.error || 'Failed',
              isProcessing: false,
              isLoading: false,
            });
          }
        }
      });
    }

    // Check if workflow is complete
    if (['success', 'failed', 'partial'].includes(runStatus.status)) {
      nodes.forEach(node => {
        updateNodeData(node.id, {
          isProcessing: false,
          isLoading: false,
        });
      });
      
      setPollingRunId(null);
      setIsExecuting(false);
      processedExecutionsRef.current.clear();
    }
    
    isProcessingWorkflowRef.current = false;
  }, [runStatus, pollingRunId, nodes, updateNodeData]);

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
      alert('No nodes to run');
      return;
    }

    setIsExecuting(true);
    
    // Clear the tracking refs when starting new execution
    processedExecutionsRef.current.clear();
    isProcessingWorkflowRef.current = false;

    // Set all nodes to processing state in one batch
    nodesToRun.forEach(node => {
      updateNodeData(node.id, { 
        isProcessing: true, 
        isLoading: true,
        error: undefined,
        result: undefined,
      });
    });

    try {
      // Filter edges to only include those between nodes we're running
      const nodeIds = new Set(nodesToRun.map(n => n.id));
      const relevantEdges = edges.filter(e => 
        nodeIds.has(e.source) && nodeIds.has(e.target)
      );
      
      // Trigger server-side execution
      const result = await executeWorkflow.mutateAsync({
        nodes: nodesToRun,
        edges: relevantEdges,
        runType: selectedNodes.length > 0 ? 'partial' : 'full',
      });

      // Start polling by setting the run ID
      setPollingRunId(result.runId);

      // Set timeout for polling (3 minutes)
      setTimeout(() => {
        if (pollingRunId === result.runId) {
          setPollingRunId(null);
          setIsExecuting(false);
          processedExecutionsRef.current.clear();
          nodesToRun.forEach(node => {
            updateNodeData(node.id, { 
              isProcessing: false, 
              isLoading: false,
              error: 'Execution timeout (3 min)'
            });
          });
          alert('Workflow execution timed out after 3 minutes');
        }
      }, 3 * 60 * 1000);
      
    } catch (error) {
      nodesToRun.forEach(node => {
        updateNodeData(node.id, { 
          isProcessing: false, 
          isLoading: false,
          error: error instanceof Error ? error.message : 'Execution failed'
        });
      });
      
      setIsExecuting(false);
      setPollingRunId(null);
      processedExecutionsRef.current.clear();
      alert(`Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-48 h-8 rounded-[8px] text-sm bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          placeholder="Workflow name"
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="default"
          size="sm"
          onClick={handleRunWorkflow}
          disabled={isExecuting}
          className="rounded-[8px] bg-purple-600 hover:bg-purple-700 text-white"
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
          className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={currentIndex >= history.length - 1}
          className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSave}
          disabled={saveWorkflow.isPending}
          className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800"
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

        <Button variant="ghost" size="sm" onClick={handleExport} className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImport} className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2 bg-zinc-800" />

        <Button variant="ghost" size="sm" onClick={handleClear} className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800">
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