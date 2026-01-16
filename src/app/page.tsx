'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/workflow/Sidebar';
import { RightSidebar } from '@/components/workflow/RightSidebar';
import { Toolbar } from '@/components/workflow/Toolbar';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { useWorkflowStore } from '@/store/workflowStore';

export default function Home() {
  const { saveToHistory } = useWorkflowStore();

  useEffect(() => {
    // Load sample workflow - Product Marketing Kit Generator
    const sampleWorkflow = createSampleWorkflow();
    useWorkflowStore.setState({
      nodes: sampleWorkflow.nodes,
      edges: sampleWorkflow.edges,
    });
    saveToHistory();
  }, [saveToHistory]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <WorkflowCanvas />
        <RightSidebar />
      </div>
    </div>
  );
}

// Sample workflow: Product Marketing Kit Generator
function createSampleWorkflow() {
  const nodes = [
    // Branch A: Image Processing
    {
      id: 'upload-img',
      type: 'image',
      position: { x: 100, y: 100 },
      data: { label: 'Product Photo' },
    },
    {
      id: 'crop-img',
      type: 'crop',
      position: { x: 400, y: 100 },
      data: {
        label: 'Crop Product',
        xPercent: 10,
        yPercent: 10,
        widthPercent: 80,
        heightPercent: 80,
      },
    },
    {
      id: 'text-system',
      type: 'text',
      position: { x: 100, y: 300 },
      data: {
        label: 'System Prompt',
        text: 'You are a professional marketing copywriter. Generate compelling product descriptions.',
      },
    },
    {
      id: 'text-product',
      type: 'text',
      position: { x: 100, y: 500 },
      data: {
        label: 'Product Details',
        text: 'Product: Wireless Bluetooth Headphones\nFeatures: Noise cancellation, 30-hour battery, foldable design.',
      },
    },
    {
      id: 'llm-describe',
      type: 'llm',
      position: { x: 750, y: 250 },
      data: {
        label: 'Generate Description',
        model: 'gemini-2.5-flash',
      },
    },
    // Branch B: Video Processing
    {
      id: 'upload-video',
      type: 'video',
      position: { x: 100, y: 700 },
      data: { label: 'Product Demo Video' },
    },
    {
      id: 'extract-frame',
      type: 'extract',
      position: { x: 400, y: 700 },
      data: {
        label: 'Extract Frame',
        timestamp: '50%',
      },
    },
    // Convergence: Final Marketing
    {
      id: 'text-final-system',
      type: 'text',
      position: { x: 750, y: 600 },
      data: {
        label: 'Social Media Prompt',
        text: 'Create a tweet-length marketing post based on the product description and images.',
      },
    },
    {
      id: 'llm-final',
      type: 'llm',
      position: { x: 1150, y: 450 },
      data: {
        label: 'Final Marketing Post',
        model: 'gemini-2.5-flash',
      },
    },
  ];

  const edges = [
    // Branch A connections
    { id: 'e1', source: 'upload-img', target: 'crop-img', targetHandle: 'image_url', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e2', source: 'text-system', target: 'llm-describe', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e3', source: 'text-product', target: 'llm-describe', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e4', source: 'crop-img', target: 'llm-describe', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
    
    // Branch B connections
    { id: 'e5', source: 'upload-video', target: 'extract-frame', targetHandle: 'video_url', animated: true, style: { stroke: '#8b5cf6' } },
    
    // Convergence connections
    { id: 'e6', source: 'text-final-system', target: 'llm-final', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e7', source: 'llm-describe', target: 'llm-final', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e8', source: 'crop-img', target: 'llm-final', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e9', source: 'extract-frame', target: 'llm-final', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
  ];

  return { nodes, edges };
}