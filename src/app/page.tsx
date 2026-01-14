'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/workflow/Sidebar';
import { Toolbar } from '@/components/workflow/Toolbar';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { useWorkflowStore } from '@/store/workflowStore';

export default function Home() {
  const { saveToHistory } = useWorkflowStore();

  // Load sample workflow on mount
  useEffect(() => {
    // Create sample workflow- Product Listing Generator
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
      </div>
    </div>
  );
}

// Helper function to create the sample workflow
function createSampleWorkflow() {
  const nodes = [
    // Image Nodes
    {
      id: 'img-1',
      type: 'image',
      position: { x: 60, y: 360 },
      data: { label: 'Product Photo 1' },
    },
    {
      id: 'img-2',
      type: 'image',
      position: { x: 60, y: 600 },
      data: { label: 'Product Photo 2' },
    },
    {
      id: 'img-3',
      type: 'image',
      position: { x: 60, y: 840 },
      data: { label: 'Product Photo 3' },
    },
    // Text Nodes
    {
      id: 'text-system',
      type: 'text',
      position: { x: 225, y: 50 },
      data: {
        label: 'System Prompt',
        text: 'You are a product analysis expert. Analyze the provided product images in detail.',
      },
    },
    {
      id: 'text-product',
      type: 'text',
      position: { x: -150, y: 70 },
      data: {
        label: 'Product Info',
        text: 'Product: Premium Wireless Headphones\nBrand: AudioTech\nKey Features: Noise cancellation, 30hr battery, Bluetooth 5.0',
      },
    },
    // LLM Nodes
    {
      id: 'llm-analyze',
      type: 'llm',
      position: { x: 600, y: 400 },
      data: {
        label: 'Analyze Product',
        model: 'gemini-1.5-flash',
      },
    },
    {
      id: 'llm-amazon',
      type: 'llm',
      position: { x: 1440, y: 100 },
      data: {
        label: 'Amazon Listing',
        model: 'gemini-1.5-flash',
      },
    },
    {
      id: 'llm-instagram',
      type: 'llm',
      position: { x: 1440, y: 400 },
      data: {
        label: 'Instagram Caption',
        model: 'gemini-1.5-flash',
      },
    },
    {
      id: 'llm-seo',
      type: 'llm',
      position: { x: 1440, y: 700 },
      data: {
        label: 'SEO Meta Description',
        model: 'gemini-1.5-flash',
      },
    },
    // Prompt Text Nodes for second tier LLMs
    {
      id: 'text-amazon-prompt',
      type: 'text',
      position: { x: 1050, y: 40 },
      data: {
        label: 'Amazon Prompt',
        text: 'Based on the product analysis, write a compelling Amazon product listing with title, bullet points, and description.',
      },
    },
    {
      id: 'text-instagram-prompt',
      type: 'text',
      position: { x: 1050, y: 340 },
      data: {
        label: 'Instagram Prompt',
        text: 'Based on the product analysis, write an engaging Instagram caption with relevant hashtags.',
      },
    },
    {
      id: 'text-seo-prompt',
      type: 'text',
      position: { x: 1050, y: 740 },
      data: {
        label: 'SEO Prompt',
        text: 'Based on the product analysis, write an SEO-optimized meta description under 160 characters.',
      },
    },
  ];

  const edges = [
    // Images to analyze LLM
    { id: 'e1', source: 'img-1', target: 'llm-analyze', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e2', source: 'img-2', target: 'llm-analyze', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e3', source: 'img-3', target: 'llm-analyze', targetHandle: 'images', animated: true, style: { stroke: '#8b5cf6' } },
    // Text nodes to analyze LLM
    { id: 'e4', source: 'text-system', target: 'llm-analyze', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e5', source: 'text-product', target: 'llm-analyze', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    // Analyze LLM to second tier LLMs
    { id: 'e6', source: 'llm-analyze', target: 'llm-amazon', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e7', source: 'llm-analyze', target: 'llm-instagram', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e8', source: 'llm-analyze', target: 'llm-seo', targetHandle: 'user_message', animated: true, style: { stroke: '#8b5cf6' } },
    // Prompts to second tier LLMs
    { id: 'e9', source: 'text-amazon-prompt', target: 'llm-amazon', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e10', source: 'text-instagram-prompt', target: 'llm-instagram', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
    { id: 'e11', source: 'text-seo-prompt', target: 'llm-seo', targetHandle: 'system_prompt', animated: true, style: { stroke: '#8b5cf6' } },
  ];

  return { nodes, edges };
}