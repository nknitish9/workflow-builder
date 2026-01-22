'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { useWorkflowStore } from '@/store/workflowStore';
import { FolderOpen, Loader2, Trash2, Calendar, FileText } from 'lucide-react';

export function WorkflowsDialog() {
  const [open, setOpen] = useState(false);
  const { data: workflows, isLoading, refetch } = trpc.workflow.list.useQuery(undefined, {
    enabled: open,
  });
  const deleteWorkflow = trpc.workflow.delete.useMutation();
  const { setNodes, setEdges } = useWorkflowStore();

  const handleLoadWorkflow = (workflow: any) => {
    setNodes(workflow.nodes as any);
    setEdges(workflow.edges as any);
    setOpen(false);
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow.mutateAsync({ id });
      refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className='rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800'>
          <FolderOpen className="h-4 w-4 mr-2" />
          Load
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My Workflows</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : workflows && workflows.length > 0 ? (
          <div className="space-y-3">
            {workflows.map((workflow: any) => (
              <Card
                key={workflow.id}
                className="p-4 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1"
                    onClick={() => handleLoadWorkflow(workflow)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-zinc-400" />
                      <h3 className="font-semibold text-zinnc-400">{workflow.name}</h3>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-slate-600 mb-2">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(workflow.updatedAt).toLocaleDateString()}
                      </div>
                      <span>
                        {Array.isArray(workflow.nodes) ? workflow.nodes.length : 0} nodes
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkflow(workflow.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No saved workflows yet</p>
            <p className="text-sm text-slate-400 mt-1">Create a workflow and click Save to get started</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}