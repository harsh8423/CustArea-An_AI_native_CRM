'use client';

import { useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkflowStore } from '../store';
import { getWorkflow, getNodeDefinitions } from '../api';
import type { NodeDefinition } from '../types';

import WorkflowCanvas from './WorkflowCanvas';
import WorkflowToolbar from './WorkflowToolbar';
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';
import RunsPanel from './RunsPanel';
import NodeEditorModal from './NodeEditorModal';

interface WorkflowBuilderProps {
    workflowId: string;
    onBack: () => void;
}

export default function WorkflowBuilder({ workflowId, onBack }: WorkflowBuilderProps) {
    const {
        setNodeDefinitions,
        setCurrentWorkflow,
        nodeDefinitions,
        addNode,
        showRunsPanel,
        selectedNodeId,
        nodeEditorOpen
    } = useWorkflowStore();

    // Load workflow and node definitions
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load node definitions
                const defs = await getNodeDefinitions();
                setNodeDefinitions(defs.nodes, defs.by_category);

                // Load workflow
                const workflow = await getWorkflow(workflowId);
                setCurrentWorkflow(workflow, workflow.current_version);
            } catch (error) {
                console.error('Failed to load workflow:', error);
            }
        };

        loadData();
    }, [workflowId, setNodeDefinitions, setCurrentWorkflow]);

    // Add node callback for palette
    const handleAddNode = useCallback((definition: NodeDefinition, position: { x: number; y: number }) => {
        const { generateNodeId } = useWorkflowStore.getState();
        const nodeId = generateNodeId(definition.type);
        const nodeNumber = nodeId.split('_').pop();

        const newNode = {
            id: nodeId,
            type: definition.type,
            position,
            data: {
                label: `${definition.name} ${nodeNumber}`,
                config: { ...definition.default_config },
                nodeDefinition: definition,
            },
        };
        addNode(newNode);
    }, [addNode]);

    return (
        <ReactFlowProvider>
            <div className="h-full flex flex-col bg-gray-100">
                {/* Toolbar */}
                <WorkflowToolbar onBack={onBack} />

                {/* Main Content */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Node Palette (Left) */}
                    <NodePalette onAddNode={handleAddNode} />

                    {/* Canvas (Center) */}
                    <WorkflowCanvas nodeDefinitions={nodeDefinitions} />

                    {/* Config Panel (Right) - shown when node selected but modal is closed */}
                    {selectedNodeId && !nodeEditorOpen && (
                        <NodeConfigPanel nodeDefinitions={nodeDefinitions} />
                    )}

                    {/* Runs Panel (Right) - shown when toggled */}
                    <RunsPanel />
                </div>

                {/* Node Editor Modal (n8n-style) */}
                <NodeEditorModal nodeDefinitions={nodeDefinitions} />
            </div>
        </ReactFlowProvider>
    );
}
