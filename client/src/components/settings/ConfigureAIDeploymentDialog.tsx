"use client";

import { useState, useEffect } from 'react';
import { X, Loader2, Settings, Clock, MessageSquare, Zap } from 'lucide-react';

interface ConfigureAIDeploymentDialogProps {
    deploymentId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
}

interface DeploymentConfig {
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

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo'];

export function ConfigureAIDeploymentDialog({
    deploymentId,
    onClose,
    onSuccess
}: ConfigureAIDeploymentDialogProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'schedule' | 'behavior' | 'messages'>('schedule');

    const [config, setConfig] = useState<DeploymentConfig>({
        schedule_enabled: false,
        schedule_start_time: '09:00',
        schedule_end_time: '17:00',
        schedule_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        schedule_timezone: 'UTC',
        auto_respond: true,
        handoff_enabled: true,
        max_messages_before_handoff: 10,
        welcome_message: '',
        handoff_message: '',
        away_message: '',
        priority_mode: 'normal'
    });

    useEffect(() => {
        if (deploymentId) {
            loadDeployment();
        } else {
            setLoading(false);
        }
    }, [deploymentId]);

    const loadDeployment = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/api/ai/deployments?id=${deploymentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.deployments.length > 0) {
                const deployment = data.deployments[0];
                setConfig({
                    schedule_enabled: deployment.schedule_enabled || false,
                    schedule_start_time: deployment.schedule_start_time || '09:00',
                    schedule_end_time: deployment.schedule_end_time || '17:00',
                    schedule_days: deployment.schedule_days || [],
                    schedule_timezone: deployment.schedule_timezone || 'UTC',
                    auto_respond: deployment.auto_respond ?? true,
                    handoff_enabled: deployment.handoff_enabled ?? true,
                    max_messages_before_handoff: deployment.max_messages_before_handoff || 10,
                    welcome_message: deployment.welcome_message || '',
                    handoff_message: deployment.handoff_message || '',
                    away_message: deployment.away_message || '',
                    priority_mode: deployment.priority_mode || 'normal'
                });
            }
        } catch (error) {
            console.error('Failed to load deployment:', error);
            alert('Failed to load deployment configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!deploymentId) return;

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/api/ai/deployments/${deploymentId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                alert('AI deployment configured successfully');
                onSuccess?.();
                onClose();
            } else {
                alert(data.error || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Failed to save configuration:', error);
            alert('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: string) => {
        setConfig(prev => ({
            ...prev,
            schedule_days: prev.schedule_days.includes(day)
                ? prev.schedule_days.filter(d => d !== day)
                : [...prev.schedule_days, day]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Settings className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Configure AI Deployment</h2>
                            <p className="text-sm text-gray-600 mt-0.5">Customize behavior, schedule, and messages</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'schedule'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Clock className="h-4 w-4 inline mr-2" />
                        Schedule
                    </button>
                    <button
                        onClick={() => setActiveTab('behavior')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'behavior'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Zap className="h-4 w-4 inline mr-2" />
                        Behavior
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'messages'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <MessageSquare className="h-4 w-4 inline mr-2" />
                        Messages
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading configuration...</p>
                        </div>
                    ) : (
                        <>
                            {/* Schedule Tab */}
                            {activeTab === 'schedule' && (
                                <div className="space-y-6">
                                    {/* Schedule Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">Enable Schedule</h3>
                                            <p className="text-sm text-gray-600">AI will only respond during scheduled hours</p>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, schedule_enabled: !prev.schedule_enabled }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.schedule_enabled ? 'bg-blue-600' : 'bg-gray-300'
                                                }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.schedule_enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {config.schedule_enabled && (
                                        <>
                                            {/* Time Range */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Start Time
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={config.schedule_start_time}
                                                        onChange={(e) => setConfig(prev => ({ ...prev, schedule_start_time: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        End Time
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={config.schedule_end_time}
                                                        onChange={(e) => setConfig(prev => ({ ...prev, schedule_end_time: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>

                                            {/* Days of Week */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Active Days
                                                </label>
                                                <div className="grid grid-cols-7 gap-2">
                                                    {DAYS_OF_WEEK.map(day => (
                                                        <button
                                                            key={day}
                                                            onClick={() => toggleDay(day)}
                                                            className={`px-2 py-2 text-sm font-medium rounded-lg transition-colors ${config.schedule_days.includes(day)
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {day.slice(0, 3)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Timezone */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Timezone
                                                </label>
                                                <select
                                                    value={config.schedule_timezone}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, schedule_timezone: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    {TIMEZONES.map(tz => (
                                                        <option key={tz} value={tz}>{tz}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Priority Mode */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Priority Mode
                                        </label>
                                        <select
                                            value={config.priority_mode}
                                            onChange={(e) => setConfig(prev => ({ ...prev, priority_mode: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="normal">Normal - AI during schedule, human otherwise</option>
                                            <option value="always_ai">Always AI - AI handles all messages</option>
                                            <option value="always_human">Always Human - Human handles all messages</option>
                                            <option value="schedule">Schedule Only - AI only during scheduled hours</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Controls AI behavior when schedule is {config.schedule_enabled ? 'enabled' : 'disabled'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Behavior Tab */}
                            {activeTab === 'behavior' && (
                                <div className="space-y-6">
                                    {/* Auto Respond */}
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">Auto Respond</h3>
                                            <p className="text-sm text-gray-600">AI automatically responds to incoming messages</p>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, auto_respond: !prev.auto_respond }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.auto_respond ? 'bg-green-600' : 'bg-gray-300'
                                                }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.auto_respond ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {/* Handoff */}
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">Enable Handoff</h3>
                                            <p className="text-sm text-gray-600">Transfer to human agent when needed</p>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, handoff_enabled: !prev.handoff_enabled }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.handoff_enabled ? 'bg-green-600' : 'bg-gray-300'
                                                }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.handoff_enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {config.handoff_enabled && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Max Messages Before Handoff
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={config.max_messages_before_handoff}
                                                onChange={(e) => setConfig(prev => ({ ...prev, max_messages_before_handoff: parseInt(e.target.value) }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                AI will hand off to human after this many message exchanges
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Messages Tab */}
                            {activeTab === 'messages' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Welcome Message
                                        </label>
                                        <textarea
                                            value={config.welcome_message}
                                            onChange={(e) => setConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
                                            placeholder="Hi! I'm your AI assistant. How can I help you today?"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Sent when starting a new conversation
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Handoff Message
                                        </label>
                                        <textarea
                                            value={config.handoff_message}
                                            onChange={(e) => setConfig(prev => ({ ...prev, handoff_message: e.target.value }))}
                                            placeholder="Let me connect you with a human agent who can better assist you."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Sent before transferring to a human agent
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Away Message
                                        </label>
                                        <textarea
                                            value={config.away_message}
                                            onChange={(e) => setConfig(prev => ({ ...prev, away_message: e.target.value }))}
                                            placeholder="We're currently unavailable. We'll get back to you during business hours."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Sent when outside scheduled hours
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Configuration'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
