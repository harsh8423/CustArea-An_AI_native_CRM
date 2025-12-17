'use client';

import { useState, useEffect } from 'react';
import {
    Bot, Mail, MessageCircle, Phone, MessageSquare, Loader2,
    Save, Clock, Calendar, AlertCircle, CheckCircle, Power,
    Settings2, Zap, Users, ChevronRight, Globe
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/ai-agent';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

const CHANNELS = [
    {
        id: 'widget',
        name: 'Chat Widget',
        icon: MessageSquare,
        color: 'from-purple-500 to-indigo-600',
        bgLight: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-600',
        description: 'Website chat - always active',
        alwaysOn: true,
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        icon: MessageCircle,
        color: 'from-green-500 to-emerald-600',
        bgLight: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-600',
        description: 'Handle WhatsApp conversations',
        alwaysOn: false,
    },
    {
        id: 'email',
        name: 'Email',
        icon: Mail,
        color: 'from-orange-500 to-amber-600',
        bgLight: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-600',
        description: 'Respond to incoming emails',
        alwaysOn: false,
    },
    {
        id: 'phone',
        name: 'Phone',
        icon: Phone,
        color: 'from-blue-500 to-cyan-600',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-600',
        description: 'AI voice for phone calls',
        alwaysOn: false,
    },
];

const DAYS = [
    { id: 'monday', short: 'M', label: 'Mon' },
    { id: 'tuesday', short: 'T', label: 'Tue' },
    { id: 'wednesday', short: 'W', label: 'Wed' },
    { id: 'thursday', short: 'T', label: 'Thu' },
    { id: 'friday', short: 'F', label: 'Fri' },
    { id: 'saturday', short: 'S', label: 'Sat' },
    { id: 'sunday', short: 'S', label: 'Sun' },
];

const TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'America/New_York', label: 'US Eastern (EST)' },
    { value: 'America/Los_Angeles', label: 'US Pacific (PST)' },
    { value: 'Europe/London', label: 'UK (GMT)' },
    { value: 'Europe/Paris', label: 'Europe (CET)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Australia (AEST)' },
    { value: 'UTC', label: 'UTC' },
];

interface ChannelConfig {
    channel: string;
    is_enabled: boolean;
    schedule_enabled: boolean;
    schedule_start_time: string;
    schedule_end_time: string;
    schedule_days: string[];
    schedule_timezone: string;
    auto_respond: boolean;
    handoff_enabled: boolean;
    max_messages_before_handoff: number;
    welcome_message: string;
    handoff_message: string;
    away_message: string;
    priority_mode: string;
}

