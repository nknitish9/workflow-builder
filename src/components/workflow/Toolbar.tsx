'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useWorkflowStore } from '@/store/workflowStore';
import { trpc } from '@/lib/trpc/client';
import { WorkflowsDialog } from './WorkflowsDialog';
import {
  Save,
  Download,
  Upload,
  Undo,
  Redo,
  Trash2,
  Check,
} from 'lucide-react';
import { useState } from 'react';

export function Toolbar() {
  const { nodes, edges, undo, redo, clearWorkflow, history, currentIndex } = useWorkflowStore();
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [isSaved, setIsSaved] = useState(false);
  
  const saveWorkflow = trpc.workflow.create.useMutation();

  const handleSave = async () => {
    try {
      await saveWorkflow.mutateAsync({
        name: workflowName,
        nodes,
        edges,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      alert('Failed to save workflow');
      console.error(error);
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