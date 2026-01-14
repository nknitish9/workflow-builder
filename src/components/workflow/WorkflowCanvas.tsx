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
import LLMNode from './nodes/LLMNode';

const nodeTypes = {
  text: TextNode,
  image: ImageNode,
  llm: LLMNode,
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
    addLLMNode,
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

      if (type === 'text') addTextNode(position);
      if (type === 'image') addImageNode(position);
      if (type === 'llm') addLLMNode(position);
    },
    [screenToFlowPosition, addTextNode, addImageNode, addLLMNode]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full bg-gradient-to-br from-slate-50/50 to-blue-50/30">
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
        {/* DOT GRID BACKGROUND */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="gray"
          className="opacity-60"
        />

        <MiniMap
          className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case 'text':
                return '#3b82f6';
              case 'image':
                return '#10b981';
              case 'llm':
                return '#8b5cf6';
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