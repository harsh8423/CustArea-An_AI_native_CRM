'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
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
    type LucideIcon
} from 'lucide-react';

// Icon mapping for node types
const iconMap: Record<string, LucideIcon> = {
    // Triggers
    'whatsapp_message': MessageCircle,
    'email_received': Mail,
    'ticket_created': Ticket,
    'lead_added': UserPlus,
    'missed_call': PhoneMissed,
    'scheduled_trigger': Clock,
    'manual_trigger': Play,
    // Logic
    'if_else': GitBranch,
    'switch': Shuffle,
    'wait': Timer,
    'loop': Repeat,
    'stop': Square,
    // AI
    'intent_detection': Brain,
    'sentiment_detection': Heart,
    'extract_entity': Search,
    'llm_agent': Sparkles,
    // Output
    'send_whatsapp': Send,
    'send_email': AtSign,
    'create_lead': UserPlus,
    'create_ticket': Ticket,
    'assign_user': UserCheck,
    // Utility
    'set_variable': Edit,
    'json_parser': Code,
    'http_request': Globe,
    'assert': AlertTriangle,
    'error_handler': Shield,
};

// Category colors
const categoryColors: Record<string, { bg: string; border: string; icon: string }> = {
    trigger: { bg: 'bg-emerald-50', border: 'border-emerald-500', icon: 'text-emerald-600' },
    logic: { bg: 'bg-blue-50', border: 'border-blue-500', icon: 'text-blue-600' },
    ai: { bg: 'bg-violet-50', border: 'border-violet-500', icon: 'text-violet-600' },
    output: { bg: 'bg-orange-50', border: 'border-orange-500', icon: 'text-orange-600' },
    utility: { bg: 'bg-slate-50', border: 'border-slate-500', icon: 'text-slate-600' },
};

interface WorkflowNodeData {
    label: string;
    config?: Record<string, any>;
    nodeDefinition?: {
        type: string;
        name: string;
        category: string;
        color?: string;
    };
}

function WorkflowNode({ data, selected, id, type }: NodeProps<WorkflowNodeData>) {
    const nodeType = data.nodeDefinition?.type || type || 'unknown';
    const category = data.nodeDefinition?.category || 'utility';
    const colors = categoryColors[category] || categoryColors.utility;
    const Icon = iconMap[nodeType] || Code;

    const isTrigger = category === 'trigger';
    const isBranching = ['if_else', 'switch'].includes(nodeType);

    return (
        <div className={cn(
            'relative min-w-[180px] rounded-xl border-2 shadow-lg transition-all duration-200',
            colors.bg,
            colors.border,
            selected && 'ring-2 ring-offset-2 ring-blue-500 shadow-xl scale-[1.02]'
        )}>
            {/* Input Handle - not on triggers */}
            {!isTrigger && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white hover:!bg-blue-500 transition-colors"
                />
            )}

            {/* Node Content */}
            <div className="p-3">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        data.nodeDefinition?.color
                            ? ''
                            : `${colors.icon} bg-white shadow-sm`
                    )} style={data.nodeDefinition?.color ? { backgroundColor: data.nodeDefinition.color } : {}}>
                        <Icon className={cn('w-4 h-4', data.nodeDefinition?.color ? 'text-white' : '')} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                            {data.label || data.nodeDefinition?.name || nodeType}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                            {category}
                        </p>
                    </div>
                </div>

                {/* Show config preview */}
                {data.config && Object.keys(data.config).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50">
                        <p className="text-[10px] text-gray-400 truncate">
                            {Object.entries(data.config)
                                .filter(([k, v]) => v && typeof v !== 'object')
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${String(v).slice(0, 15)}`)
                                .join(' • ')}
                        </p>
                    </div>
                )}
            </div>

            {/* Output Handle(s) */}
            {nodeType === 'if_else' ? (
                <>
                    {/* True branch */}
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white hover:!bg-emerald-600 transition-colors"
                        style={{ left: '30%' }}
                    />
                    {/* False branch */}
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white hover:!bg-rose-600 transition-colors"
                        style={{ left: '70%' }}
                    />
                    {/* Labels */}
                    <div className="absolute -bottom-5 left-[30%] -translate-x-1/2 text-[9px] text-emerald-600 font-medium">
                        True
                    </div>
                    <div className="absolute -bottom-5 left-[70%] -translate-x-1/2 text-[9px] text-rose-600 font-medium">
                        False
                    </div>
                </>
            ) : nodeType === 'switch' ? (
                <>
                    {/* Dynamic switch case handles */}
                    {(() => {
                        const cases = (data as any).config?.cases || [];
                        const includeDefault = (data as any).config?.includeDefault ?? true;
                        const totalHandles = cases.length + (includeDefault ? 1 : 0);
                        const colorPalette = ['#10b981', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];

                        if (totalHandles === 0) {
                            return (
                                <Handle
                                    type="source"
                                    position={Position.Bottom}
                                    isConnectable={true}
                                    className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
                                />
                            );
                        }

                        return (
                            <>
                                {cases.map((c: { id: string; label?: string }, index: number) => {
                                    const position = ((index + 1) / (totalHandles + 1)) * 100;
                                    return (
                                        <Handle
                                            key={c.id}
                                            type="source"
                                            position={Position.Bottom}
                                            id={c.id}
                                            isConnectable={true}
                                            className="!w-3 !h-3 !border-2 !border-white transition-colors cursor-pointer"
                                            style={{
                                                left: `${position}%`,
                                                backgroundColor: colorPalette[index % colorPalette.length]
                                            }}
                                        />
                                    );
                                })}
                                {includeDefault && (
                                    <Handle
                                        type="source"
                                        position={Position.Bottom}
                                        id="default"
                                        isConnectable={true}
                                        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white transition-colors cursor-pointer"
                                        style={{ left: `${(cases.length + 1) / (totalHandles + 1) * 100}%` }}
                                    />
                                )}
                                {/* Labels under handles */}
                                <div className="absolute -bottom-5 left-0 right-0 flex justify-around text-[8px] px-2">
                                    {cases.map((c: { id: string; label?: string }, i: number) => (
                                        <span key={c.id} className="text-gray-600 truncate max-w-[40px]">{c.label || `Case ${i + 1}`}</span>
                                    ))}
                                    {includeDefault && <span className="text-gray-500">Default</span>}
                                </div>
                            </>
                        );
                    })()}
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white hover:!bg-blue-500 transition-colors"
                />
            )}
        </div>
    );
}

export default memo(WorkflowNode);
