"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Mail, MessageCircle, Phone, Search, MoreHorizontal,
    Send, Paperclip, Smile, Star, ChevronDown, ChevronUp,
    User, Tag, Edit, MessageSquare, RefreshCw, Check, Sparkles
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    direction: string;
    role: string;
    channel: string;
    content_text: string;
    content_html: string;
    status: string;
    created_at: string;
    attachments: any[];
}

type TabType = "open" | "pending" | "resolved";

const CHANNEL_ICONS: Record<string, typeof Mail> = {
    email: Mail,
    whatsapp: MessageCircle,
    widget: MessageSquare,
    phone: Phone
};

const CHANNEL_COLORS: Record<string, string> = {
    email: "from-orange-400 to-orange-600",
    whatsapp: "from-green-400 to-green-600",
    widget: "from-purple-400 to-purple-600",
    phone: "from-blue-400 to-blue-600"
};

const CHANNEL_BG: Record<string, string> = {
    email: "bg-gradient-to-br from-orange-400 to-orange-600",
    whatsapp: "bg-gradient-to-br from-green-400 to-green-600",
    widget: "bg-gradient-to-br from-purple-400 to-purple-600",
    phone: "bg-gradient-to-br from-blue-400 to-blue-600"
};

export default function ConversationPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("open");
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDetails, setShowDetails] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [detailsTab, setDetailsTab] = useState<"details" | "copilot">("details");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = useCallback(async () => {
        setLoading(true);
        try {
            const [convRes, statsRes] = await Promise.all([
                api.conversations.list({ status: activeTab, limit: 50 }),
                api.conversations.getStats()
            ]);
            setConversations(convRes.conversations || []);
            setStats(statsRes.stats);
        } catch (err) {
            console.error("Failed to fetch conversations:", err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

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
        fetchConversations();
    }, [fetchConversations]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSelectConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation) return;
        setSending(true);
        try {
            await api.conversations.sendMessage(selectedConversation.id, { contentText: newMessage });
            setNewMessage("");
            await fetchMessages(selectedConversation.id);
        } catch (err) {
            console.error("Failed to send message:", err);
        } finally {
            setSending(false);
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!selectedConversation) return;
        try {
            await api.conversations.update(selectedConversation.id, { status });
            fetchConversations();
            setSelectedConversation(prev => prev ? { ...prev, status } : null);
        } catch (err) {
            console.error("Failed to update status:", err);
        }
    };

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

    const getChannelIcon = (channel: string) => {
        const Icon = CHANNEL_ICONS[channel] || MessageSquare;
        return Icon;
    };

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const search = searchQuery.toLowerCase();
        return (
            (conv.contact_name?.toLowerCase().includes(search)) ||
            (conv.contact_email?.toLowerCase().includes(search)) ||
            (conv.subject?.toLowerCase().includes(search)) ||
            (conv.channel_contact_id?.toLowerCase().includes(search))
        );
    });

    const tabCounts = {
        open: stats?.open_count || 0,
        pending: stats?.pending_count || 0,
        resolved: stats?.resolved_count || 0
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 flex gap-4 overflow-hidden">

                {/* Left Panel - Conversation List */}
                <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-gray-900 text-lg">Inbox</h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {filteredConversations.length} conversations
                                </p>
                            </div>
                            <button
                                onClick={fetchConversations}
                                className="p-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                            >
                                <RefreshCw className={cn(
                                    "h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors",
                                    loading && "animate-spin"
                                )} />
                            </button>
                        </div>

                        {/* Mini Tabs */}
                        <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                            {(["open", "pending", "resolved"] as TabType[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                                        activeTab === tab
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    <span className={cn(
                                        "ml-1.5 px-1.5 py-0.5 rounded-md text-[10px]",
                                        activeTab === tab
                                            ? "bg-blue-50 text-blue-600"
                                            : "bg-gray-100 text-gray-400"
                                    )}>
                                        {tabCounts[tab]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-5 pb-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all duration-200 placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    {/* Conversation List */}
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
                                    <MessageSquare className="h-5 w-5 text-gray-300" />
                                </div>
                                <p className="text-sm font-medium text-gray-500">No conversations</p>
                                <p className="text-xs text-gray-400 mt-1">Messages will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredConversations.map((conv) => {
                                    const ChannelIcon = getChannelIcon(conv.channel);
                                    const isSelected = selectedConversation?.id === conv.id;

                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={cn(
                                                "w-full px-3 py-3 flex items-start gap-3 rounded-xl transition-all duration-200 text-left group",
                                                isSelected
                                                    ? "bg-gradient-to-r from-blue-50 to-indigo-50"
                                                    : "hover:bg-gray-50"
                                            )}
                                        >
                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                <div className={cn(
                                                    "h-11 w-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm",
                                                    CHANNEL_BG[conv.channel] || "bg-gradient-to-br from-gray-400 to-gray-600"
                                                )}>
                                                    {conv.contact_name?.charAt(0).toUpperCase() || conv.channel.charAt(0).toUpperCase()}
                                                </div>
                                                <div className={cn(
                                                    "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-lg flex items-center justify-center shadow-sm",
                                                    CHANNEL_BG[conv.channel] || "bg-gray-500"
                                                )}>
                                                    <ChannelIcon className="h-2.5 w-2.5 text-white" />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={cn(
                                                        "font-medium truncate text-sm",
                                                        isSelected ? "text-gray-900" : "text-gray-700"
                                                    )}>
                                                        {conv.contact_name || conv.channel_contact_id || "Unknown"}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                                                        {conv.last_message_at ? formatTime(conv.last_message_at) : formatTime(conv.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate mt-1">
                                                    {conv.subject || `${conv.channel.charAt(0).toUpperCase() + conv.channel.slice(1)} conversation`}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Panel - Message Thread */}
                <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden min-w-0">
                    {selectedConversation ? (
                        <>
                            {/* Thread Header */}
                            <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm",
                                        CHANNEL_BG[selectedConversation.channel] || "bg-gray-500"
                                    )}>
                                        {selectedConversation.contact_name?.charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            {selectedConversation.contact_name || selectedConversation.channel_contact_id}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium",
                                                selectedConversation.channel === 'email' && "bg-orange-50 text-orange-600",
                                                selectedConversation.channel === 'whatsapp' && "bg-green-50 text-green-600",
                                                selectedConversation.channel === 'widget' && "bg-purple-50 text-purple-600",
                                                selectedConversation.channel === 'phone' && "bg-blue-50 text-blue-600",
                                            )}>
                                                {(() => {
                                                    const Icon = getChannelIcon(selectedConversation.channel);
                                                    return <Icon className="h-2.5 w-2.5" />;
                                                })()}
                                                {selectedConversation.channel.charAt(0).toUpperCase() + selectedConversation.channel.slice(1)}
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-md text-[10px] font-medium",
                                                selectedConversation.status === 'open' && "bg-emerald-50 text-emerald-600",
                                                selectedConversation.status === 'pending' && "bg-amber-50 text-amber-600",
                                                selectedConversation.status === 'resolved' && "bg-gray-100 text-gray-500",
                                            )}>
                                                {selectedConversation.status.charAt(0).toUpperCase() + selectedConversation.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200">
                                        <Star className="h-4 w-4 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className={cn(
                                            "p-2.5 rounded-xl transition-all duration-200",
                                            showDetails ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100 text-gray-400"
                                        )}
                                    >
                                        <User className="h-4 w-4" />
                                    </button>
                                    <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200">
                                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50/30 to-gray-50/50">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                                            <span className="text-xs text-gray-400">Loading messages...</span>
                                        </div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                                            <MessageSquare className="h-7 w-7 text-gray-300" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-500">No messages yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Start the conversation below</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isOutbound = msg.direction === "outbound";
                                        const isAI = msg.role === "ai";
                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex",
                                                    isOutbound ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <div className={cn(
                                                    "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                                                    isOutbound
                                                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md"
                                                        : "bg-white text-gray-800 rounded-bl-md"
                                                )}>
                                                    {isAI && !isOutbound && (
                                                        <div className="flex items-center gap-1.5 mb-2 text-xs text-purple-500 font-medium">
                                                            <Sparkles className="h-3 w-3" />
                                                            AI Assistant
                                                        </div>
                                                    )}
                                                    {msg.content_html ? (
                                                        <div
                                                            className="text-sm prose prose-sm max-w-none"
                                                            dangerouslySetInnerHTML={{ __html: msg.content_html }}
                                                        />
                                                    ) : (
                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content_text}</p>
                                                    )}
                                                    <div className={cn(
                                                        "flex items-center gap-1.5 mt-2",
                                                        isOutbound ? "justify-end" : "justify-start"
                                                    )}>
                                                        <span className={cn(
                                                            "text-[10px] font-medium",
                                                            isOutbound ? "text-blue-200" : "text-gray-300"
                                                        )}>
                                                            {formatTime(msg.created_at)}
                                                        </span>
                                                        {isOutbound && msg.status === "delivered" && (
                                                            <Check className="h-3 w-3 text-blue-200" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Composer */}
                            <div className="px-6 py-4 bg-white">
                                <div className="flex items-end gap-3">
                                    <div className="flex-1 relative">
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Type your message..."
                                            rows={1}
                                            className="w-full px-4 py-3.5 pr-24 text-sm bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white resize-none transition-all duration-200 placeholder:text-gray-300"
                                        />
                                        <div className="absolute right-3 bottom-3 flex items-center gap-0.5">
                                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200">
                                                <Paperclip className="h-4 w-4 text-gray-400" />
                                            </button>
                                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200">
                                                <Smile className="h-4 w-4 text-gray-400" />
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || sending}
                                        className="px-5 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-500/20"
                                    >
                                        {sending ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mb-5 shadow-sm">
                                <MessageSquare className="h-9 w-9 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">Select a conversation</h3>
                            <p className="text-sm text-gray-400">Choose from your inbox on the left</p>
                        </div>
                    )}
                </div>

                {/* Right Panel - Details */}
                {showDetails && selectedConversation && (
                    <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                        {/* Mini Tabs */}
                        <div className="p-4">
                            <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                                <button
                                    onClick={() => setDetailsTab("details")}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                                        detailsTab === "details"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setDetailsTab("copilot")}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5",
                                        detailsTab === "copilot"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Copilot
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                            {detailsTab === "details" ? (
                                <>
                                    {/* Channel Badge */}
                                    <div className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl",
                                        selectedConversation.channel === 'email' && "bg-orange-50",
                                        selectedConversation.channel === 'whatsapp' && "bg-green-50",
                                        selectedConversation.channel === 'widget' && "bg-purple-50",
                                        selectedConversation.channel === 'phone' && "bg-blue-50",
                                    )}>
                                        {(() => {
                                            const ChannelIcon = getChannelIcon(selectedConversation.channel);
                                            return <ChannelIcon className={cn(
                                                "h-5 w-5",
                                                selectedConversation.channel === 'email' && "text-orange-500",
                                                selectedConversation.channel === 'whatsapp' && "text-green-500",
                                                selectedConversation.channel === 'widget' && "text-purple-500",
                                                selectedConversation.channel === 'phone' && "text-blue-500",
                                            )} />;
                                        })()}
                                        <div>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {selectedConversation.channel.charAt(0).toUpperCase() + selectedConversation.channel.slice(1)}
                                            </span>
                                            <p className="text-[10px] text-gray-500">Channel</p>
                                        </div>
                                    </div>

                                    {/* User Data */}
                                    <div className="bg-gray-50 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center">
                                                    <User className="h-3.5 w-3.5 text-orange-600" />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900">User data</span>
                                            </div>
                                        </div>
                                        <div className="px-4 pb-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-400">Name</span>
                                                <span className="text-xs font-medium text-gray-700">
                                                    {selectedConversation.contact_name || "—"}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-400">Status</span>
                                                <select
                                                    value={selectedConversation.status}
                                                    onChange={(e) => handleStatusChange(e.target.value)}
                                                    className="text-xs px-2 py-1 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                >
                                                    <option value="open">Open</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="resolved">Resolved</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-400">Contact</span>
                                                <span className="text-xs text-blue-500 truncate max-w-[140px]">
                                                    {selectedConversation.channel_contact_id || "—"}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-400">AI Enabled</span>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-md font-medium",
                                                    selectedConversation.ai_enabled
                                                        ? "bg-emerald-100 text-emerald-600"
                                                        : "bg-gray-100 text-gray-500"
                                                )}>
                                                    {selectedConversation.ai_enabled ? "Yes" : "No"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Collapsible Sections */}
                                    <div className="space-y-2">
                                        <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-medium text-gray-700">Recent conversations</span>
                                            </div>
                                            <ChevronDown className="h-4 w-4 text-gray-300" />
                                        </button>
                                        <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200">
                                            <div className="flex items-center gap-2">
                                                <Edit className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-medium text-gray-700">User notes</span>
                                            </div>
                                            <ChevronDown className="h-4 w-4 text-gray-300" />
                                        </button>
                                        <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200">
                                            <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-medium text-gray-700">User tags</span>
                                            </div>
                                            <ChevronDown className="h-4 w-4 text-gray-300" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center mb-4">
                                        <Sparkles className="h-6 w-6 text-purple-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600">AI Copilot</p>
                                    <p className="text-xs text-gray-400 mt-1 text-center px-4">Get AI-powered suggestions and insights</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
