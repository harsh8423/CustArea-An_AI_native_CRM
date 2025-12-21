'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import type { NodeDefinition } from '../types';
import {
    ChevronRight,
    ChevronDown,
    Variable,
    GripVertical,
    Copy,
    Check,
    Search,
    Code
} from 'lucide-react';

// Mock output schemas for nodes - in production, fetch from backend
const nodeOutputSchemas: Record<string, Record<string, string>> = {
    manual_trigger: {
        'triggered_at': 'string',
        'user_id': 'string',
    },
    whatsapp_message: {
        'message_id': 'string',
        'content': 'string',
        'contact.id': 'string',
        'contact.name': 'string',
        'contact.phone': 'string',
    },
    email_received: {
        'message_id': 'string',
        'from': 'string',
        'subject': 'string',
        'body': 'string',
    },
    set_variable: {
        'value': 'any',
    },
    if_else: {
        'branch': 'string',
        'result': 'boolean',
    },
    intent_detection: {
        'intent': 'string',
        'confidence': 'number',
    },
    sentiment_detection: {
        'sentiment': 'string',
        'score': 'number',
    },
    extract_entity: {
        'entities': 'object',
    },
    llm_agent: {
        'response': 'string',
        'tokens_used': 'number',
    },
    send_whatsapp: {
        'message_id': 'string',
        'status': 'string',
    },
    send_email: {
        'message_id': 'string',
        'status': 'string',
    },
    create_lead: {
        'lead_id': 'string',
    },
    create_ticket: {
        'ticket_id': 'string',
        'ticket_number': 'string',
    },
    http_request: {
        'status': 'number',
        'body': 'any',
        'headers': 'object',
    },
    json_parser: {
        'parsed': 'object',
    },
};

interface VariablePickerProps {
    targetNodeId: string;
    onInsertVariable: (variablePath: string) => void;
    className?: string;
}

export default function VariablePicker({ targetNodeId, onInsertVariable, className }: VariablePickerProps) {
    const { nodes, edges } = useWorkflowStore();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedPath, setCopiedPath] = useState<string | null>(null);

    // Find upstream nodes
    const upstreamNodes = useMemo(() => {
        const upstream: typeof nodes = [];
        const visited = new Set<string>();

        function findUpstream(nodeId: string) {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const incomingEdges = edges.filter(e => e.target === nodeId);
            for (const edge of incomingEdges) {
                const sourceNode = nodes.find(n => n.id === edge.source);
                if (sourceNode) {
                    upstream.push(sourceNode);
                    findUpstream(sourceNode.id);
                }
            }
        }

        findUpstream(targetNodeId);
        return upstream.reverse(); // Order from trigger to current
    }, [nodes, edges, targetNodeId]);

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const handleDragStart = (e: React.DragEvent, variablePath: string) => {
        e.dataTransfer.setData('text/plain', `{{${variablePath}}}`);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleCopy = async (variablePath: string) => {
        await navigator.clipboard.writeText(`{{${variablePath}}}`);
        setCopiedPath(variablePath);
        setTimeout(() => setCopiedPath(null), 1500);
    };

    const handleInsert = (variablePath: string) => {
        onInsertVariable(`{{${variablePath}}}`);
    };

    // Get output fields for a node
    const getNodeOutputs = (node: typeof nodes[0]) => {
        const nodeType = node.type || 'unknown';
        const schema = nodeOutputSchemas[nodeType] || {};
        const fields: { name: string; path: string; type: string }[] = [];

        // Add standard outputs from schema
        for (const [fieldPath, fieldType] of Object.entries(schema)) {
            fields.push({
                name: fieldPath.split('.').pop() || fieldPath,
                path: `${node.id}.${fieldPath}`,
                type: fieldType
            });
        }

        // For set_variable, add the custom variable name
        if (nodeType === 'set_variable' && node.data?.config?.name) {
            const varName = node.data.config.name;
            fields.unshift({
                name: varName,
                path: varName, // Direct access
                type: 'any'
            });
            fields.push({
                name: varName,
                path: `${node.id}.${varName}`,
                type: 'any'
            });
        }

        return fields;
    };

    // Filter by search
    const filteredNodes = upstreamNodes.filter(node => {
        if (!searchQuery) return true;
        const label = (node.data?.label || node.id).toLowerCase();
        const type = (node.type || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return label.includes(query) || type.includes(query);
    });

    if (upstreamNodes.length === 0) {
        return (
            <div className={cn("p-4 text-center text-gray-400", className)}>
                <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upstream nodes</p>
                <p className="text-xs">Variables from previous nodes will appear here</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col", className)}>
            {/* Header */}
            <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium text-gray-700">Available Variables</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                    Drag to input or click to copy
                </p>
            </div>

            {/* Nodes & Variables */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredNodes.map((node) => {
                    const isExpanded = expandedNodes.has(node.id);
                    const outputs = getNodeOutputs(node);

                    return (
                        <div key={node.id} className="rounded-lg border border-gray-100 overflow-hidden">
                            {/* Node Header */}
                            <button
                                onClick={() => toggleNode(node.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                            >
                                <ChevronRight className={cn(
                                    "w-3.5 h-3.5 text-gray-400 transition-transform",
                                    isExpanded && "rotate-90"
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-700 truncate">
                                        {node.data?.label || node.id}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{node.type}</p>
                                </div>
                                <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                                    {outputs.length}
                                </span>
                            </button>

                            {/* Output Fields */}
                            {isExpanded && outputs.length > 0 && (
                                <div className="border-t border-gray-100 bg-white">
                                    {outputs.map((field) => (
                                        <div
                                            key={field.path}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, field.path)}
                                            onClick={() => handleInsert(field.path)}
                                            className="group flex items-center gap-2 px-3 py-1.5 hover:bg-violet-50 cursor-pointer transition-colors"
                                        >
                                            <GripVertical className="w-3 h-3 text-gray-300 group-hover:text-violet-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-mono text-gray-600 truncate">
                                                    {field.name}
                                                </p>
                                            </div>
                                            <span className="text-[9px] text-gray-400 font-mono">
                                                {field.type}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopy(field.path);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-violet-100 rounded transition-all"
                                                title="Copy"
                                            >
                                                {copiedPath === field.path ? (
                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-3 h-3 text-gray-400" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
