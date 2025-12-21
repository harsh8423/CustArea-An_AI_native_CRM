// Workflow API utilities
import type {
    Workflow,
    WorkflowVersion,
    WorkflowRun,
    RunLog,
    RunNodeResult,
    NodeDefinition
} from './types';

const WORKFLOW_API_URL = process.env.NEXT_PUBLIC_WORKFLOW_API_URL || 'http://localhost:8001';

// Helper to get auth headers
function getHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

// Fetch wrapper with error handling
async function fetchAPI<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${WORKFLOW_API_URL}${url}`, {
        ...options,
        headers: { ...getHeaders(), ...options.headers }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

// ================== NODE DEFINITIONS ==================

export async function getNodeDefinitions(): Promise<{
    nodes: NodeDefinition[];
    by_category: Record<string, NodeDefinition[]>;
}> {
    return fetchAPI('/api/workflows/node-definitions');
}

export async function getNodeDefinition(type: string): Promise<NodeDefinition> {
    return fetchAPI(`/api/workflows/node-definitions/${type}`);
}

// ================== WORKFLOWS ==================

export async function getWorkflows(params?: {
    status?: string;
    limit?: number;
    offset?: number
}): Promise<{ workflows: Workflow[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return fetchAPI(`/api/workflows${query ? `?${query}` : ''}`);
}

export async function getWorkflow(id: string, version?: number): Promise<Workflow & {
    current_version: WorkflowVersion | null;
    versions: { id: string; version_number: number; is_published: boolean; created_at: string }[];
}> {
    const query = version ? `?version=${version}` : '';
    return fetchAPI(`/api/workflows/${id}${query}`);
}

export async function createWorkflow(data: {
    name: string;
    description?: string;
    nodes?: any[];
    edges?: any[];
}): Promise<Workflow & { current_version: WorkflowVersion }> {
    return fetchAPI('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function updateWorkflow(id: string, data: {
    name?: string;
    description?: string;
    status?: string;
}): Promise<Workflow> {
    return fetchAPI(`/api/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function deleteWorkflow(id: string): Promise<{ message: string }> {
    return fetchAPI(`/api/workflows/${id}`, { method: 'DELETE' });
}

// ================== VERSIONS ==================

export async function saveWorkflowVersion(workflowId: string, data: {
    nodes: any[];
    edges: any[];
    variables?: any[];
    settings?: Record<string, any>;
}): Promise<WorkflowVersion> {
    return fetchAPI(`/api/workflows/${workflowId}/versions`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function publishWorkflow(workflowId: string, versionId: string): Promise<{ message: string; version_id: string }> {
    return fetchAPI(`/api/workflows/${workflowId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ version_id: versionId })
    });
}

// ================== RUNS ==================

export async function getWorkflowRuns(params?: {
    workflow_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<{ runs: WorkflowRun[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.workflow_id) searchParams.set('workflow_id', params.workflow_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return fetchAPI(`/api/workflows/runs${query ? `?${query}` : ''}`);
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRun & {
    nodes: any[];
    edges: any[];
}> {
    return fetchAPI(`/api/workflows/runs/${runId}`);
}

export async function getRunLogs(runId: string, params?: {
    level?: string;
    limit?: number;
}): Promise<{ logs: RunLog[] }> {
    const searchParams = new URLSearchParams();
    if (params?.level) searchParams.set('level', params.level);
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return fetchAPI(`/api/workflows/runs/${runId}/logs${query ? `?${query}` : ''}`);
}

export async function getRunNodes(runId: string): Promise<{ nodes: RunNodeResult[] }> {
    return fetchAPI(`/api/workflows/runs/${runId}/nodes`);
}

export async function cancelRun(runId: string): Promise<{ message: string }> {
    return fetchAPI(`/api/workflows/runs/${runId}/cancel`, { method: 'POST' });
}

// ================== TRIGGERS ==================

export async function triggerWorkflow(workflowId: string, payload?: Record<string, any>): Promise<{
    message: string;
    run_id: string;
    workflow_id: string;
}> {
    return fetchAPI(`/api/workflows/trigger/${workflowId}`, {
        method: 'POST',
        body: JSON.stringify({ payload: payload || {} })
    });
}

export async function testWorkflow(workflowId: string, data: {
    payload?: Record<string, any>;
    version_id?: string;
}): Promise<{
    valid: boolean;
    workflow_name: string;
    version_number: number;
    execution_order: Array<{
        node_id: string;
        node_type: string;
        label: string;
        config: Record<string, any>;
        resolved_config: Record<string, any>;
    }>;
}> {
    return fetchAPI(`/api/workflows/trigger/${workflowId}/test`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// ================== NODE EXECUTION ==================

export interface NodeExecutionResult {
    success: boolean;
    nodeId: string;
    output: Record<string, any> | null;
    upstreamOutputs: Record<string, {
        output?: Record<string, any>;
        logs?: Array<{ level: string; message: string }>;
        executedAt?: string;
        _error?: string;
    }>;
    executionTime: number;
    context?: Record<string, any>;
    error?: string;
}

export async function executeNode(
    workflowId: string,
    data: {
        nodeId: string;
        versionId: string;
        executeUpstream?: boolean;
        testInput?: Record<string, any>;
    }
): Promise<NodeExecutionResult> {
    return fetchAPI(`/api/workflows/${workflowId}/execute-node`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export interface TriggerSchema {
    triggerType: string;
    schema: Record<string, any>;
    description: string;
}

export async function getTriggerSchema(
    workflowId: string,
    triggerType?: string
): Promise<TriggerSchema> {
    const url = triggerType
        ? `/api/workflows/${workflowId}/trigger-schema?triggerType=${encodeURIComponent(triggerType)}`
        : `/api/workflows/${workflowId}/trigger-schema`;
    return fetchAPI(url);
}

