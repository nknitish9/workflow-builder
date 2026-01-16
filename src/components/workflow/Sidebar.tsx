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
  const [isCollapsed, setIsCollapsed] = useState(false);
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
      gradient: 'from-blue-400 to-blue-600',
      hoverGradient: 'hover:from-blue-50 hover:to-blue-100',
      borderColor: 'hover:border-blue-200',
      textColor: 'group-hover:text-blue-800',
    },
    {
      type: 'image',
      icon: Image,
      label: 'Upload Image',
      description: 'Upload images',
      gradient: 'from-green-400 to-green-600',
      hoverGradient: 'hover:from-green-50 hover:to-green-100',
      borderColor: 'hover:border-green-200',
      textColor: 'group-hover:text-green-800',
    },
    {
      type: 'video',
      icon: Video,
      label: 'Upload Video',
      description: 'Upload videos',
      gradient: 'from-orange-400 to-orange-600',
      hoverGradient: 'hover:from-orange-50 hover:to-orange-100',
      borderColor: 'hover:border-orange-200',
      textColor: 'group-hover:text-orange-800',
    },
    {
      type: 'llm',
      icon: Bot,
      label: 'Run Any LLM',
      description: 'Execute AI models',
      gradient: 'from-purple-400 to-purple-600',
      hoverGradient: 'hover:from-purple-50 hover:to-purple-100',
      borderColor: 'hover:border-purple-200',
      textColor: 'group-hover:text-purple-800',
    },
    {
      type: 'crop',
      icon: Crop,
      label: 'Crop Image',
      description: 'Crop images',
      gradient: 'from-yellow-400 to-yellow-600',
      hoverGradient: 'hover:from-yellow-50 hover:to-yellow-100',
      borderColor: 'hover:border-yellow-200',
      textColor: 'group-hover:text-yellow-800',
    },
    {
      type: 'extract',
      icon: Film,
      label: 'Extract Frame',
      description: 'Extract video frame',
      gradient: 'from-pink-400 to-pink-600',
      hoverGradient: 'hover:from-pink-50 hover:to-pink-100',
      borderColor: 'hover:border-pink-200',
      textColor: 'group-hover:text-pink-800',
    },
  ];

  const filteredNodes = nodes.filter((node) =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div className="w-20 bg-white/80 backdrop-blur-lg border-r border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
        {/* Collapsed Header */}
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="hover:bg-slate-100 transition-all duration-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Collapsed Node Icons */}
        <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-3">
            {nodes.map((node) => (
              <div
                key={node.type}
                className={`relative group cursor-move`}
                draggable
                onDragStart={(e) => handleDragStart(e, node.type)}
                onClick={() => handleAddNode(node.type)}
                title={node.label}
              >
                <div
                  className={`h-12 w-12 rounded-xl bg-gradient-to-r ${node.gradient} flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 hover:scale-110 mx-auto`}
                >
                  <node.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white/80 backdrop-blur-lg border-r border-slate-200/60 shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/60 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 bg-purple-600 bg-clip-text text-transparent">
          Nodes
        </h2>
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
        <h3 className="text-sm font-semibold text-slate-600 mb-4 uppercase tracking-wide">
          Quick Access
        </h3>
        <div className="space-y-3">
          {filteredNodes.map((node) => (
            <Card
              key={node.type}
              className={`p-4 cursor-move hover:bg-gradient-to-r ${node.hoverGradient} hover:shadow-md transition-all duration-300 border-slate-200/60 ${node.borderColor} group`}
              draggable
              onDragStart={(e) => handleDragStart(e, node.type)}
              onClick={() => handleAddNode(node.type)}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`h-12 w-12 rounded-xl bg-gradient-to-r ${node.gradient} flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300`}
                >
                  <node.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className={`font-semibold text-sm text-slate-800 ${node.textColor} transition-colors`}>
                    {node.label}
                  </p>
                  <p className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors">
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