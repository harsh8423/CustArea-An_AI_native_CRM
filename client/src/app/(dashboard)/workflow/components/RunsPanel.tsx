'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import { getWorkflowRuns, getRunLogs, getRunNodes, cancelRun } from '../api';
import type { WorkflowRun, RunLog, RunNodeResult } from '../types';
import {
    X,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Play,
    Pause,
    ChevronRight,
    RefreshCw,
    Ban,
    Terminal
} from 'lucide-react';

export default function RunsPanel() {
    const { currentWorkflow, showRunsPanel, toggleRunsPanel, selectedRun, setSelectedRun } = useWorkflowStore();
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [logs, setLogs] = useState<RunLog[]>([]);
    const [nodeResults, setNodeResults] = useState<RunNodeResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [activeTab, setActiveTab] = useState<'logs' | 'nodes'>('logs');

    // Load runs
    useEffect(() => {
        if (showRunsPanel && currentWorkflow) {
            loadRuns();
        }
    }, [showRunsPanel, currentWorkflow?.id]);

    // Load run details when selected
    useEffect(() => {
        if (selectedRun) {
            loadRunDetails(selectedRun.id);
        }
    }, [selectedRun?.id]);

    const loadRuns = async () => {
        if (!currentWorkflow) return;
        setLoading(true);
        try {
            const { runs } = await getWorkflowRuns({ workflow_id: currentWorkflow.id, limit: 20 });
            setRuns(runs);
        } catch (error) {
            console.error('Failed to load runs:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRunDetails = async (runId: string) => {
        setLoadingLogs(true);
        try {
            const [logsResult, nodesResult] = await Promise.all([
                getRunLogs(runId, { limit: 100 }),
                getRunNodes(runId)
            ]);
            setLogs(logsResult.logs);
            setNodeResults(nodesResult.nodes);
        } catch (error) {
            console.error('Failed to load run details:', error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleCancelRun = async (runId: string) => {
        try {
            await cancelRun(runId);
            loadRuns(); // Refresh
        } catch (error) {
            console.error('Failed to cancel run:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'waiting': return <Pause className="w-4 h-4 text-amber-500" />;
            case 'cancelled': return <Ban className="w-4 h-4 text-gray-500" />;
            default: return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-100 text-emerald-700';
            case 'failed': return 'bg-red-100 text-red-700';
            case 'running': return 'bg-blue-100 text-blue-700';
            case 'waiting': return 'bg-amber-100 text-amber-700';
            case 'cancelled': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleTimeString();
    };

    if (!showRunsPanel) return null;

    return (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-xl z-20 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-violet-600" />
                    <h3 className="font-semibold text-gray-800">Execution History</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadRuns}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={cn("w-4 h-4 text-gray-400", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={toggleRunsPanel}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Runs List */}
                <div className={cn(
                    "border-r border-gray-100 overflow-y-auto transition-all",
                    selectedRun ? "w-1/3" : "w-full"
                )}>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                        </div>
                    ) : runs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No runs yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {runs.map((run) => (
                                <button
                                    key={run.id}
                                    onClick={() => setSelectedRun(run)}
                                    className={cn(
                                        "w-full p-3 text-left hover:bg-gray-50 transition-colors",
                                        selectedRun?.id === run.id && "bg-violet-50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(run.status)}
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                                getStatusColor(run.status)
                                            )}>
                                                {run.status}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatTime(run.started_at || run.created_at)}
                                        {run.executed_node_count > 0 && (
                                            <span className="ml-2">• {run.executed_node_count} nodes</span>
                                        )}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Run Details */}
                {selectedRun && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setActiveTab('logs')}
                                className={cn(
                                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                                    activeTab === 'logs'
                                        ? "bg-violet-50 text-violet-700 border-b-2 border-violet-500"
                                        : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                Logs
                            </button>
                            <button
                                onClick={() => setActiveTab('nodes')}
                                className={cn(
                                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                                    activeTab === 'nodes'
                                        ? "bg-violet-50 text-violet-700 border-b-2 border-violet-500"
                                        : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                Nodes
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingLogs ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                </div>
                            ) : activeTab === 'logs' ? (
                                <div className="p-2 space-y-1">
                                    {logs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={cn(
                                                "p-2 rounded text-xs font-mono",
                                                log.level === 'error' && "bg-red-50 text-red-700",
                                                log.level === 'warn' && "bg-amber-50 text-amber-700",
                                                log.level === 'info' && "bg-gray-50 text-gray-700",
                                                log.level === 'debug' && "bg-slate-50 text-slate-600"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className="text-gray-400">{formatTime(log.created_at)}</span>
                                                {log.node_id && (
                                                    <span className="text-violet-600">[{log.node_id}]</span>
                                                )}
                                                <span className="flex-1">{log.message}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {logs.length === 0 && (
                                        <p className="text-center text-gray-400 py-8 text-sm">No logs</p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {nodeResults.map((node) => (
                                        <div
                                            key={node.id}
                                            className="p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(node.status)}
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {node.node_id}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-400">
                                                    {node.execution_ms}ms
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{node.node_type}</p>
                                            {node.error_message && (
                                                <p className="text-xs text-red-600 mt-1">{node.error_message}</p>
                                            )}
                                        </div>
                                    ))}
                                    {nodeResults.length === 0 && (
                                        <p className="text-center text-gray-400 py-8 text-sm">No node results</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        {['running', 'waiting', 'pending'].includes(selectedRun.status) && (
                            <div className="p-3 border-t border-gray-100">
                                <button
                                    onClick={() => handleCancelRun(selectedRun.id)}
                                    className="w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Cancel Run
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
