'use client';

import { useCallback, useRef, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type OnConnect,
    type Node,
    type Edge,
    type NodeTypes,
    ConnectionLineType,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '../store';
import type { NodeDefinition } from '../types';
import WorkflowNode from './WorkflowNode';

// Define all node types that use the same component
const NODE_TYPE_NAMES = [
    'whatsapp_message', 'email_received', 'ticket_created', 'lead_added',
    'missed_call', 'scheduled_trigger', 'manual_trigger', 'if_else',
    'switch', 'wait', 'loop', 'stop', 'intent_detection', 'sentiment_detection',
    'extract_entity', 'llm_agent', 'send_whatsapp', 'send_email',
    'create_lead', 'create_ticket', 'assign_user', 'set_variable',
    'json_parser', 'http_request', 'assert', 'error_handler', 'default'
] as const;

// Create node types object dynamically
const nodeTypes: NodeTypes = NODE_TYPE_NAMES.reduce((acc, type) => {
    acc[type] = WorkflowNode as any;
    return acc;
}, {} as NodeTypes);

interface WorkflowCanvasProps {
    nodeDefinitions: NodeDefinition[];
}


export default function WorkflowCanvas({ nodeDefinitions }: WorkflowCanvasProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const {
        nodes,
        edges,
        setNodes,
        setEdges,
        onNodesChange,
        onEdgesChange,
        addNode,
        selectNode,
        selectedNodeId,
        openNodeEditor
    } = useWorkflowStore();

    // Handle new connections
    const onConnect: OnConnect = useCallback((params) => {
        // Create unique edge ID including sourceHandle for proper routing
        const sourceHandle = params.sourceHandle || 'default';
        const targetHandle = params.targetHandle || 'default';
        const edgeId = `e-${params.source}-${sourceHandle}-${params.target}-${targetHandle}`;

        // Check if this exact edge already exists
        const edgeExists = edges.some(
            e => e.source === params.source &&
                e.target === params.target &&
                (e.sourceHandle || 'default') === sourceHandle &&
                (e.targetHandle || 'default') === targetHandle
        );

        if (edgeExists) {
            console.log('Edge already exists, skipping:', edgeId);
            return;
        }

        const newEdge: Edge = {
            ...params,
            id: edgeId,
            type: 'smoothstep',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
            style: { strokeWidth: 2, stroke: '#94a3b8' },
        } as Edge;

        console.log('Creating new edge:', edgeId, 'from handle:', sourceHandle);
        setEdges([...edges, newEdge]);
    }, [edges, setEdges]);

    // Handle node click (single click - select)
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        selectNode(node.id);
    }, [selectNode]);

    // Handle node double-click (open editor modal)
    const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        openNodeEditor(node.id);
    }, [openNodeEditor]);

    // Handle pane click (deselect)
    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    // Handle drop from palette
    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();

        const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
        const data = event.dataTransfer.getData('application/reactflow');

        if (!data || !reactFlowBounds) return;

        const definition: NodeDefinition = JSON.parse(data);

        // Calculate position
        const position = {
            x: event.clientX - reactFlowBounds.left - 90,
            y: event.clientY - reactFlowBounds.top - 30,
        };

        // Create new node with sequential ID
        const { generateNodeId } = useWorkflowStore.getState();
        const nodeId = generateNodeId(definition.type);

        // Create human-friendly label like "Set Variable 1"
        const typeLabel = definition.name || definition.type.replace(/_/g, ' ');
        const nodeNumber = nodeId.split('_').pop();
        const friendlyLabel = `${typeLabel} ${nodeNumber}`;

        const newNode: Node = {
            id: nodeId,
            type: definition.type,
            position,
            data: {
                label: friendlyLabel,
                config: { ...definition.default_config },
                nodeDefinition: definition,
            },
        };

        addNode(newNode);
    }, [addNode]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Highlight selected node
    const nodesWithSelection = nodes.map(node => ({
        ...node,
        selected: node.id === selectedNodeId,
    }));

    return (
        <div ref={reactFlowWrapper} className="flex-1 h-full">
            <ReactFlow
                nodes={nodesWithSelection}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={{ strokeWidth: 2, stroke: '#94a3b8' }}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
                    style: { strokeWidth: 2, stroke: '#94a3b8' },
                }}
                // Edge selection and deletion
                deleteKeyCode={['Backspace', 'Delete']}
                selectionKeyCode={null}
                multiSelectionKeyCode={'Shift'}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                snapToGrid
                snapGrid={[15, 15]}
                className="bg-gray-50"
            >
                <Background
                    gap={20}
                    size={1}
                    color="#e2e8f0"
                    className="bg-gradient-to-br from-slate-50 to-gray-100"
                />
                <Controls
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg"
                />
                <MiniMap
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg"
                    nodeColor={(node) => {
                        const category = (node.data as any)?.nodeDefinition?.category;
                        switch (category) {
                            case 'trigger': return '#10b981';
                            case 'logic': return '#3b82f6';
                            case 'ai': return '#8b5cf6';
                            case 'output': return '#f97316';
                            case 'utility': return '#64748b';
                            default: return '#94a3b8';
                        }
                    }}
                    maskColor="rgba(0, 0, 0, 0.05)"
                />
            </ReactFlow>
        </div>
    );
}
