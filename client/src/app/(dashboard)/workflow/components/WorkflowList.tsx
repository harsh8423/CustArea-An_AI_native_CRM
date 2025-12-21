'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getWorkflows, createWorkflow, deleteWorkflow, updateWorkflow } from '../api';
import type { Workflow } from '../types';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    GitBranch,
    Play,
    Pause,
    Archive,
    Trash2,
    Edit2,
    Copy,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Zap
} from 'lucide-react';

interface WorkflowListProps {
    onSelectWorkflow: (id: string) => void;
}

export default function WorkflowList({ onSelectWorkflow }: WorkflowListProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Load workflows
    useEffect(() => {
        loadWorkflows();
    }, [statusFilter]);

    const loadWorkflows = async () => {
        setLoading(true);
        try {
            const params: any = { limit: 50 };
            if (statusFilter !== 'all') params.status = statusFilter;
            const { workflows } = await getWorkflows(params);
            setWorkflows(workflows);
        } catch (error) {
            console.error('Failed to load workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        if (!newWorkflowName.trim()) return;

        setCreating(true);
        try {
            const workflow = await createWorkflow({
                name: newWorkflowName.trim(),
                description: newWorkflowDesc.trim(),
            });
            setShowCreateModal(false);
            setNewWorkflowName('');
            setNewWorkflowDesc('');
            onSelectWorkflow(workflow.id);
        } catch (error: any) {
            alert(error.message || 'Failed to create workflow');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        try {
            await deleteWorkflow(id);
            loadWorkflows();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await updateWorkflow(id, { status });
            loadWorkflows();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
        setActiveMenu(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                );
            case 'paused':
                return (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                        <Pause className="w-3 h-3" /> Paused
                    </span>
                );
            case 'archived':
                return (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        <Archive className="w-3 h-3" /> Archived
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        <Edit2 className="w-3 h-3" /> Draft
                    </span>
                );
        }
    };

    // Filter workflows
    const filteredWorkflows = workflows.filter(wf =>
        wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                                <GitBranch className="w-5 h-5 text-white" />
                            </div>
                            Workflows
                        </h1>
                        <p className="text-gray-500 mt-1">Automate your business processes with visual workflows</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all shadow-lg shadow-pink-500/25"
                    >
                        <Plus className="w-5 h-5" />
                        New Workflow
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search workflows..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                        {['all', 'active', 'draft', 'paused', 'archived'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize",
                                    statusFilter === status
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Workflow Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                    </div>
                ) : filteredWorkflows.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <Zap className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No workflows found</h3>
                        <p className="text-gray-500 mb-4">Create your first workflow to get started</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-pink-600 hover:text-pink-700 font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create workflow
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredWorkflows.map((workflow) => (
                            <div
                                key={workflow.id}
                                className="group bg-white rounded-2xl border border-gray-200 hover:border-pink-300 hover:shadow-lg transition-all overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => onSelectWorkflow(workflow.id)}
                                        >
                                            <h3 className="font-semibold text-gray-900 group-hover:text-pink-600 transition-colors truncate">
                                                {workflow.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                                {workflow.description || 'No description'}
                                            </p>
                                        </div>

                                        {/* Toggle Switch + Delete */}
                                        <div className="flex items-center gap-2 ml-3">
                                            {/* Active/Inactive Toggle */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange(workflow.id, workflow.status === 'active' ? 'paused' : 'active');
                                                }}
                                                className={cn(
                                                    "relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                                                    workflow.status === 'active'
                                                        ? 'bg-emerald-500 focus:ring-emerald-500'
                                                        : 'bg-gray-300 focus:ring-gray-400'
                                                )}
                                                title={workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                                            >
                                                <span
                                                    className={cn(
                                                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                                                        workflow.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                                                    )}
                                                />
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteWorkflow(workflow.id);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete workflow"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Click to edit */}
                                    <button
                                        onClick={() => onSelectWorkflow(workflow.id)}
                                        className="text-xs text-pink-500 hover:text-pink-600 font-medium flex items-center gap-1"
                                    >
                                        <Edit2 className="w-3 h-3" /> Edit workflow
                                    </button>
                                </div>

                                {/* Card Footer */}
                                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                    <span className={cn(
                                        "text-xs font-medium px-2 py-0.5 rounded-full",
                                        workflow.status === 'active'
                                            ? "bg-emerald-100 text-emerald-700"
                                            : workflow.status === 'paused'
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-gray-100 text-gray-600"
                                    )}>
                                        {workflow.status === 'active' ? '● Active' : workflow.status === 'paused' ? '● Paused' : '○ Draft'}
                                    </span>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        {workflow.trigger_type && (
                                            <span className="flex items-center gap-1">
                                                <Zap className="w-3 h-3" />
                                                {workflow.trigger_type.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        {workflow.run_count !== undefined && workflow.run_count > 0 && (
                                            <span>{workflow.run_count} runs</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Create New Workflow</h2>
                            <p className="text-sm text-gray-500 mt-1">Start automating your processes</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Workflow Name *
                                </label>
                                <input
                                    type="text"
                                    value={newWorkflowName}
                                    onChange={(e) => setNewWorkflowName(e.target.value)}
                                    placeholder="e.g., Welcome Message Flow"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    value={newWorkflowDesc}
                                    onChange={(e) => setNewWorkflowDesc(e.target.value)}
                                    placeholder="What does this workflow do?"
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewWorkflowName('');
                                    setNewWorkflowDesc('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWorkflow}
                                disabled={!newWorkflowName.trim() || creating}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Create Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
