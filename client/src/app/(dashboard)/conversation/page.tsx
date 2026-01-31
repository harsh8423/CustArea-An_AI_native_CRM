"use client";

import { useFeatures } from "@/contexts/FeatureContext";
import { ComposeEmailModal } from "@/components/conversation/ComposeEmailModal";
import { MessageRenderer } from "@/components/conversation/MessageRenderer";
import { EmailComposer } from "@/components/conversation/EmailComposer";
import { FilterModal } from "@/components/conversation/FilterModal";
import { UnknownContactIndicator } from "@/components/conversation/UnknownContactIndicator";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
    Mail, MessageCircle, Phone, Search, MoreHorizontal,
    Send, Paperclip, Smile, Star, ChevronDown, ChevronUp,
    User, Tag, Edit, MessageSquare, RefreshCw, Check, Sparkles,
    Ticket, X, Zap, Filter as FilterIcon, Trash, Reply, History
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { ReplyDrawer } from "@/components/conversation/ReplyDrawer";
import CopilotPanel from "@/components/conversation/CopilotPanel";



interface Conversation {
    id: string;
    tenant_id: string;
    contact_id: string | null;  // NULL for unknown senders
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
    ticket_id?: string | null;  // Link to ticket if exists
    // NEW: Unknown sender fields
    sender_display_name?: string;
    sender_identifier_type?: string;
    sender_identifier_value?: string;
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
    const { hasFeature } = useFeatures();
    const searchParams = useSearchParams();

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
    const [detailsTab, setDetailsTab] = useState<"details" | "copilot">("copilot");

    const [showComposeEmailModal, setShowComposeEmailModal] = useState(false);
    const [showReplyDrawer, setShowReplyDrawer] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // URL params for auto-opening compose modal with pre-filled data
    const autoCompose = searchParams.get("compose") === "true";
    const prefillTo = searchParams.get("to") || "";
    const prefillContactId = searchParams.get("contactId") || "";
    const prefillName = searchParams.get("name") || "";

    // Filter state
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<{
        channel: 'all' | 'email' | 'whatsapp' | 'widget';
        mailbox: string | null;
        status: string | null;
    }>({
        channel: 'all',
        mailbox: null,
        status: null
    });
    const [mailboxes, setMailboxes] = useState<Array<{ id: string; email: string; description?: string }>>([]);

    // Create ticket from conversation state
    const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
    const [availableMacros, setAvailableMacros] = useState<any[]>([]);
    const [ticketForm, setTicketForm] = useState({
        subject: "",
        notes: "",
        macroId: ""
    });
    const [creatingTicket, setCreatingTicket] = useState(false);

    // Fetch mailboxes on mount
    useEffect(() => {
        const fetchMailboxes = async () => {
            try {
                // Use the same API as ComposeEmailModal
                const res = await api.conversationEmail.getSenderAddresses();
                console.log('[Conversation] Sender addresses response:', res);

                const addresses = res.senderAddresses || [];
                console.log('[Conversation] Sender addresses:', addresses);

                // Transform to match our mailbox interface
                const mailboxList = addresses.map((addr: any) => ({
                    id: addr.connectionId || addr.identityId || addr.email,
                    email: addr.email,
                    description: addr.displayName
                }));

                setMailboxes(mailboxList);
            } catch (err) {
                console.error("Failed to fetch mailboxes:", err);
            }
        };
        fetchMailboxes();
    }, []);

