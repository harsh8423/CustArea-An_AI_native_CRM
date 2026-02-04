"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';

interface GrantChannelAccessDialogProps {
    userId: string;
    currentAccess: {
        inbound_emails: Array<{ id: string; email_address: string }>;
        outbound_emails: Array<{ id: string; email_address: string }>;
        phone_numbers: Array<{ id: string; phone_number: string }>;
    };
    onClose: () => void;
    onSuccess: () => void;
}

export function GrantChannelAccessDialog({ userId, currentAccess, onClose, onSuccess }: GrantChannelAccessDialogProps) {
    const [availableInbound, setAvailableInbound] = useState<any[]>([]);
    const [availableOutbound, setAvailableOutbound] = useState<any[]>([]);
    const [availablePhones, setAvailablePhones] = useState<any[]>([]);

    const [selectedInbound, setSelectedInbound] = useState<string[]>(
        currentAccess.inbound_emails.map(e => e.id)
    );
    const [selectedOutbound, setSelectedOutbound] = useState<string[]>(
        currentAccess.outbound_emails.map(e => e.id)
    );
    const [selectedPhones, setSelectedPhones] = useState<string[]>(
        currentAccess.phone_numbers.map(p => p.id)
    );

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'phone'>('outbound');

    useEffect(() => {
        fetchChannelOptions();
    }, []);

    const fetchChannelOptions = async () => {
        try {
            setLoading(true);

            // Fetch available inbound emails
            const inboundData = await rbacApi.channels.getInboundEmails();
            setAvailableInbound(inboundData.inbound_emails || []);

            // Fetch available outbound emails
            const outboundData = await rbacApi.channels.getOutboundEmails();
            setAvailableOutbound(outboundData.outbound_emails || []);

            // Fetch available phones
            const phoneData = await rbacApi.channels.getPhones();
            setAvailablePhones(phoneData.phones || []);
        } catch (err) {
            console.error('Failed to fetch channel options:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Build outbound email configs
            const outboundEmailConfigs = selectedOutbound.map(id => {
                const email = availableOutbound.find(e => e.id === id);
                return {
                    email_type: email.type || 'connection',
                    email_connection_id: email.connection_id || null,
                    ses_identity_id: email.ses_identity_id || null,
                    allowed_from_email_id: email.allowed_from_email_id || id
                };
            });

            await rbacApi.users.grantChannelAccess(userId, {
                inboundEmailIds: selectedInbound,
                outboundEmailConfigs,
                phoneConfigIds: selectedPhones,
                whatsappAccountIds: [] // TODO: Add WhatsApp support
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to grant channel access:', err);
            alert(`Failed to grant channel access: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const toggleInbound = (id: string) => {
        setSelectedInbound(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleOutbound = (id: string) => {
        setSelectedOutbound(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const togglePhone = (id: string) => {
        setSelectedPhones(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading channels...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Grant Channel Access</h2>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 border-b">
                    <button
                        onClick={() => setActiveTab('outbound')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'outbound'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Outbound Emails ({selectedOutbound.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('inbound')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'inbound'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Inbound Emails ({selectedInbound.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('phone')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'phone'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Phone Numbers ({selectedPhones.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                    {activeTab === 'inbound' && (
                        <>
                            {availableInbound.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    No inbound email addresses configured
                                </p>
                            ) : (
                                availableInbound.map(email => (
                                    <label
                                        key={email.id}
                                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedInbound.includes(email.id)}
                                            onChange={() => toggleInbound(email.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-3 font-medium text-gray-900">{email.email_address}</span>
                                    </label>
                                ))
                            )}
                        </>
                    )}

                    {activeTab === 'outbound' && (
                        <>
                            {availableOutbound.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    No outbound email addresses configured
                                </p>
                            ) : (
                                availableOutbound.map(email => (
                                    <label
                                        key={email.id}
                                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedOutbound.includes(email.id)}
                                            onChange={() => toggleOutbound(email.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="ml-3">
                                            <span className="font-medium text-gray-900">{email.email_address}</span>
                                            {email.provider && (
                                                <span className="ml-2 text-xs text-gray-500">({email.provider})</span>
                                            )}
                                        </div>
                                    </label>
                                ))
                            )}
                        </>
                    )}

                    {activeTab === 'phone' && (
                        <>
                            {availablePhones.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    No phone numbers configured
                                </p>
                            ) : (
                                availablePhones.map(phone => (
                                    <label
                                        key={phone.id}
                                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPhones.includes(phone.id)}
                                            onChange={() => togglePhone(phone.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-3 font-medium text-gray-900">{phone.phone_number}</span>
                                    </label>
                                ))
                            )}
                        </>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            'Grant Access'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
