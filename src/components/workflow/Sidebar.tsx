'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useWorkflowStore } from '@/store/workflowStore';
import { 
  Type, 
  Image, 
  Video, 
  Bot, 
  Crop, 
  Film, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    addTextNode, 
    addImageNode, 
    addVideoNode, 
    addLLMNode, 
    addCropImageNode, 
    addExtractFrameNode 
  } = useWorkflowStore();

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddNode = (nodeType: string) => {
    const position = { x: 250, y: 100 };
    switch (nodeType) {
      case 'text':
        addTextNode(position);
        break;
      case 'image':
        addImageNode(position);
        break;
      case 'video':
        addVideoNode(position);
        break;
      case 'llm':
        addLLMNode(position);
        break;
      case 'crop':
        addCropImageNode(position);
        break;
      case 'extract':
        addExtractFrameNode(position);
        break;
    }
  };

  const nodes = [
    {
      type: 'text',
      icon: Type,
      label: 'Text Node',
      description: 'Input text content',
    },
    {
      type: 'image',
      icon: Image,
      label: 'Upload Image',
      description: 'Upload images',
    },
    {
      type: 'video',
      icon: Video,
      label: 'Upload Video',
      description: 'Upload videos',
    },
    {
      type: 'llm',
      icon: Bot,
      label: 'Run Any LLM',
      description: 'Execute AI models',
    },
    {
      type: 'crop',
      icon: Crop,
      label: 'Crop Image',
      description: 'Crop images',
    },
    {
      type: 'extract',
      icon: Film,
      label: 'Extract Frame',
      description: 'Extract video frame',
    },
  ];

  const filteredNodes = nodes.filter((node) =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div className="w-14 bg-zinc-900 border-r border-zinc-800 shadow-sm flex flex-col overflow-hidden">
        <div className="py-4 border-b border-zinc-800 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="h-9 w-9 rounded-[4px] hover:bg-zinc-800 transition-all duration-200 text-zinc-400"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="py-3 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-3">
            {nodes.map((node) => (
              <div
                key={node.type}
                className="relative group cursor-move"
                draggable
                onDragStart={(e) => handleDragStart(e, node.type)}
                onClick={() => handleAddNode(node.type)}
                title={node.label}
              >
                <div className="h-9 w-9 rounded-[4px] flex items-center justify-center shadow-sm hover:shadow-md hover:bg-[#302E33] transition-all duration-300 mx-auto">
                  <node.icon className="h-5 w-5 text-zinc-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 bg-zinc-900 border-r border-zinc-800 shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          Nodes
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="h-9 w-9 rounded-[4px] hover:bg-zinc-800 transition-all duration-200 text-zinc-400"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 rounded-[6px] bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-600 transition-all duration-200"
          />
        </div>
      </div>

      <Separator className="mx-6 bg-zinc-800" />

      {/* Quick Access */}
      <div className="p-4 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wide">
          Quick Access
        </h3>
        <div className="space-y-3">
          {filteredNodes.map((node) => (
            <Card
              key={node.type}
              className="p-3 rounded-[6px] cursor-move hover:bg-zinc-800 hover:shadow-md transition-all duration-300 border-zinc-800 bg-zinc-900 group"
              draggable
              onDragStart={(e) => handleDragStart(e, node.type)}
              onClick={() => handleAddNode(node.type)}
            >
              <div className="flex items-center gap-4">
                <div className="h-9 w-9 rounded-[6px] bg-zinc-800 flex items-center justify-center shadow-sm group-hover:bg-[#302E33] transition-all duration-300">
                  <node.icon className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white transition-colors">
                    {node.label}
                  </p>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    {node.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}