"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
    Search, Plus, RefreshCw, Tag, Clock,
    AlertCircle, CheckCircle2, PauseCircle, XCircle,
    User, Zap, MessageSquare, StickyNote,
    History, X, Send, Pin, Check, Mail, MessageCircle, Phone
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Ticket {
    id: string;
    tenant_id: string;
    ticket_number: number;
    subject: string;
    description: string | null;
    status: string;
    priority: string;
    assigned_to: string | null;
    assigned_team: string | null;
    contact_id: string | null;
    source_conversation_id: string | null;
    sentiment: string | null;
    intent: string | null;
    summary: string | null;
    due_at: string | null;
    created_at: string;
    updated_at: string;
    contact_name: string | null;
    contact_email: string | null;
    assigned_to_name: string | null;
    tags: { id: string; name: string; color: string }[];
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
}

interface TicketNote {
    id: string;
    content: string;
    is_pinned: boolean;
    created_by: string;
    created_by_name: string;
    created_at: string;
}

interface TicketActivity {
    id: string;
    activity_type: string;
    performed_by_name: string | null;
    description: string;
    old_value: any;
    new_value: any;
    created_at: string;
}

interface TicketTag {
    id: string;
    name: string;
    color: string;
}

interface Macro {
    id: string;
    name: string;
    description: string;
    macro_type: string;
    actions: any[];
}

type DetailTabType = "details" | "notes" | "macros" | "insights" | "activity";

