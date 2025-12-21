'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import { executeNode, getTriggerSchema, NodeExecutionResult } from '../api';
import type { NodeDefinition } from '../types';
import ConditionBuilderDark from './ConditionBuilderDark';
import MultiVariableEditor from './MultiVariableEditor';
import SwitchCaseEditor from './SwitchCaseEditor';
import {
    X, Play, ChevronDown, ChevronRight, Copy, GripVertical,
    ArrowLeft, Loader2, CheckCircle, AlertCircle, Code, Table, FileJson, Plus, Trash2
} from 'lucide-react';

interface NodeEditorModalProps {
    nodeDefinitions: NodeDefinition[];
}

export default function NodeEditorModal({ nodeDefinitions }: NodeEditorModalProps) {
    const {
        nodes, edges, selectedNodeId, nodeEditorOpen, currentWorkflow, currentVersion,
        nodeOutputs, nodeExecutionStatus, testTriggerData,
        closeNodeEditor, setNodeOutput, setNodeExecutionStatus, setTestTriggerData,
        updateNodeConfig
    } = useWorkflowStore();

    const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters');
    const [outputView, setOutputView] = useState<'schema' | 'table' | 'json'>('schema');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isExecuting, setIsExecuting] = useState(false);
    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});

    // Get selected node
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const nodeDefinition = nodeDefinitions.find(d => d.type === selectedNode?.type);

    // Get upstream nodes for input panel
    const upstreamNodes = getUpstreamNodes(nodes, edges, selectedNodeId || '');

    // Sync local config
    useEffect(() => {
        if (selectedNode?.data?.config) {
            setLocalConfig(selectedNode.data.config);
        } else if (nodeDefinition?.default_config) {
            setLocalConfig(nodeDefinition.default_config);
        }
    }, [selectedNodeId, selectedNode, nodeDefinition]);

    // Load trigger schema on open
    useEffect(() => {
        if (nodeEditorOpen && currentWorkflow) {
            if (Object.keys(testTriggerData).length === 0) {
                // Fetch all trigger schemas without triggerType to get per-node schemas
                getTriggerSchema(currentWorkflow.id)
                    .then(result => setTestTriggerData(result.schema))
                    .catch(console.error);
            }
        }
    }, [nodeEditorOpen, currentWorkflow]);

    // Toggle expanded state
    const toggleExpand = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    // Execute current node
    const handleExecute = async () => {
        if (!selectedNodeId || !currentWorkflow || !currentVersion) return;

        setIsExecuting(true);
        setNodeExecutionStatus(selectedNodeId, 'running');

        try {
            const result = await executeNode(currentWorkflow.id, {
                nodeId: selectedNodeId,
                versionId: currentVersion.id,
                executeUpstream: true,
                testInput: testTriggerData
            });

            // Store all outputs
            for (const [nodeId, data] of Object.entries(result.upstreamOutputs)) {
                if (data.output) {
                    setNodeOutput(nodeId, data.output);
                    setNodeExecutionStatus(nodeId, data._error ? 'error' : 'success');
                }
            }

            // Expand all executed nodes
            setExpandedNodes(new Set(Object.keys(result.upstreamOutputs)));

        } catch (error: any) {
            console.error('Execution failed:', error);
            setNodeExecutionStatus(selectedNodeId, 'error');
        } finally {
            setIsExecuting(false);
        }
    };

    // Copy text to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Handle config update
    const updateField = (key: string, value: any) => {
        const newConfig = { ...localConfig, [key]: value };
        setLocalConfig(newConfig);
        if (selectedNodeId) {
            updateNodeConfig(selectedNodeId, newConfig);
        }
    };

    // Handle drag start for variable
    const handleDragStart = (e: React.DragEvent, path: string, value: any) => {
        e.dataTransfer.setData('text/plain', `{{${path}}}`);
        e.dataTransfer.setData('application/json', JSON.stringify({ path, value }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    if (!nodeEditorOpen || !selectedNode || !nodeDefinition) {
        return null;
    }

    const currentOutput = nodeOutputs[selectedNodeId || ''];
    const currentStatus = nodeExecutionStatus[selectedNodeId || ''] || 'idle';

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[#1e1e2e] w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#252536] border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <button onClick={closeNodeEditor} className="text-gray-400 hover:text-white flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm">Back to canvas</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#1e1e2e] rounded-lg text-white font-medium text-sm">
                            {String(selectedNode.data?.label || nodeDefinition.name)}
                        </span>
                    </div>

                    <button
                        onClick={handleExecute}
                        disabled={isExecuting}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                            isExecuting
                                ? "bg-gray-600 text-gray-400 cursor-wait"
                                : "bg-orange-500 hover:bg-orange-600 text-white"
                        )}
                    >
                        {isExecuting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        Execute step
                    </button>
                </div>

                {/* Main Content - Three Panels */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - INPUT */}
                    <div className="w-72 bg-[#1a1a2a] border-r border-gray-700 flex flex-col">
                        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                            <span className="text-gray-400 text-xs font-semibold tracking-wider">INPUT</span>
                            <div className="flex gap-1">
                                <button className="p-1 text-gray-500 hover:text-gray-300"><Code className="w-3 h-3" /></button>
                                <button className="p-1 text-gray-500 hover:text-gray-300"><Table className="w-3 h-3" /></button>
                                <button className="p-1 text-gray-500 hover:text-gray-300"><FileJson className="w-3 h-3" /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {/* Trigger Nodes - Each with its own schema */}
                            {Object.entries(testTriggerData).map(([nodeId, nodeSchema]) => {
                                const triggerNode = nodes.find(n => n.id === nodeId);
                                const nodeLabel = triggerNode?.data?.label || nodeId;
                                const schemaFields = (typeof nodeSchema === 'object' && nodeSchema !== null ? nodeSchema : {}) as Record<string, any>;
                                const fieldCount = Object.keys(schemaFields).length;

                                return (
                                    <div key={nodeId} className="rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => toggleExpand(nodeId)}
                                            className="w-full flex items-center gap-2 p-2 hover:bg-[#252536] text-left"
                                        >
                                            <span className={cn(
                                                "w-2 h-2 rounded-full",
                                                fieldCount > 0 ? "bg-green-500" : "bg-gray-500"
                                            )} />
                                            {expandedNodes.has(nodeId) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                            <span className="text-sm text-gray-300">{nodeLabel}</span>
                                            <span className="ml-auto text-xs text-gray-500">
                                                {fieldCount} fields
                                            </span>
                                        </button>
                                        {expandedNodes.has(nodeId) && (
                                            <div className="bg-[#151522] p-2 space-y-1">
                                                {renderOutputFields(schemaFields, nodeId, handleDragStart, copyToClipboard)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Upstream Nodes (excluding triggers already shown above) */}
                            {upstreamNodes
                                .filter(node => !Object.keys(testTriggerData).includes(node.id))
                                .map(node => {
                                    const output = nodeOutputs[node.id];
                                    const status = nodeExecutionStatus[node.id];

                                    return (
                                        <div key={node.id} className="rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => toggleExpand(node.id)}
                                                className="w-full flex items-center gap-2 p-2 hover:bg-[#252536] text-left"
                                            >
                                                <span className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    status === 'success' ? "bg-green-500" :
                                                        status === 'error' ? "bg-red-500" :
                                                            status === 'running' ? "bg-yellow-500 animate-pulse" :
                                                                "bg-gray-500"
                                                )} />
                                                {expandedNodes.has(node.id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                <span className="text-sm text-gray-300">{node.data?.label || node.id}</span>
                                                {output && (
                                                    <span className="ml-auto text-xs text-gray-500">
                                                        {typeof output === 'object' ? Object.keys(output).length + ' fields' : '1 item'}
                                                    </span>
                                                )}
                                            </button>
                                            {expandedNodes.has(node.id) && output && (
                                                <div className="bg-[#151522] p-2 space-y-1">
                                                    {renderOutputFields(output, node.id, handleDragStart, copyToClipboard)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Center Panel - PARAMETERS */}
                    <div className="flex-1 flex flex-col bg-[#1e1e2e]">
                        <div className="flex border-b border-gray-700">
                            <button
                                onClick={() => setActiveTab('parameters')}
                                className={cn(
                                    "px-4 py-3 text-sm font-medium",
                                    activeTab === 'parameters'
                                        ? "text-orange-400 border-b-2 border-orange-400"
                                        : "text-gray-400 hover:text-gray-300"
                                )}
                            >
                                Parameters
                            </button>
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={cn(
                                    "px-4 py-3 text-sm font-medium",
                                    activeTab === 'settings'
                                        ? "text-orange-400 border-b-2 border-orange-400"
                                        : "text-gray-400 hover:text-gray-300"
                                )}
                            >
                                Settings
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {activeTab === 'parameters' && (
                                <>
                                    {/* Node Description */}
                                    {nodeDefinition.description && (
                                        <p className="text-sm text-gray-400 pb-2 border-b border-gray-700">
                                            {nodeDefinition.description}
                                        </p>
                                    )}

                                    {/* Label Field */}
                                    <div className="space-y-1">
                                        <label className="text-sm text-gray-400">Label</label>
                                        <input
                                            type="text"
                                            value={String(selectedNode?.data?.label || '')}
                                            onChange={(e) => {
                                                if (selectedNodeId) {
                                                    const { nodes, setNodes } = useWorkflowStore.getState();
                                                    setNodes(nodes.map(n =>
                                                        n.id === selectedNodeId
                                                            ? { ...n, data: { ...n.data, label: e.target.value } }
                                                            : n
                                                    ));
                                                }
                                            }}
                                            className="w-full bg-[#151522] text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-violet-500 text-sm"
                                        />
                                    </div>

                                    {/* Config Fields from input_schema */}
                                    {nodeDefinition.input_schema?.properties && (
                                        <>
                                            {/* Special handling for set_variable - MultiVariableEditor */}
                                            {selectedNode?.type === 'set_variable' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm text-gray-400">Variables</label>
                                                    <MultiVariableEditor
                                                        value={localConfig.variables || [{ name: localConfig.name || '', value: localConfig.value || '' }]}
                                                        onChange={(variables) => {
                                                            const newConfig = { ...localConfig, variables };
                                                            setLocalConfig(newConfig);
                                                            if (selectedNodeId) updateNodeConfig(selectedNodeId, newConfig);
                                                        }}
                                                        theme="dark"
                                                    />
                                                </div>
                                            )}

                                            {/* Special handling for switch - SwitchCaseEditor */}
                                            {selectedNode?.type === 'switch' && (
                                                <SwitchCaseEditor
                                                    variable={localConfig.variable || ''}
                                                    cases={localConfig.cases || [{ id: 'case_0', label: 'Case 1', value: '' }]}
                                                    includeDefault={localConfig.includeDefault ?? true}
                                                    onChange={(config) => {
                                                        const newConfig = { ...localConfig, ...config };
                                                        setLocalConfig(newConfig);
                                                        if (selectedNodeId) updateNodeConfig(selectedNodeId, newConfig);
                                                    }}
                                                    theme="dark"
                                                />
                                            )}

                                            {/* Regular fields for other nodes */}
                                            {selectedNode?.type !== 'set_variable' && selectedNode?.type !== 'switch' &&
                                                Object.entries(nodeDefinition.input_schema.properties).map(([key, schema]: [string, any]) => (
                                                    <div key={key} className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-sm text-gray-400">{schema.title || key.replace(/_/g, ' ')}</label>
                                                            {key !== 'condition' && (
                                                                <span className="text-xs text-violet-400 cursor-pointer hover:text-violet-300">
                                                                    {'<>'} Variables
                                                                </span>
                                                            )}
                                                        </div>
                                                        {key === 'condition' ? (
                                                            <ConditionBuilderDark
                                                                value={localConfig[key] || ''}
                                                                onChange={(val) => updateField(key, val)}
                                                                nodeId={selectedNodeId || ''}
                                                            />
                                                        ) : (
                                                            <>
                                                                {renderConfigInput(key, schema, localConfig[key], updateField)}
                                                                {schema.description && (
                                                                    <p className="text-xs text-gray-500">{schema.description}</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ))
                                            }
                                        </>
                                    )}

                                    {/* Fallback: Generate fields from default_config if no schema */}
                                    {!nodeDefinition.input_schema?.properties && nodeDefinition.default_config &&
                                        Object.entries(nodeDefinition.default_config).map(([key, defaultValue]) => (
                                            <div key={key} className="space-y-1">
                                                <label className="text-sm text-gray-400">{key.replace(/_/g, ' ')}</label>
                                                {renderConfigInput(key, { type: typeof defaultValue }, localConfig[key] ?? defaultValue, updateField)}
                                            </div>
                                        ))
                                    }

                                    {/* Save Configuration Button */}
                                    <button
                                        onClick={() => {
                                            if (selectedNodeId) {
                                                updateNodeConfig(selectedNodeId, localConfig);
                                            }
                                        }}
                                        className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors"
                                    >
                                        Save Configuration
                                    </button>
                                </>
                            )}

                            {activeTab === 'settings' && (
                                <div className="text-gray-400 text-sm">
                                    Node settings and execution options coming soon.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - OUTPUT */}
                    <div className="w-80 bg-[#1a1a2a] border-l border-gray-700 flex flex-col">
                        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs font-semibold tracking-wider">OUTPUT</span>
                                {currentStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                            </div>
                            <div className="flex gap-1 bg-[#252536] p-1 rounded-lg">
                                {(['schema', 'table', 'json'] as const).map(view => (
                                    <button
                                        key={view}
                                        onClick={() => setOutputView(view)}
                                        className={cn(
                                            "px-2 py-1 text-xs rounded transition-colors capitalize",
                                            outputView === view
                                                ? "bg-[#1e1e2e] text-white"
                                                : "text-gray-400 hover:text-gray-300"
                                        )}
                                    >
                                        {view}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {currentOutput ? (
                                <div className="space-y-1">
                                    {outputView === 'json' ? (
                                        <pre className="text-xs text-gray-300 bg-[#151522] p-3 rounded-lg overflow-auto">
                                            {JSON.stringify(currentOutput, null, 2)}
                                        </pre>
                                    ) : (
                                        renderOutputFields(currentOutput, selectedNodeId || '', handleDragStart, copyToClipboard)
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                                    <Play className="w-8 h-8 mb-2 opacity-50" />
                                    <p>Execute this node to see output</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper: Get upstream nodes
function getUpstreamNodes(nodes: any[], edges: any[], targetNodeId: string) {
    const result: any[] = [];
    const visited = new Set<string>();

    function visit(nodeId: string) {
        if (visited.has(nodeId) || nodeId === targetNodeId) return;
        visited.add(nodeId);

        const upstreamEdges = edges.filter((e: any) => e.target === nodeId);
        for (const edge of upstreamEdges) {
            visit(edge.source);
        }

        const node = nodes.find((n: any) => n.id === nodeId);
        if (node) result.push(node);
    }

    const incomingEdges = edges.filter((e: any) => e.target === targetNodeId);
    for (const edge of incomingEdges) {
        visit(edge.source);
    }

    return result;
}

// Helper: Render output fields with drag support
function renderOutputFields(
    data: any,
    prefix: string,
    onDragStart: (e: React.DragEvent, path: string, value: any) => void,
    onCopy: (text: string) => void
) {
    if (!data || typeof data !== 'object') {
        return (
            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-[#252536] text-xs">
                <span className="text-gray-300">{String(data)}</span>
            </div>
        );
    }

    return Object.entries(data).map(([key, value]) => {
        const path = `${prefix}.${key}`;
        const isObject = value && typeof value === 'object';
        const displayValue = isObject ? JSON.stringify(value).slice(0, 50) + '...' : String(value);

        return (
            <div key={key} className="group">
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, path, value)}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-[#252536] cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100" />
                    <span className="text-violet-400 text-xs">{key}</span>
                    <span className="text-gray-500 text-xs ml-auto truncate max-w-[120px]">
                        {displayValue}
                    </span>
                    <button
                        onClick={() => onCopy(`{{${path}}}`)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white text-gray-500"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    });
}

// Helper: Render config input based on schema
function renderConfigInput(
    key: string,
    schema: any,
    value: any,
    onChange: (key: string, value: any) => void
) {
    const type = schema.type || 'string';
    const widget = schema['ui:widget'];

    if (type === 'boolean') {
        return (
            <div
                onClick={() => onChange(key, !value)}
                className={cn(
                    "w-10 h-5 rounded-full cursor-pointer transition-colors",
                    value ? "bg-green-500" : "bg-gray-600"
                )}
            >
                <div className={cn(
                    "w-4 h-4 rounded-full bg-white m-0.5 transition-transform",
                    value ? "translate-x-5" : ""
                )} />
            </div>
        );
    }

    if (widget === 'textarea' || key === 'condition' || key === 'message') {
        return (
            <textarea
                value={value || ''}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={schema.description}
                rows={4}
                className="w-full bg-[#151522] text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-violet-500 text-sm font-mono resize-none"
                onDrop={(e) => {
                    e.preventDefault();
                    const text = e.dataTransfer.getData('text/plain');
                    const target = e.target as HTMLTextAreaElement;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const newValue = value.slice(0, start) + text + value.slice(end);
                    onChange(key, newValue);
                }}
                onDragOver={(e) => e.preventDefault()}
            />
        );
    }

    if (schema.enum) {
        return (
            <select
                value={value || ''}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full bg-[#151522] text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-violet-500 text-sm"
            >
                {schema.enum.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    return (
        <input
            type={type === 'number' ? 'number' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={schema.description}
            className="w-full bg-[#151522] text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-violet-500 text-sm"
            onDrop={(e) => {
                e.preventDefault();
                const text = e.dataTransfer.getData('text/plain');
                onChange(key, (value || '') + text);
            }}
            onDragOver={(e) => e.preventDefault()}
        />
    );
}
