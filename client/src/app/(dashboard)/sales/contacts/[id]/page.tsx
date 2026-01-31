"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Mail, Phone, MapPin, User,
    MessageSquare, Edit3, MoreHorizontal,
    Clock, Globe, Building, Check, X,
    ChevronRight, Filter, Search, Calendar,
    Hash, ExternalLink, Activity, Info, FileText,
    Users, Plus
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import AddToGroupModal from "@/components/contacts/AddToGroupModal";

// --- Types ---
interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    company_name: string;
    source: string;
    created_at: string;
    score: number;
    metadata?: Record<string, any>;
}

interface Conversation {
    id: string;
    subject: string;
    status: string;
    channel: string;
    last_message_at: string;
    assigned_to_name?: string;
}

type TabId = "overview" | "activity" | "logs";

// --- Helpers ---
const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
};

const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

// --- Main Component ---
export default function ContactProfilePage() {
    const params = useParams();
    const router = useRouter();
    const contactId = params.id as string;

    const [contact, setContact] = useState<Contact | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>("overview");

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Contact>>({});
    const [isAddToGroupOpen, setIsAddToGroupOpen] = useState(false);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [contactData, historyData, groupsData] = await Promise.all([
                    api.contacts.get(contactId),
                    api.conversations.list({ contactId: contactId, limit: 20 }),
                    api.contacts.getGroups(contactId)
                ]);
                setContact(contactData);
                setConversations(historyData.conversations || []);
                setGroups(groupsData.groups || []);
                setEditForm(contactData);
            } catch (err) {
                console.error("Failed to load contact data", err);
            } finally {
                setLoading(false);
            }
        };

        if (contactId) {
            loadData();
        }
    }, [contactId]);

    const handleSave = async () => {
        try {
            // Call API to update contact
            await api.contacts.update(contactId, editForm);
            // Update local state
            setContact(prev => ({ ...prev!, ...editForm } as Contact));
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to save contact", err);
            // Optionally show error to user
        }
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#F2F4F7]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
    );

    if (!contact) return null;

    const displayName = contact.name || contact.email?.split('@')[0] || "Unknown";
    const initials = getInitials(displayName);

    return (
        <div className="h-full bg-[#F2F4F7] p-6 flex gap-6 font-sans text-gray-900 overflow-hidden">

            {/* --- Left Sidebar Card (Fixed Width) --- */}
            <aside className="w-[300px] shrink-0 flex flex-col gap-6">
                <div className="bg-white rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">

                    {/* Header Zone (No Bottom Border) */}
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="h-24 w-24 rounded-3xl bg-[#F2F4F7] flex items-center justify-center text-3xl font-bold text-gray-700 mb-5">
                            {initials}
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{displayName}</h1>
                        {contact.company_name && (
                            <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#F2F4F7] text-xs font-medium text-gray-600">
                                <Building className="h-3 w-3 text-gray-400" />
                                {contact.company_name}
                            </div>
                        )}
                        <div className="flex items-center gap-3 mt-8 w-full">
                            {contact.email ? (
                                <Link href={`/conversation?compose=true&to=${encodeURIComponent(contact.email)}&contactId=${contact.id}&name=${encodeURIComponent(displayName)}`} className="flex-1">
                                    <button className="w-full py-2.5 text-sm font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:opacity-90 transition-all shadow-[0_4px_14px_0_rgba(249,115,22,0.2)] flex items-center justify-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        Send Email
                                    </button>
                                </Link>
                            ) : (
                                <button disabled className="flex-1 py-2.5 text-sm font-semibold bg-gray-200 text-gray-400 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    No Email
                                </button>
                            )}
                            {contact.phone ? (
                                <Link href={`/phone-calls?tab=dialer&open=true&phone=${encodeURIComponent(contact.phone)}&contactId=${contact.id}&name=${encodeURIComponent(displayName)}`} className="flex-1">
                                    <button className="w-full py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:opacity-90 transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.2)] flex items-center justify-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        Call
                                    </button>
                                </Link>
                            ) : (
                                <button disabled className="flex-1 py-2.5 text-sm font-semibold bg-gray-200 text-gray-400 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    No Phone
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation Tabs (Vertical List) */}
                    <div className="flex-1 px-4 space-y-1">
                        <NavTab
                            active={activeTab === "overview"}
                            onClick={() => setActiveTab("overview")}
                            icon={User}
                            label="Overview"
                        />
                        <NavTab
                            active={activeTab === "activity"}
                            onClick={() => setActiveTab("activity")}
                            icon={Activity}
                            label="Activity"
                        />
                        <NavTab
                            active={activeTab === "logs"}
                            onClick={() => setActiveTab("logs")}
                            icon={FileText}
                            label="Logs"
                        />
                    </div>

                    {/* Footer / Back */}
                    <div className="p-6 mt-auto">
                        <button
                            onClick={() => router.push("/sales/contacts")}
                            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-gray-400 hover:text-gray-900 rounded-xl hover:bg-[#F2F4F7] transition-colors uppercase tracking-wider"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Contacts
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- Right Content Card (Flexible) --- */}
            <main className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">

                {/* Header for Content Area (No Border, Just Whitespace) */}
                <div className="px-10 py-8 flex items-center justify-between shrink-0">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                        {activeTab === "overview" && "Profile Overview"}
                        {activeTab === "activity" && "Conversation History"}
                        {activeTab === "logs" && "System Logs"}
                    </h2>

                    {activeTab === "overview" && (
                        <button
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            className={cn(
                                "px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2",
                                isEditing
                                    ? "bg-black text-white"
                                    : "bg-[#F2F4F7] text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {isEditing ? <Check className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                            {isEditing ? "Save Changes" : "Edit Profile"}
                        </button>
                    )}
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto px-10 pb-10">

                    {/* --- TAB: OVERVIEW --- */}
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-2 gap-12 max-w-4xl">
                            {/* Contact Info Group */}
                            <section className="space-y-6">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">Contact Details</h3>
                                <div className="bg-[#F9FAFB] rounded-2xl p-2 space-y-1">
                                    <PropertyItem
                                        icon={User}
                                        label="Name"
                                        value={isEditing ? editForm.name : contact.name}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, name: v }))}
                                    />
                                    <PropertyItem
                                        icon={Building}
                                        label="Company"
                                        value={isEditing ? editForm.company_name : contact.company_name}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, company_name: v }))}
                                    />
                                    <PropertyItem
                                        icon={Mail}
                                        label="Email"
                                        value={isEditing ? editForm.email : contact.email}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, email: v }))}
                                    />
                                    <PropertyItem
                                        icon={Phone}
                                        label="Phone"
                                        value={isEditing ? editForm.phone : contact.phone}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, phone: v }))}
                                    />
                                    <PropertyItem
                                        icon={Globe}
                                        label="Website"
                                        value={isEditing ? editForm.metadata?.website : contact.metadata?.website}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, metadata: { ...prev.metadata, website: v } }))}
                                        type="text"
                                    />
                                    <PropertyItem
                                        icon={MapPin}
                                        label="Location"
                                        value={isEditing ? editForm.metadata?.location : contact.metadata?.location}
                                        isEditing={isEditing}
                                        onChange={(v) => setEditForm(prev => ({ ...prev, metadata: { ...prev.metadata, location: v } }))}
                                    />
                                </div>
                            </section>

                            {/* Right Column within Overview */}
                            <div className="space-y-10">
                                <section className="space-y-6">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-2">Additional Info</h3>
                                    <div className="bg-[#F9FAFB] rounded-2xl p-2 space-y-1">
                                        <PropertyItem
                                            icon={User}
                                            label="Source"
                                            value={contact.source}
                                            isEditing={false}
                                        />
                                        <PropertyItem
                                            icon={Clock}
                                            label="Member Since"
                                            value={formatDate(contact.created_at)}
                                            isEditing={false}
                                        />
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags</h3>
                                        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">Manage</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(contact.metadata?.segments || "Lead, New").split(',').map((tag: string, i: number) => (
                                            <span key={i} className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-[#F9FAFB] text-gray-700 hover:bg-gray-100 transition-colors cursor-default">
                                                <Hash className="h-3.5 w-3.5 text-gray-400 mr-2" />
                                                {tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                {/* Groups Section */}
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Groups</h3>
                                        <button
                                            onClick={() => setIsAddToGroupOpen(true)}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add to Group
                                        </button>
                                    </div>
                                    <div className="bg-[#F9FAFB] rounded-2xl p-4">
                                        {groups.length === 0 ? (
                                            <div className="text-center py-6">
                                                <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-sm text-gray-500 mb-3">Not in any groups yet</p>
                                                <button
                                                    onClick={() => setIsAddToGroupOpen(true)}
                                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Add to a group
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {groups.map((group: any) => (
                                                    <div
                                                        key={group.id}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 shadow-sm transition-all cursor-default"
                                                    >
                                                        <Users className="h-3.5 w-3.5 text-gray-400" />
                                                        <span>{group.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: ACTIVITY --- */}
                    {activeTab === "activity" && (
                        <div className="max-w-3xl space-y-4">
                            {conversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-16 w-16 bg-[#F9FAFB] rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                                        <MessageSquare className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-gray-900 font-medium mb-1">No conversation history</h3>
                                    <p className="text-gray-500 text-sm">Activities will appear here.</p>
                                </div>
                            ) : (
                                conversations.map((conv) => (
                                    <div key={conv.id} className="group flex items-center gap-5 p-4 hover:bg-[#F9FAFB] rounded-2xl transition-all cursor-pointer">
                                        {/* Status / Icon */}
                                        <div className="shrink-0">
                                            <div className={cn(
                                                "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                                conv.channel === 'email' ? "bg-blue-50 text-blue-600" :
                                                    conv.channel === 'whatsapp' ? "bg-emerald-50 text-emerald-600" :
                                                        "bg-gray-100 text-gray-500"
                                            )}>
                                                {conv.channel === 'email' ? <Mail className="h-6 w-6" /> :
                                                    conv.channel === 'whatsapp' ? <MessageSquare className="h-6 w-6" /> :
                                                        <Clock className="h-6 w-6" />}
                                            </div>
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-base font-semibold text-gray-900 truncate">
                                                    {conv.subject || "(No Subject)"}
                                                </span>
                                                <span className="text-xs font-medium text-gray-400 tabular-nums">
                                                    {formatTimeAgo(conv.last_message_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                                <span className={cn(
                                                    "font-bold uppercase tracking-wider text-[10px]",
                                                    conv.status === 'open' ? "text-blue-600" :
                                                        conv.status === 'resolved' ? "text-emerald-600" :
                                                            "text-gray-500"
                                                )}>
                                                    {conv.status}
                                                </span>
                                                <span className="text-gray-300">•</span>
                                                <span className="capitalize">{conv.channel}</span>
                                                {conv.assigned_to_name && (
                                                    <>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="flex items-center gap-1.5">
                                                            <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600">
                                                                {getInitials(conv.assigned_to_name)}
                                                            </div>
                                                            {conv.assigned_to_name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100" />
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* --- TAB: LOGS --- */}
                    {activeTab === "logs" && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="h-16 w-16 bg-[#F9FAFB] rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                                <FileText className="h-8 w-8" />
                            </div>
                            <h3 className="text-gray-900 font-medium mb-1">System Logs</h3>
                            <p className="text-gray-500 text-sm">No system logs available for this contact.</p>
                        </div>
                    )}

                </div>
            </main>

            {/* Add to Group Modal */}
            <AddToGroupModal
                isOpen={isAddToGroupOpen}
                onClose={() => setIsAddToGroupOpen(false)}
                contactIds={contact ? [contact.id] : []}
                onSuccess={async () => {
                    setIsAddToGroupOpen(false);
                    // Reload groups
                    try {
                        const groupsData = await api.contacts.getGroups(contactId);
                        setGroups(groupsData.groups || []);
                    } catch (err) {
                        console.error("Failed to reload groups", err);
                    }
                }}
            />
        </div>
    );
}

// --- Components ---

function NavTab({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group",
                active
                    ? "bg-[#F2F4F7] text-gray-900"
                    : "text-gray-500 hover:bg-[#F9FAFB] hover:text-gray-900"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon className={cn("h-5 w-5", active ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600")} />
                {label}
            </div>
            {active && <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
        </button>
    );
}

function PropertyItem({ icon: Icon, label, value, isEditing, onChange, type = "text" }: { icon: any, label: string, value: string | undefined, isEditing: boolean, onChange?: (val: string) => void, type?: string }) {
    if (!value && !isEditing) return null;

    return (
        <div className="group flex items-center gap-4 p-3 hover:bg-white rounded-xl transition-all">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors shadow-sm">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                {isEditing ? (
                    <input
                        type={type}
                        value={value || ""}
                        onChange={(e) => onChange?.(e.target.value)}
                        className="w-full text-sm text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none pb-0.5"
                        placeholder="..."
                    />
                ) : (
                    <div className="text-sm font-semibold text-gray-900 truncate">
                        {value || "—"}
                    </div>
                )}
            </div>
        </div>
    );
}
