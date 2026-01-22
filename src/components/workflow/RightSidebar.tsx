'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  History,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function RightSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  const { data: runs, isLoading, refetch } = trpc.execution.listRuns.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const deleteRun = trpc.execution.deleteRun.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const clearHistory = trpc.execution.clearHistory.useMutation({
    onSuccess: () => {
      setShowClearDialog(false);
      refetch();
    },
  });

  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this run from history?')) {
      try {
        await deleteRun.mutateAsync({ runId });
      } catch (error) {
        console.error('Failed to delete run:', error);
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'partial':
        return 'warning';
      default:
        return 'running';
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-zinc-900 border-l border-zinc-800 shadow-sm flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4 rounded-[8px] hover:bg-zinc-800 transition-all duration-200 text-zinc-400"
          title="Show History"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center justify-center">
          <History className="h-5 w-5 text-zinc-600 rotate-90" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-96 bg-zinc-900 border-l border-zinc-800 shadow-sm flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            <h2 className="text-xl font-bold text-white">
              History
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded-[8px] text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {runs && runs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="rounded-[8px] text-red-400 hover:text-red-300 hover:bg-zinc-800"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(true)}
              className="rounded-[8px] hover:bg-zinc-800 transition-all duration-200 text-zinc-400"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
            </div>
          ) : runs && runs.length > 0 ? (
            runs.map((run: any) => (
              <Card
                key={run.id}
                className="p-4 rounded-[8px] hover:bg-zinc-800 transition-colors cursor-pointer border-2 border-zinc-800 bg-zinc-900 group"
                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(run.status)}
                    <span className="font-semibold text-sm text-white">
                      Run #{run.id.slice(-6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700 hover:text-red-400"
                      onClick={(e) => handleDeleteRun(run.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {expandedRun === run.id ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(run.startedAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getStatusBadge(run.status) as any}>
                    {run.status}
                  </Badge>
                  <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                    {run.runType === 'full' ? 'Full Workflow' : 
                     run.runType === 'partial' ? `${run.nodeCount} Selected` : 
                     'Single Node'}
                  </Badge>
                  <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">{run.nodeCount} nodes</Badge>
                  {run.duration && (
                    <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">{formatDuration(run.duration)}</Badge>
                  )}
                </div>

                {/* Expanded Node Details */}
                {expandedRun === run.id && run.nodeExecutions && run.nodeExecutions.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
                    <h4 className="text-xs font-semibold text-zinc-400 mb-2">
                      Node Executions:
                    </h4>
                    {run.nodeExecutions.map((exec: any, idx: number) => (
                      <div 
                        key={exec.id} 
                        className="text-xs bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-zinc-500">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-white">
                              {exec.nodeType.charAt(0).toUpperCase() + exec.nodeType.slice(1)} Node
                            </span>
                          </div>
                          <Badge
                            variant={getStatusBadge(exec.status) as any}
                            className="text-xs"
                          >
                            {exec.status}
                          </Badge>
                        </div>

                        {/* Body */}
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">Node ID:</span>
                            <span className="font-mono text-zinc-300">
                              {exec.nodeId.slice(-8)}
                            </span>
                          </div>
                          
                          {exec.duration && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">Duration:</span>
                              <Badge variant="outline" className="text-xs bg-zinc-900 text-zinc-300 border-zinc-700">
                                {formatDuration(exec.duration)}
                              </Badge>
                            </div>
                          )}

                          {exec.outputs && typeof exec.outputs === 'object' && Object.keys(exec.outputs).length > 0 && (
                            <div className="space-y-1">
                              <span className="text-zinc-400 text-xs font-semibold">
                                Output:
                              </span>
                              <div className="bg-zinc-900 p-2 rounded border border-zinc-700 max-h-24 overflow-y-auto">
                                <pre className="whitespace-pre-wrap text-xs text-zinc-300 font-mono">
                                  {JSON.stringify(exec.outputs, null, 2).substring(0, 300)}
                                  {JSON.stringify(exec.outputs).length > 300 && '...'}
                                </pre>
                              </div>
                            </div>
                          )}

                          {exec.error && (
                            <div className="space-y-1">
                              <span className="text-red-400 text-xs font-semibold">
                                Error:
                              </span>
                              <div className="bg-red-950 p-2 rounded border border-red-900 text-red-400 text-xs">
                                {exec.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {expandedRun === run.id && (!run.nodeExecutions || run.nodeExecutions.length === 0) && (
                  <div className="mt-4 text-xs text-zinc-500 text-center py-2 border-t border-zinc-800">
                    No node execution details available
                  </div>
                )}
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400">No execution history</p>
              <p className="text-sm text-zinc-600 mt-1">
                Run a workflow to see history
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Clear History Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Clear All History?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete all workflow execution history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearHistory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear History'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}