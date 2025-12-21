'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import type { NodeDefinition } from '../types';
import {
    MessageCircle,
    Mail,
    Ticket,
    UserPlus,
    PhoneMissed,
    Clock,
    Play,
    GitBranch,
    Shuffle,
    Timer,
    Repeat,
    Square,
    Brain,
    Heart,
    Search,
    Sparkles,
    Send,
    AtSign,
    UserCheck,
    Edit,
    Code,
    Globe,
    AlertTriangle,
    Shield,
    ChevronDown,
    ChevronRight,
    GripVertical,
    Zap,
    type LucideIcon
} from 'lucide-react';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
    'whatsapp_message': MessageCircle,
    'email_received': Mail,
    'ticket_created': Ticket,
    'lead_added': UserPlus,
    'missed_call': PhoneMissed,
    'scheduled_trigger': Clock,
    'manual_trigger': Play,
    'if_else': GitBranch,
    'switch': Shuffle,
    'wait': Timer,
    'loop': Repeat,
    'stop': Square,
    'intent_detection': Brain,
    'sentiment_detection': Heart,
    'extract_entity': Search,
    'llm_agent': Sparkles,
    'send_whatsapp': Send,
    'send_email': AtSign,
    'create_lead': UserPlus,
    'create_ticket': Ticket,
    'assign_user': UserCheck,
    'set_variable': Edit,
    'json_parser': Code,
    'http_request': Globe,
    'assert': AlertTriangle,
    'error_handler': Shield,
};

// Category config
const categoryConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
    trigger: { label: 'Triggers', icon: Zap, color: 'text-emerald-500' },
    logic: { label: 'Logic', icon: GitBranch, color: 'text-blue-500' },
    ai: { label: 'AI', icon: Brain, color: 'text-violet-500' },
    output: { label: 'Output', icon: Send, color: 'text-orange-500' },
    utility: { label: 'Utility', icon: Code, color: 'text-slate-500' },
};

interface NodePaletteProps {
    onAddNode: (definition: NodeDefinition, position: { x: number; y: number }) => void;
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
    const { nodeDefsByCategory, showNodePanel, toggleNodePanel } = useWorkflowStore();
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(['trigger', 'logic'])
    );
    const [searchQuery, setSearchQuery] = useState('');

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const handleDragStart = (e: React.DragEvent, definition: NodeDefinition) => {
        e.dataTransfer.setData('application/reactflow', JSON.stringify(definition));
        e.dataTransfer.effectAllowed = 'move';
    };

    // Filter nodes by search
    const filteredCategories = Object.entries(nodeDefsByCategory).reduce((acc, [category, nodes]) => {
        if (!searchQuery) {
            acc[category] = nodes;
            return acc;
        }
        const filtered = nodes.filter(n =>
            n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) {
            acc[category] = filtered;
        }
        return acc;
    }, {} as Record<string, NodeDefinition[]>);

    if (!showNodePanel) {
        return (
            <button
                onClick={toggleNodePanel}
                className="absolute left-4 top-4 z-10 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                title="Show node palette"
            >
                <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
        );
    }

    return (
        <div className="absolute left-0 top-0 bottom-0 w-72 bg-white/95 backdrop-blur-sm border-r border-gray-200 shadow-xl z-10 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        Nodes
                    </h3>
                    <button
                        onClick={toggleNodePanel}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronDown className="w-4 h-4 text-gray-400 rotate-90" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto p-2">
                {Object.entries(filteredCategories).map(([category, nodes]) => {
                    const config = categoryConfig[category] || categoryConfig.utility;
                    const isExpanded = expandedCategories.has(category) || searchQuery.length > 0;
                    const CategoryIcon = config.icon;

                    return (
                        <div key={category} className="mb-1">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <ChevronRight className={cn(
                                    'w-4 h-4 text-gray-400 transition-transform',
                                    isExpanded && 'rotate-90'
                                )} />
                                <CategoryIcon className={cn('w-4 h-4', config.color)} />
                                <span className="text-sm font-medium text-gray-700">{config.label}</span>
                                <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {nodes.length}
                                </span>
                            </button>

                            {/* Nodes */}
                            {isExpanded && (
                                <div className="mt-1 ml-6 space-y-1">
                                    {nodes.map((node) => {
                                        const Icon = iconMap[node.type] || Code;
                                        return (
                                            <div
                                                key={node.type}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, node)}
                                                className="group flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-gray-200"
                                            >
                                                <GripVertical className="w-3 h-3 text-gray-300 group-hover:text-gray-400" />
                                                <div
                                                    className="w-6 h-6 rounded-md flex items-center justify-center"
                                                    style={{ backgroundColor: node.color || '#6B7280' }}
                                                >
                                                    <Icon className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate">
                                                        {node.name}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {Object.keys(filteredCategories).length === 0 && searchQuery && (
                    <div className="text-center py-8 text-gray-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No nodes found</p>
                    </div>
                )}
            </div>

            {/* Help */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500 text-center">
                    Drag and drop nodes onto the canvas
                </p>
            </div>
        </div>
    );
}