export default function DeployPage() {
    const [deployments, setDeployments] = useState<Record<string, ChannelConfig>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<string>('widget');
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadDeployments();
    }, []);

    async function loadDeployments() {
        try {
            const data = await fetchAPI('/deployments');
            const mapped: Record<string, ChannelConfig> = {};

            CHANNELS.forEach(ch => {
                mapped[ch.id] = {
                    channel: ch.id,
                    is_enabled: ch.alwaysOn, // Widget always on
                    schedule_enabled: false,
                    schedule_start_time: '09:00',
                    schedule_end_time: '18:00',
                    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                    schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    auto_respond: true,
                    handoff_enabled: true,
                    max_messages_before_handoff: 10,
                    welcome_message: '',
                    handoff_message: 'Let me connect you with a human agent who can help further.',
                    away_message: 'Our team is currently away. Our AI assistant will help you.',
                    priority_mode: 'normal'
                };
            });

            if (Array.isArray(data)) {
                data.forEach((d: any) => {
                    if (mapped[d.channel]) {
                        mapped[d.channel] = { ...mapped[d.channel], ...d };
                        // Widget is always on
                        if (d.channel === 'widget') {
                            mapped[d.channel].is_enabled = true;
                        }
                    }
                });
            }

            setDeployments(mapped);
        } catch (err) {
            console.error('Failed to load deployments:', err);
            const mapped: Record<string, ChannelConfig> = {};
            CHANNELS.forEach(ch => {
                mapped[ch.id] = {
                    channel: ch.id,
                    is_enabled: ch.alwaysOn,
                    schedule_enabled: false,
                    schedule_start_time: '09:00',
                    schedule_end_time: '18:00',
                    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                    schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    auto_respond: true,
                    handoff_enabled: true,
                    max_messages_before_handoff: 10,
                    welcome_message: '',
                    handoff_message: 'Let me connect you with a human agent.',
                    away_message: 'Our team is currently away.',
                    priority_mode: 'normal'
                };
            });
            setDeployments(mapped);
        } finally {
            setLoading(false);
        }
    }

    function updateConfig(channel: string, updates: Partial<ChannelConfig>) {
        // Widget is always on
        if (channel === 'widget' && 'is_enabled' in updates) {
            updates.is_enabled = true;
        }
        setDeployments(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...updates }
        }));
    }

    async function saveConfig(channel: string) {
        setSaving(channel);
        try {
            await fetchAPI(`/deployments/${channel}`, {
                method: 'PUT',
                body: JSON.stringify(deployments[channel])
            });
            setSaveSuccess(channel);
            setTimeout(() => setSaveSuccess(null), 2000);
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(null);
        }
    }

    async function saveAllConfigs() {
        setSaving('all');
        try {
            await Promise.all(CHANNELS.map(ch =>
                fetchAPI(`/deployments/${ch.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(deployments[ch.id])
                })
            ));
            setSaveSuccess('all');
            setTimeout(() => setSaveSuccess(null), 2000);
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(null);
        }
    }

    const config = deployments[selectedChannel];
    const selectedChannelData = CHANNELS.find(c => c.id === selectedChannel)!;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm text-gray-500">Loading deployment settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex bg-[#eff0eb] p-4 gap-4 overflow-hidden">
            {/* Left Panel - Channel Selection */}
            <div className="w-80 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900">Deploy Agent</h1>
                            <p className="text-xs text-gray-500">Configure AI on channels</p>
                        </div>
                    </div>
                </div>

                {/* Channel List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {CHANNELS.map(channel => {
                        const ChannelIcon = channel.icon;
                        const channelConfig = deployments[channel.id];
                        const isSelected = selectedChannel === channel.id;
                        const isActive = channelConfig?.is_enabled;

                        return (
                            <button
                                key={channel.id}
                                onClick={() => setSelectedChannel(channel.id)}
                                className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${isSelected
                                        ? `${channel.bgLight} ${channel.borderColor} border-2`
                                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${channel.color} flex items-center justify-center`}>
                                            <ChannelIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{channel.name}</p>
                                            <p className="text-xs text-gray-500">{channel.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {channel.alwaysOn ? (
                                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                                                ALWAYS ON
                                            </span>
                                        ) : isActive ? (
                                            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                                        ) : (
                                            <span className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Save All Button */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={saveAllConfigs}
                        disabled={saving === 'all'}
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {saving === 'all' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saveSuccess === 'all' ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saveSuccess === 'all' ? 'Saved!' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            {/* Right Panel - Configuration */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
                {config && (
                    <>
                        {/* Channel Header */}
                        <div className={`p-6 ${selectedChannelData.bgLight} border-b`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selectedChannelData.color} flex items-center justify-center shadow-lg`}>
                                        <selectedChannelData.icon className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{selectedChannelData.name}</h2>
                                        <p className="text-sm text-gray-600">{selectedChannelData.description}</p>
                                    </div>
                                </div>

                                {/* Power Toggle */}
                                {!selectedChannelData.alwaysOn && (
                                    <button
                                        onClick={() => updateConfig(selectedChannel, { is_enabled: !config.is_enabled })}
                                        className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all ${config.is_enabled
                                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                                : 'bg-gray-200 text-gray-600'
                                            }`}
                                    >
                                        <Power className="w-5 h-5" />
                                        {config.is_enabled ? 'Active' : 'Inactive'}
                                    </button>
                                )}
                                {selectedChannelData.alwaysOn && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-xl">
                                        <Zap className="w-4 h-4 text-purple-600" />
                                        <span className="text-purple-700 font-medium text-sm">Always Active</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Configuration Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-3xl space-y-8">

                                {/* Schedule Section */}
                                <div className="bg-gray-50 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Operating Hours</h3>
                                                <p className="text-xs text-gray-500">Set when AI agent is active</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateConfig(selectedChannel, { schedule_enabled: !config.schedule_enabled })}
                                            className={`relative w-14 h-7 rounded-full transition-all ${config.schedule_enabled ? 'bg-amber-500' : 'bg-gray-300'
                                                }`}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${config.schedule_enabled ? 'left-8' : 'left-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {config.schedule_enabled && (
                                        <div className="space-y-5 pl-13">
                                            {/* Time Range */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-2">Start Time</label>
                                                    <input
                                                        type="time"
                                                        value={config.schedule_start_time || '09:00'}
                                                        onChange={(e) => updateConfig(selectedChannel, { schedule_start_time: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-2">End Time</label>
                                                    <input
                                                        type="time"
                                                        value={config.schedule_end_time || '18:00'}
                                                        onChange={(e) => updateConfig(selectedChannel, { schedule_end_time: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Days */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-3">Active Days</label>
                                                <div className="flex gap-2">
                                                    {DAYS.map(day => {
                                                        const isActive = config.schedule_days?.includes(day.id);
                                                        return (
                                                            <button
                                                                key={day.id}
                                                                onClick={() => {
                                                                    const days = config.schedule_days || [];
                                                                    const newDays = isActive
                                                                        ? days.filter(d => d !== day.id)
                                                                        : [...days, day.id];
                                                                    updateConfig(selectedChannel, { schedule_days: newDays });
                                                                }}
                                                                className={`w-11 h-11 rounded-xl text-sm font-semibold transition-all ${isActive
                                                                        ? `bg-gradient-to-br ${selectedChannelData.color} text-white shadow-md`
                                                                        : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                                                                    }`}
                                                            >
                                                                {day.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Timezone */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-2">Timezone</label>
                                                <div className="relative">
                                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <select
                                                        value={config.schedule_timezone}
                                                        onChange={(e) => updateConfig(selectedChannel, { schedule_timezone: e.target.value })}
                                                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all appearance-none"
                                                    >
                                                        {TIMEZONES.map(tz => (
                                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Handoff Settings */}
                                <div className="bg-gray-50 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Human Handoff</h3>
                                                <p className="text-xs text-gray-500">Transfer to live agents when needed</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateConfig(selectedChannel, { handoff_enabled: !config.handoff_enabled })}
                                            className={`relative w-14 h-7 rounded-full transition-all ${config.handoff_enabled ? 'bg-blue-500' : 'bg-gray-300'
                                                }`}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${config.handoff_enabled ? 'left-8' : 'left-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {config.handoff_enabled && (
                                        <div className="space-y-4 pl-13">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-2">Handoff Message</label>
                                                <textarea
                                                    value={config.handoff_message || ''}
                                                    onChange={(e) => updateConfig(selectedChannel, { handoff_message: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-none"
                                                    placeholder="Let me connect you with a human agent..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-2">Max Messages Before Handoff</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    value={config.max_messages_before_handoff || 10}
                                                    onChange={(e) => updateConfig(selectedChannel, { max_messages_before_handoff: parseInt(e.target.value) })}
                                                    className="w-32 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Messages */}
                                <div className="bg-gray-50 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">Custom Messages</h3>
                                            <p className="text-xs text-gray-500">Personalize AI responses</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">Welcome Message</label>
                                            <textarea
                                                value={config.welcome_message || ''}
                                                onChange={(e) => updateConfig(selectedChannel, { welcome_message: e.target.value })}
                                                rows={2}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none"
                                                placeholder="Hello! How can I help you today?"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">Away Message</label>
                                            <textarea
                                                value={config.away_message || ''}
                                                onChange={(e) => updateConfig(selectedChannel, { away_message: e.target.value })}
                                                rows={2}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none"
                                                placeholder="Our team is currently away. Our AI will assist you."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => saveConfig(selectedChannel)}
                                disabled={saving === selectedChannel}
                                className={`px-6 py-3 bg-gradient-to-r ${selectedChannelData.color} text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg`}
                            >
                                {saving === selectedChannel ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saveSuccess === selectedChannel ? (
                                    <CheckCircle className="w-4 h-4" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saveSuccess === selectedChannel ? 'Saved!' : `Save ${selectedChannelData.name} Settings`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
