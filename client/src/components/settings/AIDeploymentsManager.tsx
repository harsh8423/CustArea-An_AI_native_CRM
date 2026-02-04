'use client';

import { useState, useEffect } from 'react';
import { Mail, MessageCircle, Phone, MessageSquare, Power, Settings, Trash2, Plus, Loader2, Filter } from 'lucide-react';
import { ConfigureAIDeploymentDialog } from './ConfigureAIDeploymentDialog';
import { CreateDeploymentDialog } from './CreateDeploymentDialog';

interface AIDeployment {
    id: string;
    tenant_id: string;
    channel: string;
    resource_name: string;
    resource_id: string;
    is_enabled: boolean;
    schedule_enabled: boolean;
    schedule_start_time?: string;
    schedule_end_time?: string;
    schedule_days?: string[];
    priority_mode: string;
    created_at: string;
}

const CHANNEL_CONFIG = {
    email: { icon: Mail, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    phone: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    widget: { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

export default function AIDeploymentsManager() {
    const [deployments, setDeployments] = useState<AIDeployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChannel, setSelectedChannel] = useState<string>('all');
    const [configureDeploymentId, setConfigureDeploymentId] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    useEffect(() => {
        loadDeployments();
    }, [selectedChannel]);

    async function loadDeployments() {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (selectedChannel !== 'all') {
                params.append('channel', selectedChannel);
            }

            const response = await fetch(`http://localhost:8000/api/ai/deployments?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            setDeployments(data.deployments || []);
        } catch (error) {
            console.error('Failed to load deployments:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleEnabled(deployment: AIDeployment) {
        try {
            const token = localStorage.getItem('token');
            const endpoint = deployment.is_enabled
                ? `/api/ai/deployments/${deployment.id}/disable`
                : `/api/ai/deployments/${deployment.id}/enable`;

            await fetch(`http://localhost:8000${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await loadDeployments();
        } catch (error) {
            console.error('Failed to toggle deployment:', error);
            alert('Failed to update deployment status');
        }
    }

    async function handleDelete(deploymentId: string) {
        if (!confirm('Are you sure you want to delete this AI deployment?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:8000/api/ai/deployments/${deploymentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await loadDeployments();
        } catch (error) {
            console.error('Failed to delete deployment:', error);
            alert('Failed to delete deployment');
        }
    }

    const filteredDeployments = selectedChannel === 'all'
        ? deployments
        : deployments.filter(d => d.channel === selectedChannel);

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">AI Deployments</h1>
                    <p className="text-gray-500 mt-1">Manage AI agent deployment configurations for each resource</p>
                </div>
                <button
                    onClick={() => setShowCreateDialog(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg"
                >
                    <Plus className="h-5 w-5" />
                    Create Deployment
                </button>
            </div>

            {/* Channel Filter */}
            <div className="mb-6 flex items-center gap-3 flex-wrap">
                <Filter className="h-5 w-5 text-gray-400" />
                <button
                    onClick={() => setSelectedChannel('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedChannel === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    All Channels
                </button>
                {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => {
                    const Icon = config.icon;
                    return (
                        <button
                            key={channel}
                            onClick={() => setSelectedChannel(channel)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${selectedChannel === channel
                                ? `${config.bg} ${config.color} border ${config.border}`
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {channel.charAt(0).toUpperCase() + channel.slice(1)}
                        </button>
                    );
                })}
            </div>

            {/* Deployments List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : filteredDeployments.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
                    <p className="text-gray-500">No AI deployments found for this filter</p>
                    <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto">
                        <Plus className="h-4 w-4" />
                        Create Deployment
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDeployments.map(deployment => {
                        const channelConfig = CHANNEL_CONFIG[deployment.channel as keyof typeof CHANNEL_CONFIG];
                        const Icon = channelConfig.icon;

                        return (
                            <div
                                key={deployment.id}
                                className={`bg-white rounded-xl border ${channelConfig.border} p-5 shadow-sm hover:shadow-md transition-shadow`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${channelConfig.bg}`}>
                                            <Icon className={`h-5 w-5 ${channelConfig.color}`} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{deployment.resource_name}</h3>
                                            <p className="text-xs text-gray-500 capitalize">{deployment.channel}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleEnabled(deployment)}
                                        className={`p-2 rounded-lg transition-all ${deployment.is_enabled
                                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                        title={deployment.is_enabled ? 'Enabled' : 'Disabled'}
                                    >
                                        <Power className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Status Info */}
                                <div className="space-y-2 mb-4">
                                    {deployment.schedule_enabled && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-500">Schedule:</span>
                                            <span className="font-medium text-gray-900">
                                                {deployment.schedule_start_time} - {deployment.schedule_end_time}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Priority Mode:</span>
                                        <span className="font-medium text-gray-900 capitalize">
                                            {deployment.priority_mode}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setConfigureDeploymentId(deployment.id)}
                                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                    >
                                        <Settings className="h-4 w-4" />
                                        Configure
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deployment.id)}
                                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Configure Dialog */}
            {configureDeploymentId && (
                <ConfigureAIDeploymentDialog
                    deploymentId={configureDeploymentId}
                    onClose={() => {
                        setConfigureDeploymentId(null);
                        loadDeployments();
                    }}
                />
            )}

            {/* Create Dialog */}
            {showCreateDialog && (
                <CreateDeploymentDialog
                    onClose={() => setShowCreateDialog(false)}
                    onSuccess={() => {
                        setShowCreateDialog(false);
                        loadDeployments();
                    }}
                />
            )}
        </div>
    );
}
