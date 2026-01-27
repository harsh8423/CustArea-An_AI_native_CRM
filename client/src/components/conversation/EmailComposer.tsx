"use client"

import { useState, useEffect } from "react";
import { Send, RefreshCw, User } from "lucide-react";
import { api } from "@/lib/api";

interface EmailComposerProps {
    conversationId: string;
    defaultSubject?: string;
    recipientEmail: string;
    onSent?: () => void;
}

interface SenderAddress {
    email: string;
    displayName: string;
    isDefault: boolean;
}

export function EmailComposer({ conversationId, defaultSubject, recipientEmail, onSent }: EmailComposerProps) {
    const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
    const [form, setForm] = useState({
        from: "",
        subject: defaultSubject ? `RE: ${defaultSubject}` : "",
        body: ""
    });
    const [sending, setSending] = useState(false);
    const [showCCBCC, setShowCCBCC] = useState(false);
    const [cc, setCC] = useState("");
    const [bcc, setBCC] = useState("");

    useEffect(() => {
        fetchSenderAddresses();
    }, []);

    const fetchSenderAddresses = async () => {
        try {
            const data = await api.conversationEmail.getSenderAddresses();
            setSenderAddresses(data.senderAddresses || []);

            const defaultAddr = data.senderAddresses?.find((addr: SenderAddress) => addr.isDefault);
            if (defaultAddr) {
                setForm(prev => ({ ...prev, from: defaultAddr.email }));
            } else if (data.senderAddresses?.length > 0) {
                setForm(prev => ({ ...prev, from: data.senderAddresses[0].email }));
            }
        } catch (err) {
            console.error("Failed to fetch sender addresses:", err);
        }
    };

    const handleSend = async () => {
        if (!form.subject.trim() || !form.body.trim()) {
            alert("Subject and body are required");
            return;
        }

        setSending(true);
        try {
            await api.conversationEmail.sendEmail({
                from: form.from,
                to: recipientEmail,
                subject: form.subject,
                body: form.body,
                cc: cc || undefined,
                bcc: bcc || undefined,
                conversationId
            });

            setForm(prev => ({ ...prev, subject: defaultSubject ? `RE: ${defaultSubject}` : "", body: "" }));
            setCC("");
            setBCC("");
            setShowCCBCC(false);
            onSent?.();
        } catch (err: any) {
            console.error("Failed to send email:", err);
            alert(`Failed to send email: ${err.message || "Unknown error"}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Sender Selection */}
            <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">From</label>
                <select
                    value={form.from}
                    onChange={(e) => setForm(prev => ({ ...prev, from: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                    {senderAddresses.map((addr) => (
                        <option key={addr.email} value={addr.email}>
                            {addr.displayName}
                        </option>
                    ))}
                </select>
            </div>

            {/* Subject */}
            <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
                <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
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

            {/* CC/BCC */}
            {showCCBCC && (
                <div className="space-y-2">
                    <input
                        type="text"
                        value={cc}
                        onChange={(e) => setCC(e.target.value)}
                        placeholder="CC"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <input
                        type="text"
                        value={bcc}
                        onChange={(e) => setBCC(e.target.value)}
                        placeholder="BCC"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </div>
            )}

            {/* Body and Send */}
            <div className="flex items-end gap-3">
                <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
                    <textarea
                        value={form.body}
                        onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Type your message..."
                        rows={3}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                    />
                </div>
                <button
                    onClick={handleSend}
                    disabled={sending || !form.subject.trim() || !form.body.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm h-[38px]"
                >
                    {sending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            <span className="text-sm font-medium">Send</span>
                        </>
                    )}
                </button>
            </div>

            <p className="text-[10px] text-gray-400">
                Press Ctrl+Enter to send
            </p>
        </div>
    );
}
