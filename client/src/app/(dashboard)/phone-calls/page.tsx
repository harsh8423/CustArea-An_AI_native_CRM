"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Phone, Search, RefreshCw, MessageSquare
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { PhoneLogView } from "@/components/conversation/PhoneLogView";

// Dynamic import PhoneModal to avoid SSR issues with Twilio SDK
const PhoneModal = dynamic(() => import('@/components/PhoneModal'), { ssr: false });

interface Conversation {
    id: string;
    tenant_id: string;
    contact_id: string;
    channel: string;
    channel_contact_id: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    ai_enabled: boolean;
    subject: string | null;
    last_message_at: string;
    created_at: string;
    contact_name: string | null;
    contact_email: string | null;
    assigned_to_name: string | null;
}

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    content_text: string;
    created_at: string;
    metadata?: any;
}

export default function PhoneCallsPage() {
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab") || "dialer";

    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [phoneConversations, setPhoneConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchPhoneConversations = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch conversations with phone channel
            const res = await api.conversations.list({ channel: 'phone', limit: 50 });
            setPhoneConversations(res.conversations || []);

            // Auto-select first conversation if none selected
            if (!selectedConversation && res.conversations?.length > 0) {
                setSelectedConversation(res.conversations[0]);
            }
        } catch (err) {
            console.error("Failed to fetch phone conversations:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedConversation]);

    const fetchMessages = useCallback(async (conversationId: string) => {
        setLoadingMessages(true);
        try {
            const res = await api.conversations.getMessages(conversationId, { limit: 50 });
            setMessages(res.messages || []);
        } catch (err) {
            console.error("Failed to fetch messages:", err);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "logs") {
            fetchPhoneConversations();
        }
    }, [tab, fetchPhoneConversations]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation, fetchMessages]);

    const filteredConversations = phoneConversations.filter(conv => {
        if (!searchQuery) return true;
        const search = searchQuery.toLowerCase();
        return (
            (conv.contact_name?.toLowerCase().includes(search)) ||
            (conv.channel_contact_id?.toLowerCase().includes(search)) ||
            (conv.subject?.toLowerCase().includes(search))
        );
    });

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return `${diffDays}d`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 flex gap-4 overflow-hidden">
                {tab === "dialer" ? (
                    // Dialer Tab - Single panel with centered content
                    <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50 border-b border-gray-100">
                            <div>
                                <h3 className="font-semibold text-gray-900">Phone Dialer</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Make calls with Human or AI agents</p>
                            </div>
                            <button
                                onClick={() => setShowPhoneModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white rounded-xl transition-all duration-200 text-sm font-medium flex items-center gap-2"
                            >
                                <Phone className="h-4 w-4" />
                                Open Dialer
                            </button>
                        </div>

                        {/* Dialer Content */}
                        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-gray-50/30 to-gray-50/50">
                            <div className="text-center max-w-md">
                                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-5 shadow-lg mx-auto">
                                    <Phone className="h-9 w-9 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-600 mb-2">Make a Phone Call</h3>
                                <p className="text-sm text-gray-400 mb-6">Click the button above to open the dialer and make calls with Human or AI agents</p>
                                <button
                                    onClick={() => setShowPhoneModal(true)}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white rounded-xl transition-all duration-200 font-medium flex items-center gap-2 mx-auto shadow-sm shadow-blue-500/20"
                                >
                                    <Phone className="h-5 w-5" />
                                    Open Dialer
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Logs Tab - Two panel layout like conversation page
                    <>
                        {/* Left Panel - Conversation List */}
                        <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-bold text-gray-900 text-lg">Call History</h2>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {filteredConversations.length} {filteredConversations.length === 1 ? 'call' : 'calls'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={fetchPhoneConversations}
                                        className="p-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                                    >
                                        <RefreshCw className={cn(
                                            "h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors",
                                            loading && "animate-spin"
                                        )} />
                                    </button>
                                </div>

                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                                    <input
                                        type="text"
                                        placeholder="Search calls..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all duration-200 placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            {/* Call List */}
                            <div className="flex-1 overflow-y-auto px-3 pb-3">
                                {loading ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                                            <span className="text-xs text-gray-400">Loading...</span>
                                        </div>
                                    </div>
                                ) : filteredConversations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                                        <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                                            <Phone className="h-5 w-5 text-gray-300" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-500">No calls</p>
                                        <p className="text-xs text-gray-400 mt-1">Call history will appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredConversations.map((conv) => {
                                            const isSelected = selectedConversation?.id === conv.id;
                                            return (
                                                <button
                                                    key={conv.id}
                                                    onClick={() => setSelectedConversation(conv)}
                                                    className={cn(
                                                        "w-full px-3 py-3 flex items-start gap-3 rounded-xl transition-all duration-200 text-left",
                                                        isSelected
                                                            ? "bg-gradient-to-r from-blue-50 to-indigo-50"
                                                            : "hover:bg-gray-50"
                                                    )}
                                                >
                                                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm bg-gradient-to-br from-blue-400 to-blue-600">
                                                        {conv.contact_name?.charAt(0).toUpperCase() || "P"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className={cn(
                                                                "font-medium truncate text-sm",
                                                                isSelected ? "text-gray-900" : "text-gray-700"
                                                            )}>
                                                                {conv.contact_name || conv.channel_contact_id || "Unknown"}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                                                                {formatTime(conv.last_message_at || conv.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 truncate mt-1">
                                                            {conv.subject || "Phone call"}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel - Call Details */}
                        <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                            {selectedConversation ? (
                                <>
                                    <div className="px-6 py-4 bg-gradient-to-r from-white to-gray-50/50 border-b border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm bg-gradient-to-br from-blue-400 to-blue-600">
                                                {selectedConversation.contact_name?.charAt(0).toUpperCase() || "P"}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">
                                                    {selectedConversation.contact_name || selectedConversation.channel_contact_id}
                                                </h3>
                                                <p className="text-xs text-gray-400">{selectedConversation.channel_contact_id}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50/30 to-gray-50/50">
                                        {loadingMessages ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="flex flex-col items-center gap-2">
                                                    <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                                                    <span className="text-xs text-gray-400">Loading call logs...</span>
                                                </div>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                                                    <Phone className="h-7 w-7 text-gray-300" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-500">No call logs</p>
                                                <p className="text-xs text-gray-400 mt-1">Call details will appear here</p>
                                            </div>
                                        ) : (
                                            <PhoneLogView messages={messages} />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                    <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mb-5 shadow-sm">
                                        <Phone className="h-9 w-9 text-gray-300" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Select a call</h3>
                                    <p className="text-sm text-gray-400">Choose from call history on the left</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Phone Modal */}
            <PhoneModal
                isOpen={showPhoneModal}
                onClose={() => setShowPhoneModal(false)}
                onCallEnd={fetchPhoneConversations}
            />
        </div>
    );
}
