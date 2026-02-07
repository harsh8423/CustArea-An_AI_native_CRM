"use client";

import { useState, useEffect } from 'react';
import { Bot, Mail, Phone, MessageSquare, MessageCircle, Loader2, Settings as SettingsIcon, Clock, Shield, CheckCircle2 } from 'lucide-react';

// Helper function to get token from cookies
function getToken() {
    if (typeof document !== 'undefined') {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('token='));
        return cookie ? cookie.split('=')[1] : null;
    }
    return null;
}

interface Resource {
    id: string;
    display_name: string;
    source_type?: string;
    is_active: boolean;
    has_deployment: boolean;
    deployment_id: string | null;
    ai_enabled: boolean | null;
    schedule_enabled?: boolean;
    schedule_start_time?: string;
    schedule_end_time?: string;
    schedule_days?: string[];
    schedule_timezone?: string;
    priority_mode?: string;
    channel: string;
}

interface UserPermissions {
    hasConfigurePermission: boolean;
    hasSuperAdmin: boolean;
}

const CHANNELS = [
    { id: 'all', label: 'All Channels', icon: Bot },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'phone', label: 'Phone', icon: Phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'widget', label: 'Widget', icon: MessageSquare },
];

export default function AIDeployPage() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<UserPermissions>({
        hasConfigurePermission: false,
        hasSuperAdmin: false
    });
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<string>('all');

    useEffect(() => {
        fetchResources();
        checkPermissions();
    }, []);

    async function checkPermissions() {
        try {
            const token = getToken();
            if (!token) return;
            const response = await fetch('/api/permissions/check', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setPermissions({
                hasConfigurePermission: data.permissions?.includes('ai.configure') || data.isSuperAdmin || false,
                hasSuperAdmin: data.isSuperAdmin || false
            });
        } catch (err) {
            console.error('Error checking permissions:', err);
        }
    }

    async function fetchResources() {
        try {
            setLoading(true);
            const token = getToken();
            if (!token) { setLoading(false); return; }

            const response = await fetch('/api/ai/available-resources', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    const flattenedResources: Resource[] = [];
                    if (Array.isArray(data.data.email)) data.data.email.forEach((item: any) => flattenedResources.push({ ...item, channel: 'email' }));
                    if (Array.isArray(data.data.phone)) data.data.phone.forEach((item: any) => flattenedResources.push({ ...item, channel: 'phone' }));
                    if (Array.isArray(data.data.whatsapp)) data.data.whatsapp.forEach((item: any) => flattenedResources.push({ ...item, channel: 'whatsapp' }));
                    if (Array.isArray(data.data.widget)) data.data.widget.forEach((item: any) => flattenedResources.push({ ...item, channel: 'widget' }));
                    setResources(flattenedResources);
                }
            }
        } catch (err) {
            console.error('Error fetching resources:', err);
        } finally {
            setLoading(false);
        }
    }

    async function toggleDeployment(resource: Resource) {
        try {
            const token = getToken();
            if (!token) { alert('Authentication required'); return; }

            const isCurrentlyEnabled = resource.has_deployment && resource.ai_enabled;

            if (isCurrentlyEnabled) {
                if (!resource.deployment_id) return;
                const response = await fetch(`/api/ai/deployments/${resource.deployment_id}/disable`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) fetchResources();
                else { const error = await response.json(); alert(error.message || 'Failed to disable AI'); }
            } else {
                if (resource.has_deployment && resource.deployment_id) {
                    const response = await fetch(`/api/ai/deployments/${resource.deployment_id}/enable`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) fetchResources();
                    else { const error = await response.json(); alert(error.message || 'Failed to enable AI'); }
                } else {
                    const payload: any = { channel: resource.channel, resource_display_name: resource.display_name, is_enabled: true };
                    if (resource.channel === 'email') {
                        if (resource.source_type === 'inbound') payload.allowed_inbound_email_id = resource.id;
                        else payload.email_connection_id = resource.id;
                    } else if (resource.channel === 'phone') payload.phone_config_id = resource.id;
                    else if (resource.channel === 'whatsapp') payload.whatsapp_account_id = resource.id;
                    else if (resource.channel === 'widget') payload.widget_config_id = resource.id;

                    const response = await fetch('/api/ai/deployments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(payload)
                    });
                    if (response.ok) fetchResources();
                    else { const error = await response.json(); alert(error.message || 'Failed to enable AI'); }
                }
            }
        } catch (err) {
            console.error('Error toggling deployment:', err);
            alert('Failed to update AI assistant');
        }
    }

    const filteredResources = selectedChannel === 'all' ? resources : resources.filter(r => r.channel === selectedChannel);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading resources...</p>
                </div>
            </div>
        );
    }

    if (!permissions.hasConfigurePermission) {
        return (
            <div className="h-full bg-[#eff0eb] p-4 flex items-center justify-center">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg p-8 text-center max-w-md">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Access Restricted</h3>
                    <p className="text-sm text-gray-500">
                        You need administrator permissions to configure AI assistant settings.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#eff0eb] p-4 font-sans">
            <div className="h-full bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden flex flex-col">

                {/* Header & Tabs */}
                <div className="px-6 pt-6 pb-4 border-b border-white/20">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full mb-2">
                            <Bot className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Deployment</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Where should your AI work?</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage AI availability across your communication channels.</p>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {CHANNELS.map(channel => {
                            const Icon = channel.icon;
                            const isActive = selectedChannel === channel.id;
                            return (
                                <button
                                    key={channel.id}
                                    onClick={() => setSelectedChannel(channel.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${isActive
                                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200'
                                            : 'bg-white/50 hover:bg-white text-gray-600 hover:text-gray-900 border border-transparent hover:border-gray-100'
                                        }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {channel.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredResources.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
                                <Bot className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">No channels found</h3>
                            <p className="text-xs text-gray-500 max-w-xs mx-auto">
                                Check your settings to ensure you have connected {selectedChannel !== 'all' ? `your ${selectedChannel} accounts` : 'email or phone accounts'}.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredResources.map((resource) => {
                                const isEnabled = resource.has_deployment && resource.ai_enabled;
                                return (
                                    <div
                                        key={resource.id}
                                        className={`group p-4 bg-white hover:bg-blue-50/30 rounded-2xl shadow-sm border border-transparent hover:border-blue-100 transition-all flex items-center justify-between ${isEnabled ? 'bg-blue-50/10' : ''}`}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isEnabled
                                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200 shadow-md'
                                                    : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                {resource.channel === 'email' && <Mail className="w-5 h-5" />}
                                                {resource.channel === 'phone' && <Phone className="w-5 h-5" />}
                                                {resource.channel === 'whatsapp' && <MessageCircle className="w-5 h-5" />}
                                                {resource.channel === 'widget' && <MessageSquare className="w-5 h-5" />}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className={`text-sm font-semibold truncate ${isEnabled ? 'text-gray-900' : 'text-gray-600'}`}>
                                                        {resource.display_name}
                                                    </h3>
                                                    {resource.source_type && resource.source_type !== 'inbound' && (
                                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-md uppercase tracking-wider">
                                                            {resource.source_type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    {isEnabled ? (
                                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">Inactive</span>
                                                    )}

                                                    {resource.schedule_enabled && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <span className="flex items-center gap-1 text-blue-600">
                                                                <Clock className="w-3 h-3" />
                                                                Scheduled
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 pl-4">
                                            {permissions.hasConfigurePermission && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedResource(resource);
                                                        setConfigDialogOpen(true);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    title="Configure settings"
                                                >
                                                    <SettingsIcon className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => toggleDeployment(resource)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isEnabled ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-200'
                                                    }`}
                                                disabled={!permissions.hasConfigurePermission}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${isEnabled ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Config Dialog with Blur */}
            {configDialogOpen && selectedResource && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/50 backdrop-blur-md z-10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    Configure
                                </h2>
                                <p className="text-xs text-gray-500 truncate max-w-[300px]">{selectedResource.display_name}</p>
                            </div>
                            <button
                                onClick={() => setConfigDialogOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                            >
                                <span className="text-xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Schedule Card (Placeholder/Active) */}
                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">Availability Schedule</h3>
                                        <p className="text-xs text-gray-500 mt-1">When should the AI be active?</p>
                                    </div>
                                </div>

                                {selectedResource.schedule_enabled ? (
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between text-xs py-1 border-b border-blue-100/50">
                                            <span className="text-gray-600">Status</span>
                                            <span className="font-medium text-emerald-600">Active</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs py-1 border-b border-blue-100/50">
                                            <span className="text-gray-600">Time</span>
                                            <span className="font-medium text-gray-900">
                                                {selectedResource.schedule_start_time} - {selectedResource.schedule_end_time}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs py-1">
                                            <span className="text-gray-600">Days</span>
                                            <span className="font-medium text-gray-900">
                                                {selectedResource.schedule_days?.join(', ') || 'All Days'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <div className="px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                                            Advanced scheduling controls are coming soon.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Additional Settings Placeholder */}
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 opacity-60">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Response Behavior</h3>
                                <div className="space-y-2">
                                    <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-3 italic">Custom response configurations coming soon.</p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 sticky bottom-0 flex justify-end">
                            <button
                                onClick={() => setConfigDialogOpen(false)}
                                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
