'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Mail, Phone, MessageCircle, MessageSquare, Plus } from 'lucide-react';

interface CreateDeploymentDialogProps {
    onClose: () => void;
    onSuccess?: () => void;
}

interface EmailAddress {
    id: string;
    email: string;
    is_active: boolean;
}

interface PhoneNumber {
    id: string;
    phone_number: string;
    is_active: boolean;
}

interface WhatsAppAccount {
    id: string;
    phone_number: string;
    display_name: string;
    is_active: boolean;
}

interface WidgetConfig {
    id: string;
    name: string;
    is_active: boolean;
}

export function CreateDeploymentDialog({ onClose, onSuccess }: CreateDeploymentDialogProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState<'email' | 'phone' | 'whatsapp' | 'widget'>('email');

    // Resources
    const [emailAddresses, setEmailAddresses] = useState<EmailAddress[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
    const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>([]);

    // Selected resource
    const [selectedResourceId, setSelectedResourceId] = useState('');

    useEffect(() => {
        loadResources();
    }, []);

    async function loadResources() {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // Load email addresses
            try {
                const emailRes = await fetch('http://localhost:8000/api/channels/email', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (emailRes.ok) {
                    const emailData = await emailRes.json();
                    setEmailAddresses(emailData.filter((e: any) => e.is_active) || []);
                }
            } catch (error) {
                console.error('Failed to load email addresses:', error);
            }

            // Load phone numbers
            try {
                const phoneRes = await fetch('http://localhost:8000/api/channels/phone', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (phoneRes.ok) {
                    const phoneData = await phoneRes.json();
                    // Phone API returns { config: {...} }, not an array
                    if (phoneData.config && phoneData.config.is_active) {
                        setPhoneNumbers([phoneData.config]);
                    } else {
                        setPhoneNumbers([]);
                    }
                }
            } catch (error) {
                console.error('Failed to load phone numbers:', error);
            }

            // Load WhatsApp accounts
            try {
                const whatsappRes = await fetch('http://localhost:8000/api/channels/whatsapp', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (whatsappRes.ok) {
                    const whatsappData = await whatsappRes.json();
                    // WhatsApp API returns { config: {...} }, not an array
                    if (whatsappData.config && whatsappData.config.is_active) {
                        setWhatsappAccounts([whatsappData.config]);
                    } else {
                        setWhatsappAccounts([]);
                    }
                }
            } catch (error) {
                console.error('Failed to load WhatsApp accounts:', error);
            }

            // Load widget configs
            try {
                const widgetRes = await fetch('http://localhost:8000/api/channels/widget', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (widgetRes.ok) {
                    const widgetData = await widgetRes.json();
                    // Widget API returns { config: {...} }, not an array
                    if (widgetData.config && widgetData.config.is_active) {
                        setWidgetConfigs([widgetData.config]);
                    } else {
                        setWidgetConfigs([]);
                    }
                }
            } catch (error) {
                console.error('Failed to load widget configs:', error);
            }

        } catch (error) {
            console.error('Failed to load resources:', error);
            alert('Failed to load channel resources. Please check your permissions.');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!selectedResourceId) {
            alert('Please select a resource');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');

            const payload: any = {
                channel: selectedChannel,
                is_enabled: true,
                schedule_enabled: false,
                auto_respond: true,
                handoff_enabled: true,
                priority_mode: 'normal'
            };

            // Set the appropriate resource ID based on channel
            if (selectedChannel === 'email') {
                payload.allowed_inbound_email_id = selectedResourceId;
            } else if (selectedChannel === 'phone') {
                payload.phone_config_id = selectedResourceId;
            } else if (selectedChannel === 'whatsapp') {
                payload.whatsapp_account_id = selectedResourceId;
            } else if (selectedChannel === 'widget') {
                payload.widget_config_id = selectedResourceId;
            }

            const response = await fetch('http://localhost:8000/api/ai/deployments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                alert('AI Deployment created successfully!');
                onSuccess?.();
                onClose();
            } else {
                alert(data.error || 'Failed to create deployment');
            }
        } catch (error) {
            console.error('Failed to create deployment:', error);
            alert('Failed to create deployment');
        } finally {
            setSaving(false);
        }
    }

    const getAvailableResources = () => {
        switch (selectedChannel) {
            case 'email':
                return emailAddresses;
            case 'phone':
                return phoneNumbers;
            case 'whatsapp':
                return whatsappAccounts;
            case 'widget':
                return widgetConfigs;
            default:
                return [];
        }
    };

    const getResourceDisplay = (resource: any) => {
        if (selectedChannel === 'email') return resource.email;
        if (selectedChannel === 'phone') return resource.phone_number;
        if (selectedChannel === 'whatsapp') return `${resource.display_name} (${resource.phone_number})`;
        if (selectedChannel === 'widget') return resource.name;
        return '';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Plus className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Create AI Deployment</h2>
                            <p className="text-sm text-gray-600 mt-0.5">Deploy AI to a specific resource</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading resources...</p>
                        </div>
                    ) : (
                        <>
                            {/* Channel Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Select Channel
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedChannel('email');
                                            setSelectedResourceId('');
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${selectedChannel === 'email'
                                            ? 'border-orange-500 bg-orange-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Mail className={`h-6 w-6 mx-auto mb-2 ${selectedChannel === 'email' ? 'text-orange-600' : 'text-gray-400'
                                            }`} />
                                        <p className="text-sm font-medium">Email</p>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedChannel('phone');
                                            setSelectedResourceId('');
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${selectedChannel === 'phone'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Phone className={`h-6 w-6 mx-auto mb-2 ${selectedChannel === 'phone' ? 'text-blue-600' : 'text-gray-400'
                                            }`} />
                                        <p className="text-sm font-medium">Phone</p>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedChannel('whatsapp');
                                            setSelectedResourceId('');
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${selectedChannel === 'whatsapp'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <MessageCircle className={`h-6 w-6 mx-auto mb-2 ${selectedChannel === 'whatsapp' ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                        <p className="text-sm font-medium">WhatsApp</p>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedChannel('widget');
                                            setSelectedResourceId('');
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all ${selectedChannel === 'widget'
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <MessageSquare className={`h-6 w-6 mx-auto mb-2 ${selectedChannel === 'widget' ? 'text-purple-600' : 'text-gray-400'
                                            }`} />
                                        <p className="text-sm font-medium">Widget</p>
                                    </button>
                                </div>
                            </div>

                            {/* Resource Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Select {selectedChannel.charAt(0).toUpperCase() + selectedChannel.slice(1)} Resource
                                </label>
                                <select
                                    value={selectedResourceId}
                                    onChange={(e) => setSelectedResourceId(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                >
                                    <option value="">-- Choose a resource --</option>
                                    {getAvailableResources().map((resource: any) => (
                                        <option key={resource.id} value={resource.id}>
                                            {getResourceDisplay(resource)}
                                        </option>
                                    ))}
                                </select>
                                {getAvailableResources().length === 0 && (
                                    <p className="text-sm text-amber-600 mt-2">
                                        ⚠️ No active {selectedChannel} resources found. Please configure them in Channels settings first.
                                    </p>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> After creating the deployment, you can configure schedule, behavior, and messages by clicking the "Configure" button.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={saving || loading || !selectedResourceId}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5" />
                                Create Deployment
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