const STATUS_CONFIG: Record<string, { icon: typeof AlertCircle; color: string; bgColor: string; label: string }> = {
    new: { icon: AlertCircle, color: "text-blue-600", bgColor: "bg-blue-50", label: "New" },
    open: { icon: Clock, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Open" },
    pending: { icon: PauseCircle, color: "text-amber-600", bgColor: "bg-amber-50", label: "Pending" },
    on_hold: { icon: PauseCircle, color: "text-orange-600", bgColor: "bg-orange-50", label: "On Hold" },
    resolved: { icon: CheckCircle2, color: "text-gray-500", bgColor: "bg-gray-50", label: "Resolved" },
    closed: { icon: XCircle, color: "text-gray-400", bgColor: "bg-gray-50", label: "Closed" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
    low: { color: "text-gray-500", bgColor: "bg-gray-100" },
    normal: { color: "text-blue-600", bgColor: "bg-blue-50" },
    high: { color: "text-orange-600", bgColor: "bg-orange-50" },
    urgent: { color: "text-red-600", bgColor: "bg-red-50" },
};

const CHANNEL_BG: Record<string, string> = {
    email: "bg-gradient-to-br from-orange-400 to-orange-600",
    whatsapp: "bg-gradient-to-br from-green-400 to-green-600",
    widget: "bg-gradient-to-br from-purple-400 to-purple-600",
    phone: "bg-gradient-to-br from-blue-400 to-blue-600"
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
    email: Mail,
    whatsapp: MessageCircle,
    widget: MessageSquare,
    phone: Phone
};

export default function TicketsPage() {
    const searchParams = useSearchParams();
    const statusFromUrl = searchParams.get('status');

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [detailsTab, setDetailsTab] = useState<DetailTabType>("details");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDetails, setShowDetails] = useState(true);

    // Conversation messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Detail data
    const [notes, setNotes] = useState<TicketNote[]>([]);
    const [activities, setActivities] = useState<TicketActivity[]>([]);
    const [macros, setMacros] = useState<Macro[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Current applied macro (single)
    const [currentMacro, setCurrentMacro] = useState<{ id: string; name: string; appliedAt: string } | null>(null);

    // Forms
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "normal" });
    const [newNote, setNewNote] = useState("");
    const [creating, setCreating] = useState(false);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketsRes, macrosRes] = await Promise.all([
                api.tickets.list({ status: statusFromUrl || undefined, limit: 50 }),
                api.macros.list(true)
            ]);
            setTickets(ticketsRes.tickets || []);
            setMacros(macrosRes.macros || []);
        } catch (err) {
            console.error("Failed to fetch tickets:", err);
        } finally {
            setLoading(false);
        }
    }, [statusFromUrl]);

    const fetchTicketDetails = useCallback(async (ticketId: string) => {
        setLoadingDetails(true);
        try {
            const [notesRes, activitiesRes] = await Promise.all([
                api.tickets.getNotes(ticketId),
                api.tickets.getActivities(ticketId, 50)
            ]);
            setNotes(notesRes.notes || []);
            setActivities(activitiesRes.activities || []);

            // Find most recent applied macro
            const macroActivity = (activitiesRes.activities || [])
                .find((a: TicketActivity) => a.activity_type === 'macro_applied');
            if (macroActivity?.new_value) {
                setCurrentMacro({
                    id: macroActivity.new_value.macroId || '',
                    name: macroActivity.new_value.macroName || 'Unknown',
                    appliedAt: macroActivity.created_at
                });
            } else {
                setCurrentMacro(null);
            }
        } catch (err) {
            console.error("Failed to fetch ticket details:", err);
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    const fetchConversationMessages = useCallback(async (conversationId: string) => {
        setLoadingMessages(true);
        try {
            const res = await api.conversations.getMessages(conversationId, { limit: 100 });
            setMessages(res.messages || []);
        } catch (err) {
            console.error("Failed to fetch messages:", err);
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    useEffect(() => {
        if (selectedTicket) {
            fetchTicketDetails(selectedTicket.id);
            if (selectedTicket.source_conversation_id) {
                fetchConversationMessages(selectedTicket.source_conversation_id);
            } else {
                setMessages([]);
            }
        }
    }, [selectedTicket, fetchTicketDetails, fetchConversationMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSelectTicket = async (ticket: Ticket) => {
        try {
            const res = await api.tickets.get(ticket.id);
            setSelectedTicket(res.ticket);
        } catch (err) {
            console.error("Failed to fetch ticket:", err);
            setSelectedTicket(ticket);
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!selectedTicket) return;
        try {
            await api.tickets.update(selectedTicket.id, { status });
            setSelectedTicket(prev => prev ? { ...prev, status } : null);
            fetchTickets();
        } catch (err) {
            console.error("Failed to update status:", err);
        }
    };

    const handlePriorityChange = async (priority: string) => {
        if (!selectedTicket) return;
        try {
            await api.tickets.update(selectedTicket.id, { priority });
            setSelectedTicket(prev => prev ? { ...prev, priority } : null);
        } catch (err) {
            console.error("Failed to update priority:", err);
        }
    };

    const handleAddNote = async () => {
        if (!selectedTicket || !newNote.trim()) return;
        try {
            await api.tickets.addNote(selectedTicket.id, { content: newNote });
            setNewNote("");
            fetchTicketDetails(selectedTicket.id);
        } catch (err) {
            console.error("Failed to add note:", err);
        }
    };

    const handleApplyMacro = async (macroId: string) => {
        if (!selectedTicket) return;
        try {
            const res = await api.tickets.applyMacro(selectedTicket.id, macroId);
            if (res.ticket) setSelectedTicket(res.ticket);
            fetchTickets();
            fetchTicketDetails(selectedTicket.id);
        } catch (err) {
            console.error("Failed to apply macro:", err);
        }
    };

    const handleCreateTicket = async () => {
        if (!newTicket.subject.trim()) return;
        setCreating(true);
        try {
            await api.tickets.create(newTicket);
            setShowCreateModal(false);
            setNewTicket({ subject: "", description: "", priority: "normal" });
            fetchTickets();
        } catch (err) {
            console.error("Failed to create ticket:", err);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateInsights = async (field: string, value: string) => {
        if (!selectedTicket) return;
        try {
            await api.tickets.update(selectedTicket.id, { [field]: value });
            setSelectedTicket(prev => prev ? { ...prev, [field]: value } : null);
        } catch (err) {
            console.error("Failed to update insights:", err);
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
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const filteredTickets = tickets.filter(ticket => {
        if (!searchQuery) return true;
        const search = searchQuery.toLowerCase();
        return (
            ticket.subject.toLowerCase().includes(search) ||
            ticket.contact_name?.toLowerCase().includes(search) ||
            ticket.ticket_number.toString().includes(search)
        );
    });

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 flex gap-4 overflow-hidden">

                {/* Left Panel - Ticket List */}
                <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-gray-900 text-lg">Tickets</h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {statusFromUrl ? STATUS_CONFIG[statusFromUrl]?.label : 'All'} • {filteredTickets.length} tickets
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="p-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 text-white rounded-xl transition-all duration-200"
                                    title="Create ticket"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={fetchTickets}
                                    className="p-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                                >
                                    <RefreshCw className={cn(
                                        "h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors",
                                        loading && "animate-spin"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-5 pb-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:bg-white transition-all duration-200 placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    {/* Ticket List */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                                <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-500">No tickets</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTickets.map((ticket) => {
                                    const isSelected = selectedTicket?.id === ticket.id;
                                    const StatusIcon = STATUS_CONFIG[ticket.status]?.icon || AlertCircle;
                                    const statusColor = STATUS_CONFIG[ticket.status]?.color || "text-gray-500";
                                    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.normal;

                                    return (
                                        <button
                                            key={ticket.id}
                                            onClick={() => handleSelectTicket(ticket)}
                                            className={cn(
                                                "w-full px-3 py-3 flex items-start gap-3 rounded-xl transition-all duration-200 text-left",
                                                isSelected ? "bg-gradient-to-r from-rose-50 to-pink-50" : "hover:bg-gray-50"
                                            )}
                                        >
                                            <StatusIcon className={cn("h-5 w-5 mt-0.5", statusColor)} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium truncate text-sm text-gray-700">
                                                        #{ticket.ticket_number}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {formatTime(ticket.updated_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 truncate mt-0.5">
                                                    {ticket.subject}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded text-[9px] font-medium",
                                                        priorityConfig.bgColor, priorityConfig.color
                                                    )}>
                                                        {ticket.priority}
                                                    </span>
                                                    {ticket.contact_name && (
                                                        <span className="text-[10px] text-gray-400 truncate">
                                                            {ticket.contact_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Panel - Conversation Messages */}
                <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden min-w-0">
                    {selectedTicket ? (
                        <>
                            <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50 border-b border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center",
                                        STATUS_CONFIG[selectedTicket.status]?.bgColor || "bg-gray-50"
                                    )}>
                                        {(() => {
                                            const Icon = STATUS_CONFIG[selectedTicket.status]?.icon || AlertCircle;
                                            return <Icon className={cn("h-5 w-5", STATUS_CONFIG[selectedTicket.status]?.color)} />;
                                        })()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Ticket #{selectedTicket.ticket_number}</h3>
                                        <p className="text-sm text-gray-500 mt-0.5 max-w-md truncate">{selectedTicket.subject}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedTicket.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className={cn(
                                            "text-xs px-3 py-1.5 rounded-lg font-medium focus:outline-none",
                                            STATUS_CONFIG[selectedTicket.status]?.bgColor,
                                            STATUS_CONFIG[selectedTicket.status]?.color
                                        )}
                                    >
                                        <option value="new">New</option>
                                        <option value="open">Open</option>
                                        <option value="pending">Pending</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className={cn(
                                            "p-2.5 rounded-xl transition-all duration-200",
                                            showDetails ? "bg-rose-50 text-rose-600" : "hover:bg-gray-100 text-gray-400"
                                        )}
                                    >
                                        <User className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Description bar */}
                            {selectedTicket.description && (
                                <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100">
                                    <p className="text-xs text-gray-600 line-clamp-2">{selectedTicket.description}</p>
                                </div>
                            )}

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {selectedTicket.source_conversation_id ? (
                                    loadingMessages ? (
                                        <div className="flex items-center justify-center h-32">
                                            <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                                            <MessageSquare className="h-8 w-8 text-gray-300 mb-2" />
                                            <p className="text-sm">No messages</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {messages.map((message) => {
                                                const isInbound = message.direction === 'inbound';
                                                const ChannelIcon = CHANNEL_ICONS[message.channel] || MessageSquare;

                                                return (
                                                    <div key={message.id} className={cn("flex gap-3", !isInbound && "flex-row-reverse")}>
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                            isInbound ? CHANNEL_BG[message.channel] || "bg-gray-500" : "bg-gradient-to-br from-rose-500 to-pink-600"
                                                        )}>
                                                            {isInbound ? <ChannelIcon className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-white" />}
                                                        </div>
                                                        <div className={cn(
                                                            "max-w-[70%] rounded-2xl px-4 py-2.5",
                                                            isInbound ? "bg-gray-100 rounded-tl-md" : "bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-tr-md"
                                                        )}>
                                                            <p className={cn("text-sm whitespace-pre-wrap", isInbound ? "text-gray-700" : "text-white")}>
                                                                {message.content_text || "No content"}
                                                            </p>
                                                            <p className={cn("text-[10px] mt-1.5", isInbound ? "text-gray-400" : "text-white/70")}>
                                                                {formatTime(message.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                                        <p className="text-sm font-medium text-gray-500">No linked conversation</p>
                                        <p className="text-xs text-gray-400 mt-1">This ticket was created without a conversation</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">Select a ticket</h3>
                            <p className="text-sm text-gray-400">Choose from your tickets on the left</p>
                        </div>
                    )}
                </div>

                {/* Right Panel - Details */}
                {showDetails && selectedTicket && (
                    <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                                {([
                                    { key: "details", icon: User },
                                    { key: "notes", icon: StickyNote },
                                    { key: "macros", icon: Zap },
                                    { key: "insights", icon: AlertCircle },
                                    { key: "activity", icon: History },
                                ] as { key: DetailTabType; icon: typeof User }[]).map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setDetailsTab(tab.key)}
                                        className={cn(
                                            "flex-1 px-2 py-1.5 rounded-lg flex items-center justify-center",
                                            detailsTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        <tab.icon className="h-3.5 w-3.5" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {detailsTab === "details" && (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <label className="text-xs text-gray-400 mb-2 block">Priority</label>
                                        <select
                                            value={selectedTicket.priority}
                                            onChange={(e) => handlePriorityChange(e.target.value)}
                                            className={cn(
                                                "w-full text-sm px-3 py-2 rounded-lg font-medium focus:outline-none",
                                                PRIORITY_CONFIG[selectedTicket.priority]?.bgColor,
                                                PRIORITY_CONFIG[selectedTicket.priority]?.color
                                            )}
                                        >
                                            <option value="low">Low</option>
                                            <option value="normal">Normal</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>

                                    {selectedTicket.contact_name && (
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <label className="text-xs text-gray-400 mb-2 block">Contact</label>
                                            <p className="text-sm font-medium text-gray-900">{selectedTicket.contact_name}</p>
                                            {selectedTicket.contact_email && (
                                                <p className="text-xs text-gray-500 mt-1">{selectedTicket.contact_email}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <label className="text-xs text-gray-400 mb-2 block">Timeline</label>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Created</span>
                                                <span className="text-gray-700">{formatTime(selectedTicket.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Updated</span>
                                                <span className="text-gray-700">{formatTime(selectedTicket.updated_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {detailsTab === "notes" && (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add a note..."
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                                            className="flex-1 px-3 py-2 text-sm bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100"
                                        />
                                        <button
                                            onClick={handleAddNote}
                                            disabled={!newNote.trim()}
                                            className="p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 disabled:opacity-50"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {notes.length === 0 ? (
                                        <div className="text-center py-8">
                                            <StickyNote className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">No notes yet</p>
                                        </div>
                                    ) : (
                                        notes.map(note => (
                                            <div key={note.id} className="bg-gray-50 rounded-xl p-3">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <span className="text-xs font-medium text-gray-700">{note.created_by_name || "Unknown"}</span>
                                                    {note.is_pinned && <Pin className="h-3 w-3 text-rose-500" />}
                                                </div>
                                                <p className="text-sm text-gray-600">{note.content}</p>
                                                <p className="text-[10px] text-gray-400 mt-2">{formatTime(note.created_at)}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {detailsTab === "macros" && (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <label className="text-xs text-gray-400 mb-2 block">Current Macro</label>
                                        {currentMacro ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
                                                    <Zap className="h-4 w-4 text-rose-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">{currentMacro.name}</p>
                                                    <p className="text-[10px] text-gray-400">Applied {formatTime(currentMacro.appliedAt)}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">No macro applied</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-400 mb-2 block">
                                            {currentMacro ? "Change Macro" : "Apply a macro"}
                                        </label>
                                        {macros.length === 0 ? (
                                            <div className="text-center py-6">
                                                <Zap className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-500">No macros available</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {macros.map(macro => (
                                                    <button
                                                        key={macro.id}
                                                        onClick={() => handleApplyMacro(macro.id)}
                                                        className={cn(
                                                            "w-full p-3 rounded-xl text-left transition-colors group",
                                                            currentMacro?.id === macro.id
                                                                ? "bg-rose-50 border-2 border-rose-200"
                                                                : "bg-gray-50 hover:bg-rose-50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Zap className={cn(
                                                                "h-4 w-4",
                                                                currentMacro?.id === macro.id ? "text-rose-500" : "text-gray-400 group-hover:text-rose-500"
                                                            )} />
                                                            <span className={cn(
                                                                "text-sm font-medium",
                                                                currentMacro?.id === macro.id ? "text-rose-600" : "text-gray-700"
                                                            )}>
                                                                {macro.name}
                                                            </span>
                                                            {currentMacro?.id === macro.id && (
                                                                <Check className="h-3 w-3 text-rose-500 ml-auto" />
                                                            )}
                                                        </div>
                                                        {macro.description && (
                                                            <p className="text-xs text-gray-400 mt-1 ml-6">{macro.description}</p>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {detailsTab === "insights" && (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <label className="text-xs text-gray-400 mb-2 block">Customer Sentiment</label>
                                        <select
                                            value={selectedTicket.sentiment || ""}
                                            onChange={(e) => handleUpdateInsights("sentiment", e.target.value)}
                                            className="w-full text-sm px-3 py-2 rounded-lg bg-white focus:outline-none"
                                        >
                                            <option value="">Not set</option>
                                            <option value="positive">😊 Positive</option>
                                            <option value="neutral">😐 Neutral</option>
                                            <option value="negative">😔 Negative</option>
                                            <option value="frustrated">😤 Frustrated</option>
                                        </select>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <label className="text-xs text-gray-400 mb-2 block">Intent</label>
                                        <select
                                            value={selectedTicket.intent || ""}
                                            onChange={(e) => handleUpdateInsights("intent", e.target.value)}
                                            className="w-full text-sm px-3 py-2 rounded-lg bg-white focus:outline-none"
                                        >
                                            <option value="">Not set</option>
                                            <option value="inquiry">Inquiry</option>
                                            <option value="complaint">Complaint</option>
                                            <option value="feedback">Feedback</option>
                                            <option value="request">Request</option>
                                            <option value="support">Support</option>
                                        </select>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <label className="text-xs text-gray-400 mb-2 block">Summary</label>
                                        <textarea
                                            value={selectedTicket.summary || ""}
                                            onChange={(e) => handleUpdateInsights("summary", e.target.value)}
                                            placeholder="Add a summary..."
                                            rows={3}
                                            className="w-full text-sm px-3 py-2 rounded-lg bg-white focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {detailsTab === "activity" && (
                                <div className="space-y-3">
                                    {activities.length === 0 ? (
                                        <div className="text-center py-8">
                                            <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">No activity yet</p>
                                        </div>
                                    ) : (
                                        activities.map(activity => (
                                            <div key={activity.id} className="flex gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-600">{activity.description}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        {activity.performed_by_name && `${activity.performed_by_name} • `}
                                                        {formatTime(activity.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Ticket Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Create Ticket</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject *</label>
                                <input
                                    type="text"
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Brief description"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                <textarea
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Details..."
                                    rows={4}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
                                <select
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none"
                                >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTicket}
                                disabled={!newTicket.subject.trim() || creating}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 rounded-xl disabled:opacity-50"
                            >
                                {creating ? "Creating..." : "Create Ticket"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
