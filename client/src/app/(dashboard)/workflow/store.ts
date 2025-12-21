// Workflow Store - State management with Zustand
import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type {
    Workflow,
    WorkflowVersion,
    NodeDefinition,
    WorkflowRun
} from './types';

interface WorkflowState {
    // Node definitions
    nodeDefinitions: NodeDefinition[];
    nodeDefsByCategory: Record<string, NodeDefinition[]>;
    isLoadingDefs: boolean;

    // Current workflow
    currentWorkflow: Workflow | null;
    currentVersion: WorkflowVersion | null;

    // React Flow state
    nodes: Node[];
    edges: Edge[];
    selectedNodeId: string | null;

    // Node type counters for sequential naming
    nodeTypeCounts: Record<string, number>;

    // UI state
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    showNodePanel: boolean;
    showRunsPanel: boolean;

    // Runs
    runs: WorkflowRun[];
    selectedRun: WorkflowRun | null;

    // Actions
    setNodeDefinitions: (defs: NodeDefinition[], byCategory: Record<string, NodeDefinition[]>) => void;
    setCurrentWorkflow: (workflow: Workflow | null, version: WorkflowVersion | null) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: (changes: any) => void;
    onEdgesChange: (changes: any) => void;
    addNode: (node: Node) => void;
    generateNodeId: (nodeType: string) => string;
    updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
    deleteNode: (nodeId: string) => void;
    selectNode: (nodeId: string | null) => void;
    setIsSaving: (saving: boolean) => void;
    setHasUnsavedChanges: (hasChanges: boolean) => void;
    toggleNodePanel: () => void;
    toggleRunsPanel: () => void;
    setRuns: (runs: WorkflowRun[]) => void;
    setSelectedRun: (run: WorkflowRun | null) => void;
    reset: () => void;

    // Node execution state
    nodeOutputs: Record<string, any>;
    nodeExecutionStatus: Record<string, 'idle' | 'running' | 'success' | 'error'>;
    testTriggerData: Record<string, any>;
    nodeEditorOpen: boolean;

    // Node execution actions
    setNodeOutput: (nodeId: string, output: any) => void;
    setNodeExecutionStatus: (nodeId: string, status: 'idle' | 'running' | 'success' | 'error') => void;
    setTestTriggerData: (data: Record<string, any>) => void;
    openNodeEditor: (nodeId: string) => void;
    closeNodeEditor: () => void;
    clearNodeOutputs: () => void;
}

const initialState = {
    nodeDefinitions: [],
    nodeDefsByCategory: {},
    isLoadingDefs: false,
    currentWorkflow: null,
    currentVersion: null,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    nodeTypeCounts: {},
    isSaving: false,
    hasUnsavedChanges: false,
    showNodePanel: true,
    showRunsPanel: false,
    runs: [],
    selectedRun: null,
    // Node execution
    nodeOutputs: {},
    nodeExecutionStatus: {},
    testTriggerData: {},
    nodeEditorOpen: false,
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    ...initialState,

    setNodeDefinitions: (defs, byCategory) => set({
        nodeDefinitions: defs,
        nodeDefsByCategory: byCategory,
        isLoadingDefs: false
    }),

    setCurrentWorkflow: (workflow, version) => {
        // Rebuild node type counts from existing nodes
        const counts: Record<string, number> = {};
        const nodes = version?.nodes || [];
        for (const node of nodes) {
            const nodeType = node.type || 'unknown';
            // Extract the number from node IDs like "set_variable_1"
            const match = node.id.match(new RegExp(`^${nodeType}_(\\d+)$`));
            if (match) {
                const num = parseInt(match[1], 10);
                counts[nodeType] = Math.max(counts[nodeType] || 0, num);
            } else {
                // For legacy timestamp-based IDs, just increment counter
                counts[nodeType] = (counts[nodeType] || 0) + 1;
            }
        }

        set({
            currentWorkflow: workflow,
            currentVersion: version,
            nodes,
            edges: version?.edges || [],
            nodeTypeCounts: counts,
            hasUnsavedChanges: false,
            selectedNodeId: null,
        });
    },

    setNodes: (nodes) => set({ nodes, hasUnsavedChanges: true }),

    setEdges: (edges) => set({ edges, hasUnsavedChanges: true }),

    onNodesChange: (changes) => {
        const { nodes } = get();
        const { applyNodeChanges } = require('@xyflow/react');
        const newNodes = applyNodeChanges(changes, nodes);
        set({ nodes: newNodes, hasUnsavedChanges: true });
    },

    onEdgesChange: (changes) => {
        const { edges } = get();
        const { applyEdgeChanges } = require('@xyflow/react');
        const newEdges = applyEdgeChanges(changes, edges);
        set({ edges: newEdges, hasUnsavedChanges: true });
    },

    // Generate sequential node ID like "set_variable_1", "if_else_2"
    generateNodeId: (nodeType: string) => {
        const { nodeTypeCounts } = get();
        const currentCount = nodeTypeCounts[nodeType] || 0;
        const nextCount = currentCount + 1;
        set({ nodeTypeCounts: { ...nodeTypeCounts, [nodeType]: nextCount } });
        return `${nodeType}_${nextCount}`;
    },

    addNode: (node) => set(state => ({
        nodes: [...state.nodes, node],
        hasUnsavedChanges: true
    })),

    updateNodeConfig: (nodeId, config) => set(state => ({
        nodes: state.nodes.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, config } }
                : n
        ),
        hasUnsavedChanges: true
    })),

    deleteNode: (nodeId) => set(state => ({
        nodes: state.nodes.filter(n => n.id !== nodeId),
        edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        hasUnsavedChanges: true
    })),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    setIsSaving: (saving) => set({ isSaving: saving }),

    setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

    toggleNodePanel: () => set(state => ({ showNodePanel: !state.showNodePanel })),

    toggleRunsPanel: () => set(state => ({ showRunsPanel: !state.showRunsPanel })),

    setRuns: (runs) => set({ runs }),

    setSelectedRun: (run) => set({ selectedRun: run }),

    // Node execution actions
    setNodeOutput: (nodeId, output) => set(state => ({
        nodeOutputs: { ...state.nodeOutputs, [nodeId]: output }
    })),

    setNodeExecutionStatus: (nodeId, status) => set(state => ({
        nodeExecutionStatus: { ...state.nodeExecutionStatus, [nodeId]: status }
    })),

    setTestTriggerData: (data) => set({ testTriggerData: data }),

    openNodeEditor: (nodeId) => set({
        selectedNodeId: nodeId,
        nodeEditorOpen: true
    }),

    closeNodeEditor: () => set({ nodeEditorOpen: false }),

    clearNodeOutputs: () => set({
        nodeOutputs: {},
        nodeExecutionStatus: {}
    }),

    reset: () => set(initialState),
}));