    const fetchConversations = useCallback(async () => {
        setLoading(true);
        try {
            const [convRes, statsRes, macrosRes] = await Promise.all([
                api.conversations.list({ status: activeTab, limit: 50 }),
                api.conversations.getStats(),
                api.macros.list(true)
            ]);

            console.log('[Conversation] Total conversations fetched:', convRes.conversations?.length || 0);
            console.log('[Conversation] Breakdown by channel:',
                (convRes.conversations || []).reduce((acc: any, conv: Conversation) => {
                    acc[conv.channel] = (acc[conv.channel] || 0) + 1;
                    return acc;
                }, {})
            );

            // Filter out phone conversations - they have their own dedicated page
            const nonPhoneConversations = (convRes.conversations || []).filter(
                (conv: Conversation) => conv.channel !== 'phone'
            );

            console.log('[Conversation] After filtering phone:', nonPhoneConversations.length);

            setConversations(nonPhoneConversations);
            setStats(statsRes.stats);
            setAvailableMacros(macrosRes.macros || []);
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

    // Auto-open compose modal if URL params indicate it (from contact page navigation)
    useEffect(() => {
        if (autoCompose && prefillTo) {
            setShowComposeEmailModal(true);
        }
    }, [autoCompose, prefillTo]);

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

    const handleDeleteConversation = async () => {
        if (!selectedConversation) return;
        if (!confirm("Are you sure you want to delete this conversation? This action cannot be undone and will delete all related messages and data.")) return;

        try {
            await api.conversations.delete(selectedConversation.id);
            // Remove from list
            setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
            setSelectedConversation(null);
            setMessages([]);
        } catch (err) {
            console.error("Failed to delete conversation:", err);
            alert("Failed to delete conversation");
        }
    };

    const openCreateTicketModal = () => {
        setTicketForm({
            subject: selectedConversation?.subject || `Ticket from ${selectedConversation?.contact_name || selectedConversation?.channel_contact_id || "conversation"}`,
            notes: "",
            macroId: ""
        });
        setShowCreateTicketModal(true);
    };

    const handleCreateTicket = async () => {
        if (!selectedConversation || !ticketForm.subject.trim()) return;
        setCreatingTicket(true);
        try {
            // Create the ticket linked to this conversation with status open
            const res = await api.tickets.create({
                subject: ticketForm.subject,
                description: ticketForm.notes || undefined,
                contactId: selectedConversation.contact_id || undefined,
                sourceConversationId: selectedConversation.id,
                priority: "normal",
                status: "open"  // Set status to open when creating from conversation
            });

            // If a macro is selected, apply it
            if (ticketForm.macroId && res.ticket?.id) {
                await api.tickets.applyMacro(res.ticket.id, ticketForm.macroId);
            }

            // Update the conversation to link the ticket
            if (res.ticket?.id) {
                await api.conversations.update(selectedConversation.id, { ticketId: res.ticket.id });
                // Update local state to show ticket indicator
                setSelectedConversation(prev => prev ? { ...prev, ticket_id: res.ticket.id } : null);
            }

            setShowCreateTicketModal(false);
            fetchConversations(); // Refresh to get updated ticket_id
            alert(`Ticket #${res.ticket?.ticket_number || ''} created successfully!`);
        } catch (err) {
            console.error("Failed to create ticket:", err);
            alert("Failed to create ticket");
        } finally {
            setCreatingTicket(false);
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
        // Channel filter
        if (filters.channel !== 'all' && conv.channel !== filters.channel) {
            return false;
        }

        // Mailbox filter (only for email conversations)
        if (filters.mailbox && conv.channel === 'email') {
            if (conv.channel_contact_id !== filters.mailbox) {
                return false;
            }
        }

        // Status filter
        if (filters.status && conv.status !== filters.status) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const search = searchQuery.toLowerCase();
            return (
                (conv.contact_name?.toLowerCase().includes(search)) ||
                (conv.contact_email?.toLowerCase().includes(search)) ||
                (conv.subject?.toLowerCase().includes(search)) ||
                (conv.channel_contact_id?.toLowerCase().includes(search))
            );
        }

        return true;
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowComposeEmailModal(true)}
                                    className="p-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:opacity-90 transition shadow-sm"
                                    title="Compose Email"
                                >
                                    <Mail className="h-5 w-5" />
                                </button>
                                <a
                                    href="/email-history"
                                    className="p-2.5 hover:bg-gray-50 text-gray-700 rounded-xl transition"
                                    title="Email History"
                                >
                                    <History className="h-5 w-5" />
                                </a>
                                <button
                                    onClick={fetchConversations}
                                    className="p-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition"
                                    title="Refresh"
                                >
                                    <RefreshCw className={cn(
                                        "h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors",
                                        loading && "animate-spin"
                                    )} />
                                </button>
                            </div>
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

                    {/* Search and Filter */}
                    <div className="px-5 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all duration-200 placeholder:text-gray-300"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilterModal(true)}
                                className={cn(
                                    "relative p-2.5 rounded-xl transition-all duration-200",
                                    (filters.channel !== 'all' || filters.mailbox || filters.status)
                                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm"
                                        : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                )}
                                title="Filter conversations"
                            >
                                <FilterIcon className="h-4 w-4" />
                                {(filters.channel !== 'all' || filters.mailbox || filters.status) && (
                                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {(filters.channel !== 'all' ? 1 : 0) + (filters.mailbox ? 1 : 0) + (filters.status ? 1 : 0)}
                                    </span>
                                )}
                            </button>
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
                                                        {conv.contact_name || conv.sender_display_name || conv.channel_contact_id || "Unknown"}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                                                        {conv.last_message_at ? formatTime(conv.last_message_at) : formatTime(conv.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate mt-1">
                                                    {conv.subject || `${conv.channel.charAt(0).toUpperCase() + conv.channel.slice(1)} conversation`}
                                                </p>
                                                {/* Unknown contact badge in list */}
                                                {!conv.contact_id && conv.sender_display_name && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium mt-1.5">
                                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                        Not in Contact
                                                    </span>
                                                )}
                                                {conv.ticket_id && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[10px] font-medium mt-1.5">
                                                        <Ticket className="h-2.5 w-2.5" />
                                                        Ticket Created
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Panel - Message Thread */}
                <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden min-w-0 relative">
                    {selectedConversation ? (
                        <>
                            {/* Thread Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-white to-gray-50/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm",
                                            CHANNEL_BG[selectedConversation.channel] || "bg-gray-500"
                                        )}>
                                            {selectedConversation.contact_name?.charAt(0).toUpperCase() || selectedConversation.sender_display_name?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {selectedConversation.contact_name || selectedConversation.sender_display_name || selectedConversation.channel_contact_id}
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
                                        {hasFeature('ticketing') && (
                                            <button
                                                onClick={openCreateTicketModal}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl hover:opacity-90 transition-all duration-200 text-xs font-medium"
                                                title="Create ticket from this conversation"
                                            >
                                                <Ticket className="h-3.5 w-3.5" />
                                                <span>Create Ticket</span>
                                            </button>
                                        )}
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
                                        <button
                                            onClick={handleDeleteConversation}
                                            className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all duration-200"
                                            title="Delete conversation"
                                        >
                                            <Trash className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                {/* Unknown Contact Indicator - shown below header */}
                                <UnknownContactIndicator
                                    conversation={{
                                        ...selectedConversation,
                                        contact_name: selectedConversation.contact_name || undefined
                                    }}
                                    onContactAdded={() => fetchConversations()}
                                    className="mt-4"
                                />
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50/30 to-gray-50/50">
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
                                    <MessageRenderer conversation={selectedConversation} messages={messages as any} />
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Composer - Email vs Other Channels */}
                            <div className="px-6 py-4 bg-white rounded-2xl">
                                {selectedConversation.channel === 'email' ? (
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => setShowReplyDrawer(true)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-sm"
                                        >
                                            <Reply className="h-4 w-4" />
                                            <span className="text-sm font-medium">Reply</span>
                                        </button>
                                    </div>
                                ) : (
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
                                )}
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
                    {selectedConversation && (
                        <ReplyDrawer
                            isOpen={showReplyDrawer}
                            onClose={() => setShowReplyDrawer(false)}
                            conversationId={selectedConversation.id}
                            defaultSubject={selectedConversation.subject || undefined}
                            recipientEmail={selectedConversation.contact_email || selectedConversation.channel_contact_id || ''}
                            onSent={() => fetchMessages(selectedConversation.id)}
                        />
                    )}
                </div>

                {/* Right Panel - Details */}
                {showDetails && selectedConversation && (
                    <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                        {/* Mini Tabs */}
                        <div className="p-4">
                            <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
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
                                    </div>
                                </>
                            ) : (
                                <CopilotPanel
                                    conversationId={selectedConversation.id}
                                    contactId={selectedConversation.contact_id || undefined}
                                    channel={selectedConversation.channel}
                                    onReplyGenerated={(draft) => {
                                        // Handle reply generated - copy to composer
                                        if (selectedConversation.channel === 'email') {
                                            setShowReplyDrawer(true);
                                        } else {
                                            setNewMessage(draft);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Ticket Modal */}
            {showCreateTicketModal && selectedConversation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                                        <Ticket className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Create Ticket</h3>
                                        <p className="text-xs text-gray-500">From {selectedConversation.channel} conversation</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreateTicketModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="h-4 w-4 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject *</label>
                                <input
                                    type="text"
                                    value={ticketForm.subject}
                                    onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Brief description of the issue"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Initial Note</label>
                                <textarea
                                    value={ticketForm.notes}
                                    onChange={(e) => setTicketForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Add internal notes about this ticket..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300 resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Apply Macro (Optional)</label>
                                <select
                                    value={ticketForm.macroId}
                                    onChange={(e) => setTicketForm(prev => ({ ...prev, macroId: e.target.value }))}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                >
                                    <option value="">No macro</option>
                                    {availableMacros.map(macro => (
                                        <option key={macro.id} value={macro.id}>{macro.name} - {macro.description || macro.macro_type}</option>
                                    ))}
                                </select>
                                {ticketForm.macroId && (
                                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                        <Zap className="h-3 w-3" />
                                        Macro will be applied after ticket creation
                                    </p>
                                )}
                            </div>

                            {/* Linked conversation info */}
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs text-gray-500 mb-1">This ticket will be linked to:</p>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-6 w-6 rounded-md flex items-center justify-center text-white text-xs",
                                        CHANNEL_BG[selectedConversation.channel] || "bg-gray-500"
                                    )}>
                                        {(() => {
                                            const Icon = getChannelIcon(selectedConversation.channel);
                                            return <Icon className="h-3 w-3" />;
                                        })()}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {selectedConversation.contact_name || selectedConversation.channel_contact_id}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowCreateTicketModal(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTicket}
                                disabled={!ticketForm.subject.trim() || creatingTicket}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Ticket className="h-4 w-4" />
                                {creatingTicket ? "Creating..." : "Create Ticket"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ComposeEmailModal
                isOpen={showComposeEmailModal}
                onClose={() => setShowComposeEmailModal(false)}
                prefillTo={prefillTo}
                contactId={prefillContactId}
                contactName={prefillName}
            />

            {/* Filter Modal */}
            <FilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                onApplyFilters={setFilters}
                mailboxes={mailboxes}
            />
        </div>
    );
}
