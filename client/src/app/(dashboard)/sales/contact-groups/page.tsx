"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, LayoutGrid, Search, Trash2, Edit2, ChevronDown, ChevronUp, Mail, Phone, Building, User, X } from "lucide-react";
import { api } from "@/lib/api";
import CreateGroupModal from "@/components/contacts/CreateGroupModal";
import { cn } from "@/lib/utils";

interface Group {
    id: string;
    name: string;
    description?: string;
    color?: string;
    contact_count: number;
    created_by_name?: string;
    created_at: string;
}

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    company_name: string;
}

export default function ContactGroupsPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [groupContacts, setGroupContacts] = useState<Record<string, Contact[]>>({});
    const [loadingContacts, setLoadingContacts] = useState<string | null>(null);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.contactGroups.list({ search: searchQuery, limit: 100 });
            setGroups(data.groups || []);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchGroups();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchGroups]);

    const fetchGroupContacts = async (groupId: string) => {
        if (groupContacts[groupId]) {
            return; // Already loaded
        }

        setLoadingContacts(groupId);
        try {
            const data = await api.contactGroups.getContacts(groupId, { limit: 100 });
            setGroupContacts(prev => ({ ...prev, [groupId]: data.contacts || [] }));
        } catch (err) {
            console.error("Failed to fetch group contacts", err);
        } finally {
            setLoadingContacts(null);
        }
    };

    const handleDeleteGroup = async (groupId: string, groupName: string) => {
        const confirmed = window.confirm(`Are you sure you want to delete "${groupName}"? All memberships will be removed.`);
        if (!confirmed) return;

        try {
            await api.contactGroups.delete(groupId);
            fetchGroups();
            setExpandedGroupId(null);
        } catch (err) {
            console.error("Failed to delete group", err);
            alert("Failed to delete group");
        }
    };

    const handleGroupExpand = async (groupId: string) => {
        if (expandedGroupId === groupId) {
            setExpandedGroupId(null);
        } else {
            setExpandedGroupId(groupId);
            await fetchGroupContacts(groupId);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
            "bg-indigo-500", "bg-teal-500", "bg-orange-500"
        ];
        const hash = name ? name.charCodeAt(0) + (name.charCodeAt(1) || 0) : 0;
        return colors[hash % colors.length];
    };

    const handleRemoveContact = async (groupId: string, contactId: string, contactName: string) => {
        const confirmed = window.confirm(`Remove "${contactName}" from this group?`);
        if (!confirmed) return;

        try {
            await api.contactGroups.removeContacts(groupId, [contactId]);
            // Refresh the contacts for this group
            setGroupContacts(prev => ({
                ...prev,
                [groupId]: prev[groupId].filter(c => c.id !== contactId)
            }));
            // Refresh groups to update contact count
            fetchGroups();
        } catch (err) {
            console.error("Failed to remove contact from group", err);
            alert("Failed to remove contact from group");
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)] relative">
                {/* Header with Tabs */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-gray-900">Leads</h1>
                        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl">
                            <button
                                onClick={() => router.push("/sales/contacts")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Contacts
                            </button>
                            <button
                                onClick={() => router.push("/sales/leads")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Leads
                            </button>
                            <button
                                className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg shadow-sm transition-all duration-200"
                            >
                                Groups
                            </button>
                            <button
                                onClick={() => router.push("/sales/lead-board")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                Board
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">
                        <span className="font-semibold text-gray-900">{groups.length}</span> groups
                    </div>
                </div>

                {/* Search and Actions Bar */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search groups..."
                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(37,99,235,0.2)]"
                    >
                        <Plus className="h-4 w-4" />
                        Create Group
                    </button>
                </div>

                {/* Groups List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                                <Users className="h-10 w-10 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {searchQuery ? "No groups found" : "No groups yet"}
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-sm">
                                {searchQuery
                                    ? "Try adjusting your search to find what you're looking for"
                                    : "Create your first group to start organizing contacts"}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create First Group
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groups.map((group) => {
                                const isExpanded = expandedGroupId === group.id;
                                const contacts = groupContacts[group.id] || [];
                                const isLoadingContacts = loadingContacts === group.id;

                                return (
                                    <div
                                        key={group.id}
                                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-all"
                                    >
                                        {/* Group Header */}
                                        <div
                                            className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => handleGroupExpand(group.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shrink-0">
                                                        <Users className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-bold text-gray-900 truncate">{group.name}</h3>
                                                        {group.description && (
                                                            <p className="text-sm text-gray-500 line-clamp-1">{group.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                                                            <span>{group.contact_count} contact{group.contact_count !== 1 ? 's' : ''}</span>
                                                            <span>•</span>
                                                            <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedGroup(group);
                                                            setIsCreateModalOpen(true);
                                                        }}
                                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                                        title="Edit group"
                                                    >
                                                        <Edit2 className="h-4 w-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteGroup(group.id, group.name);
                                                        }}
                                                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete group"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </button>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-5 w-5 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Contact List */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 bg-gray-50/50">
                                                {isLoadingContacts ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                                                    </div>
                                                ) : contacts.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500 text-sm">
                                                        No contacts in this group yet
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-gray-100">
                                                        {contacts.map((contact) => (
                                                            <div
                                                                key={contact.id}
                                                                className="p-4 hover:bg-gray-100/50 transition-colors flex items-center justify-between group/contact"
                                                            >
                                                                <div
                                                                    className="flex items-center gap-3 flex-1 cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/sales/contacts/${contact.id}`);
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0",
                                                                        getAvatarColor(contact.name || "")
                                                                    )}>
                                                                        {getInitials(contact.name || contact.email || "?")}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-900 truncate">
                                                                            {contact.name || contact.email || "Unknown"}
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                                                            {contact.email && (
                                                                                <div className="flex items-center gap-1 truncate">
                                                                                    <Mail className="h-3 w-3" />
                                                                                    <span className="truncate">{contact.email}</span>
                                                                                </div>
                                                                            )}
                                                                            {contact.phone && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <Phone className="h-3 w-3" />
                                                                                    <span>{contact.phone}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {contact.company_name && (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">
                                                                            <Building className="h-3 w-3" />
                                                                            <span className="truncate max-w-[150px]">{contact.company_name}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveContact(group.id, contact.id, contact.name || contact.email || "this contact");
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover/contact:opacity-100 ml-2"
                                                                    title="Remove from group"
                                                                >
                                                                    <X className="h-4 w-4 text-red-500" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Create/Edit Group Modal */}
                <CreateGroupModal
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setSelectedGroup(null);
                    }}
                    onSuccess={() => {
                        fetchGroups();
                        setSelectedGroup(null);
                    }}
                />
            </div>
        </div>
    );
}
