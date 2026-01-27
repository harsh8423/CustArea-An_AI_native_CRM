"use client"

import { useState, useEffect } from "react";
import { X, Mail, Send, User, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface ComposeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface SenderAddress {
    email: string;
    provider: string;
    displayName: string;
    connectionId?: string;
    identityId?: string;
    isDefault: boolean;
}

export function ComposeEmailModal({ isOpen, onClose, onSuccess }: ComposeEmailModalProps) {
    const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const [form, setForm] = useState({
        from: "",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: ""
    });

    const [showCCBCC, setShowCCBCC] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSenderAddresses();
        }
    }, [isOpen]);

    const fetchSenderAddresses = async () => {
        setLoading(true);
        try {
            const data = await api.conversationEmail.getSenderAddresses();
            setSenderAddresses(data.senderAddresses || []);

            // Set default sender
            const defaultAddr = data.senderAddresses?.find((addr: SenderAddress) => addr.isDefault);
            if (defaultAddr) {
                setForm(prev => ({ ...prev, from: defaultAddr.email }));
            } else if (data.senderAddresses?.length > 0) {
                setForm(prev => ({ ...prev, from: data.senderAddresses[0].email }));
            }
        } catch (err) {
            console.error("Failed to fetch sender addresses:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!form.to || !form.from || !form.subject || !form.body) {
            alert("Please fill in all required fields");
            return;
        }

        setSending(true);
        try {
            await api.conversationEmail.sendEmail({
                from: form.from,
                to: form.to,
                cc: form.cc || undefined,
                bcc: form.bcc || undefined,
                subject: form.subject,
                body: form.body
            });

            // Reset form
            setForm({
                from: senderAddresses.find(a => a.isDefault)?.email || senderAddresses[0]?.email || "",
                to: "",
                cc: "",
                bcc: "",
                subject: "",
                body: ""
            });

            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error("Failed to send email:", err);
            alert(`Failed to send email: ${err.message || "Unknown error"}`);
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Compose Email</h3>
                            <p className="text-xs text-gray-500">Send email to any contact</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-sm text-gray-400">Loading sender addresses...</div>
                        </div>
                    ) : senderAddresses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p className="text-sm">No email accounts connected</p>
                            <p className="text-xs mt-1">Please connect Gmail, Outlook, or configure SES first</p>
                        </div>
                    ) : (
                        <>
                            {/* From */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">From</label>
                                <select
                                    value={form.from}
                                    onChange={(e) => setForm(prev => ({ ...prev, from: e.target.value }))}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                >
                                    {senderAddresses.map((addr) => (
                                        <option key={addr.email} value={addr.email}>
                                            {addr.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* To */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">To *</label>
                                <input
                                    type="email"
                                    value={form.to}
                                    onChange={(e) => setForm(prev => ({ ...prev, to: e.target.value }))}
                                    placeholder="recipient@example.com"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                />
                            </div>

                            {/* CC/BCC Toggle */}
                            {!showCCBCC && (
                                <button
                                    onClick={() => setShowCCBCC(true)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    + Add CC/BCC
                                </button>
                            )}

                            {/* CC/BCC Fields */}
                            {showCCBCC && (
                                <>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">CC</label>
                                        <input
                                            type="text"
                                            value={form.cc}
                                            onChange={(e) => setForm(prev => ({ ...prev, cc: e.target.value }))}
                                            placeholder="cc@example.com (comma separated)"
                                            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">BCC</label>
                                        <input
                                            type="text"
                                            value={form.bcc}
                                            onChange={(e) => setForm(prev => ({ ...prev, bcc: e.target.value }))}
                                            placeholder="bcc@example.com (comma separated)"
                                            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Subject */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject *</label>
                                <input
                                    type="text"
                                    value={form.subject}
                                    onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Email subject"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                />
                            </div>

                            {/* Body */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message *</label>
                                <textarea
                                    value={form.body}
                                    onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                                    placeholder="Type your message here..."
                                    rows={8}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || senderAddresses.length === 0}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Send className="h-4 w-4" />
                        {sending ? "Sending..." : "Send Email"}
                    </button>
                </div>
            </div>
        </div>
    );
}
