'use client';

import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '@/store/workflowStore';
import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import VideoNode from './nodes/VideoNode';
import LLMNode from './nodes/LLMNode';
import CropImageNode from './nodes/CropImageNode';
import ExtractFrameNode from './nodes/ExtractFrameNode';

const nodeTypes = {
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  llm: LLMNode,
  crop: CropImageNode,
  extract: ExtractFrameNode,
};

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addTextNode,
    addImageNode,
    addVideoNode,
    addLLMNode,
    addCropImageNode,
    addExtractFrameNode,
  } = useWorkflowStore();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      switch (type) {
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
    },
    [
      screenToFlowPosition,
      addTextNode,
      addImageNode,
      addVideoNode,
      addLLMNode,
      addCropImageNode,
      addExtractFrameNode,
    ]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="flex-1 h-full bg-[#0a0a0a]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
        }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#FFFFFF"
          className="opacity-20"
        />

        <MiniMap
          className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case 'text':
                return '#3b82f6';
              case 'image':
                return '#10b981';
              case 'video':
                return '#f97316';
              case 'llm':
                return '#8b5cf6';
              case 'crop':
                return '#eab308';
              case 'extract':
                return '#ec4899';
              default:
                return '#64748b';
            }
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        <Controls className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}