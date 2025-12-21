'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import type { NodeDefinition } from '../types';
import VariablePicker from './VariablePicker';
import ConditionBuilder from './ConditionBuilder';
import { X, Save, Info, ChevronRight, Code, Settings } from 'lucide-react';

interface NodeConfigPanelProps {
    nodeDefinitions: NodeDefinition[];
}

export default function NodeConfigPanel({ nodeDefinitions }: NodeConfigPanelProps) {
    const { nodes, selectedNodeId, updateNodeConfig, deleteNode, selectNode } = useWorkflowStore();

    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const nodeDefinition = nodeDefinitions.find(d => d.type === selectedNode?.type);

    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
    const [activeTab, setActiveTab] = useState<'config' | 'variables'>('config');
    const [activeInputRef, setActiveInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

    // Sync local config with selected node
    useEffect(() => {
        if (selectedNode?.data?.config) {
            setLocalConfig(selectedNode.data.config);
        } else if (nodeDefinition?.default_config) {
            setLocalConfig(nodeDefinition.default_config);
        } else {
            setLocalConfig({});
        }
    }, [selectedNodeId, selectedNode, nodeDefinition]);

    if (!selectedNode || !nodeDefinition) {
        return (
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-xl z-10 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                    <Info className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm font-medium">No node selected</p>
                    <p className="text-xs text-center mt-1">
                        Click on a node to configure it
                    </p>
                </div>
            </div>
        );
    }

    const handleSave = () => {
        updateNodeConfig(selectedNode.id, localConfig);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this node?')) {
            deleteNode(selectedNode.id);
        }
    };

    const updateField = (key: string, value: any) => {
        setLocalConfig(prev => ({ ...prev, [key]: value }));
    };

    // Insert variable at cursor position
    const handleInsertVariable = (variablePath: string) => {
        if (activeInputRef) {
            const input = activeInputRef;
            const start = input.selectionStart || 0;
            const end = input.selectionEnd || 0;
            const currentValue = input.value;
            const newValue = currentValue.slice(0, start) + variablePath + currentValue.slice(end);

            // Find which field this input belongs to
            const fieldKey = input.dataset.fieldKey;
            if (fieldKey) {
                updateField(fieldKey, newValue);
                // Restore focus and cursor position
                setTimeout(() => {
                    input.focus();
                    input.setSelectionRange(start + variablePath.length, start + variablePath.length);
                }, 0);
            }
        }
        // Switch back to config tab
        setActiveTab('config');
    };

    // Handle drop on input
    const handleDrop = (e: React.DragEvent, key: string) => {
        e.preventDefault();
        const variablePath = e.dataTransfer.getData('text/plain');
        if (variablePath) {
            const currentValue = localConfig[key] || '';
            updateField(key, currentValue + variablePath);
        }
    };

    // Render form field with variable support
    const renderField = (key: string, schema: any, value: any) => {
        const type = schema.type || 'string';
        const title = schema.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const description = schema.description;
        const widget = schema['ui:widget'];
        const supportsVariables = type === 'string' || key === 'condition' || key === 'message' || key === 'text';

        const inputProps = {
            'data-field-key': key,
            onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => setActiveInputRef(e.target),
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
            onDrop: (e: React.DragEvent) => handleDrop(e, key),
        };

        return (
            <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">{title}</label>
                    {supportsVariables && (
                        <button
                            onClick={() => setActiveTab('variables')}
                            className="text-[10px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                            title="Insert variable"
                        >
                            <Code className="w-3 h-3" />
                            Variables
                        </button>
                    )}
                </div>

                {/* Use ConditionBuilder for condition fields */}
                {key === 'condition' ? (
                    <ConditionBuilder
                        value={value || ''}
                        onChange={(newVal) => updateField(key, newVal)}
                        nodeId={selectedNode?.id || ''}
                    />
                ) : widget === 'textarea' || description?.includes('body') || key === 'message' ? (
                    <textarea
                        value={value || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        placeholder={description}
                        rows={3}
                        className="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
                        {...inputProps}
                    />
                ) : type === 'array' ? (
                    <div className="space-y-2">
                        {(Array.isArray(value) ? value : []).map((item: string, i: number) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                        const newArr = [...(value || [])];
                                        newArr[i] = e.target.value;
                                        updateField(key, newArr);
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    {...inputProps}
                                />
                                <button
                                    onClick={() => {
                                        const newArr = (value || []).filter((_: any, j: number) => j !== i);
                                        updateField(key, newArr);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => updateField(key, [...(value || []), ''])}
                            className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                            + Add item
                        </button>
                    </div>
                ) : schema.enum ? (
                    <select
                        value={value || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    >
                        <option value="">Select...</option>
                        {schema.enum.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : type === 'number' ? (
                    <input
                        type="number"
                        value={value || ''}
                        onChange={(e) => updateField(key, parseFloat(e.target.value) || 0)}
                        placeholder={description}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                ) : type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => updateField(key, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-600">{description || 'Enabled'}</span>
                    </label>
                ) : (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        placeholder={description || `Enter ${title.toLowerCase()}`}
                        className={cn(
                            "w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500",
                            supportsVariables && "font-mono"
                        )}
                        {...inputProps}
                    />
                )}

                {description && !['condition', 'message'].includes(key) && (
                    <p className="text-xs text-gray-400">{description}</p>
                )}

                {key === 'condition' && (
                    <p className="text-xs text-gray-400">
                        Use variable names directly (e.g., <code className="bg-gray-100 px-1 rounded">first_name=="harsh"</code>) or with path (e.g., <code className="bg-gray-100 px-1 rounded">{'{{node_id.field}}'}</code>)
                    </p>
                )}
            </div>
        );
    };

    const inputSchema = nodeDefinition.input_schema || {};
    const properties = inputSchema.properties || {};

    return (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-xl z-10 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: nodeDefinition.color || '#6B7280' }}
                        >
                            <ChevronRight className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">{nodeDefinition.name}</h3>
                            <p className="text-xs text-gray-500 capitalize">{nodeDefinition.category}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => selectNode(null)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
                <button
                    onClick={() => setActiveTab('config')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                        activeTab === 'config'
                            ? "bg-violet-50 text-violet-700 border-b-2 border-violet-500"
                            : "text-gray-600 hover:bg-gray-50"
                    )}
                >
                    <Settings className="w-4 h-4" />
                    Configuration
                </button>
                <button
                    onClick={() => setActiveTab('variables')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                        activeTab === 'variables'
                            ? "bg-violet-50 text-violet-700 border-b-2 border-violet-500"
                            : "text-gray-600 hover:bg-gray-50"
                    )}
                >
                    <Code className="w-4 h-4" />
                    Variables
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'config' ? (
                <>
                    {/* Description */}
                    {nodeDefinition.description && (
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs text-gray-500">{nodeDefinition.description}</p>
                        </div>
                    )}

                    {/* Form Fields */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Node Label */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Label</label>
                            <input
                                type="text"
                                value={String(selectedNode.data?.label || '')}
                                onChange={(e) => {
                                    const { nodes, setNodes } = useWorkflowStore.getState();
                                    setNodes(nodes.map(n =>
                                        n.id === selectedNode.id
                                            ? { ...n, data: { ...n.data, label: e.target.value } }
                                            : n
                                    ));
                                }}
                                placeholder="Node label"
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            />
                        </div>

                        {/* Dynamic Fields from Schema */}
                        {Object.entries(properties).map(([key, schema]) =>
                            renderField(key, schema, localConfig[key])
                        )}

                        {Object.keys(properties).length === 0 && (
                            <div className="text-center py-6 text-gray-400">
                                <p className="text-sm">No configuration required</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-2">
                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            Save Configuration
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Delete Node
                        </button>
                    </div>
                </>
            ) : (
                <VariablePicker
                    targetNodeId={selectedNode.id}
                    onInsertVariable={handleInsertVariable}
                    className="flex-1"
                />
            )}
        </div>
    );
}
