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
        <div className="space-y-6">
            {/* Sender Selection */}
            <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2 block">From</label>
                <div className="relative">
                    <select
                        value={form.from}
                        onChange={(e) => setForm(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-purple-500/10 transition-all hover:bg-gray-100/80 cursor-pointer appearance-none"
                    >
                        {senderAddresses.map((addr) => (
                            <option key={addr.email} value={addr.email}>
                                {addr.displayName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Subject */}
            <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2 block">Subject</label>
                <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Email subject"
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-purple-500/10 transition-all hover:bg-gray-100/80 placeholder:text-gray-400"
                />
            </div>

            {/* CC/BCC Toggle */}
            {!showCCBCC && (
                <button
                    onClick={() => setShowCCBCC(true)}
                    className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors"
                >
                    + Add CC/BCC
                </button>
            )}

            {/* CC/BCC */}
            {showCCBCC && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div>
                        <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2 block">CC</label>
                        <input
                            type="text"
                            value={cc}
                            onChange={(e) => setCC(e.target.value)}
                            placeholder="CC recipients"
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-purple-500/10 transition-all hover:bg-gray-100/80 placeholder:text-gray-400"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2 block">BCC</label>
                        <input
                            type="text"
                            value={bcc}
                            onChange={(e) => setBCC(e.target.value)}
                            placeholder="BCC recipients"
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-purple-500/10 transition-all hover:bg-gray-100/80 placeholder:text-gray-400"
                        />
                    </div>
                </div>
            )}

            {/* Body and Send */}
            {/* Body and Send */}
            <div className="flex flex-col gap-4">
                <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2 block">Message</label>
                    <textarea
                        value={form.body}
                        onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Type your message..."
                        rows={6}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/10 transition-all hover:bg-gray-100/80 resize-none placeholder:text-gray-400"
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] text-gray-400 font-medium">
                        Press <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Ctrl</span> + <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Enter</span> to send
                    </p>

                    <button
                        onClick={handleSend}
                        disabled={sending || !form.subject.trim() || !form.body.trim()}
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-all disabled:opacity-50 disabled:hover:bg-gray-900 flex items-center gap-2 shadow-lg shadow-gray-900/10 active:scale-95 duration-200"
                    >
                        {sending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <span className="text-sm font-medium">Send Email</span>
                                <Send className="h-3.5 w-3.5" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            <p className="text-[10px] text-gray-400 hidden">
                Press Ctrl+Enter to send
            </p>
        </div>
    );
}
