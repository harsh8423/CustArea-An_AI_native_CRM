// Workflow Types
import type { Node, Edge } from '@xyflow/react';

// Node definition from backend
export interface NodeDefinition {
    id: string;
    type: string;
    name: string;
    category: 'trigger' | 'logic' | 'ai' | 'output' | 'utility';
    description: string;
    icon: string;
    color: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    config_schema?: {
        type?: string;
        properties?: Record<string, any>;
        required?: string[];
    };
    default_config: Record<string, any>;
    is_active: boolean;
    sort_order: number;
}

// Workflow from backend
export interface Workflow {
    id: string;
    tenant_id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'paused' | 'archived';
    trigger_type: string | null;
    is_template: boolean;
    created_at: string;
    updated_at: string;
    latest_version?: number;
    run_count?: number;
}

// Workflow version
export interface WorkflowVersion {
    id: string;
    workflow_id: string;
    version_number: number;
    nodes: Node[];
    edges: Edge[];
    variables: WorkflowVariable[];
    settings: Record<string, any>;
    is_published: boolean;
    published_at: string | null;
    created_at: string;
}

// Workflow variable
export interface WorkflowVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    default_value?: any;
}

// Workflow run
export interface WorkflowRun {
    id: string;
    workflow_id: string;
    version_id: string;
    tenant_id: string;
    workflow_name?: string;
    status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
    trigger_data: Record<string, any>;
    context: Record<string, any>;
    current_node_id: string | null;
    executed_node_count: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

// Run node result
export interface RunNodeResult {
    id: string;
    run_id: string;
    node_id: string;
    node_type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    input_data: Record<string, any>;
    output_data: Record<string, any>;
    execution_ms: number;
    error_message: string | null;
    started_at: string;
    completed_at: string;
}

// Run log entry
export interface RunLog {
    id: number;
    run_id: string;
    tenant_id: string;
    node_id: string | null;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    data: Record<string, any>;
    created_at: string;
}

// Custom node data
export interface WorkflowNodeData {
    label: string;
    config: Record<string, any>;
    nodeDefinition?: NodeDefinition;
}

// Workflow node type
export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;
