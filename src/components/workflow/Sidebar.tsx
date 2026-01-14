'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useWorkflowStore } from '@/store/workflowStore';
import { Type, Image, Bot, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addTextNode, addImageNode, addLLMNode } = useWorkflowStore();

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddNode = (nodeType: 'text' | 'image' | 'llm') => {
    const position = { x: 250, y: 100 };
    if (nodeType === 'text') addTextNode(position);
    if (nodeType === 'image') addImageNode(position);
    if (nodeType === 'llm') addLLMNode(position);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white/80 backdrop-blur-lg border-r border-slate-200/60 shadow-sm flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4 hover:bg-slate-100 transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white/80 backdrop-blur-lg border-r border-slate-200/60 shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/60 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Nodes</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="hover:bg-slate-100 transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 bg-slate-50/80 border-slate-200/60 focus:border-blue-300 focus:ring-blue-200 transition-all duration-200"
          />
        </div>
      </div>

      <Separator className="mx-6" />

      {/* Quick Access */}
      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-600 mb-4 uppercase tracking-wide">Quick Access</h3>
        <div className="space-y-3">
          <Card
            className="p-4 cursor-move hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:shadow-md transition-all duration-300 border-slate-200/60 hover:border-blue-200 group"
            draggable
            onDragStart={(e) => handleDragStart(e, 'text')}
            onClick={() => handleAddNode('text')}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Type className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-800 transition-colors">Text Node</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors">Input text content</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-4 cursor-move hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 hover:shadow-md transition-all duration-300 border-slate-200/60 hover:border-green-200 group"
            draggable
            onDragStart={(e) => handleDragStart(e, 'image')}
            onClick={() => handleAddNode('image')}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Image className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 group-hover:text-green-800 transition-colors">Image Node</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors">Upload images</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-4 cursor-move hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 hover:shadow-md transition-all duration-300 border-slate-200/60 hover:border-purple-200 group"
            draggable
            onDragStart={(e) => handleDragStart(e, 'llm')}
            onClick={() => handleAddNode('llm')}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 group-hover:text-purple-800 transition-colors">Run Any LLM</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors">Execute AI models</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}