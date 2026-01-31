"use client";

import { useState, useEffect } from "react";
import { X, Users, Plus, Search, Check } from "lucide-react";
import { api } from "@/lib/api";

interface AddToGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactIds: string[];
    onSuccess?: () => void;
}

interface Group {
    id: string;
    name: string;
    description?: string;
    contact_count: number;
}

export default function AddToGroupModal({ isOpen, onClose, contactIds, onSuccess }: AddToGroupModalProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState("");
    const [showCreateGroup, setShowCreateGroup] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGroups();
        }
    }, [isOpen]);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const response = await api.contactGroups.list({ limit: 100 });
            setGroups(response.groups || []);
        } catch (err) {
            console.error("Failed to load groups:", err);
            setError("Failed to load groups");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleGroup = (groupId: string) => {
        const newSelected = new Set(selectedGroupIds);
        if (newSelected.has(groupId)) {
            newSelected.delete(groupId);
        } else {
            newSelected.add(groupId);
        }
        setSelectedGroupIds(newSelected);
    };

    const handleAddToGroups = async () => {
        if (selectedGroupIds.size === 0) {
            setError("Please select at least one group");
            return;
        }

        setAdding(true);
        setError("");

        try {
            // Add contacts to each selected group
            await Promise.all(
                Array.from(selectedGroupIds).map(groupId =>
                    api.contactGroups.addContacts(groupId, contactIds)
                )
            );

            onSuccess?.();
            handleClose();
        } catch (err: any) {
            console.error("Failed to add contacts to groups:", err);
            setError(err.error || "Failed to add contacts to groups");
        } finally {
            setAdding(false);
        }
    };

    const handleClose = () => {
        if (!adding) {
            setSelectedGroupIds(new Set());
            setSearchQuery("");
            setError("");
            setShowCreateGroup(false);
            onClose();
        }
    };

    const filteredGroups = groups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Add to Groups</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {contactIds.length} contact{contactIds.length !== 1 ? 's' : ''} selected
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={adding}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Search and Create Button */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search groups..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className="px-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            New Group
                        </button>
                    </div>

                    {/* Groups List */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-gray-500">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                <Users className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-gray-600 font-medium">
                                    {searchQuery ? "No groups found" : "No groups yet"}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {searchQuery ? "Try a different search" : "Create your first group to get started"}
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-[300px] overflow-y-auto">
                                {filteredGroups.map((group) => {
                                    const isSelected = selectedGroupIds.has(group.id);
                                    return (
                                        <label
                                            key={group.id}
                                            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-900 truncate">
                                                    {group.name}
                                                </div>
                                                {group.description && (
                                                    <div className="text-sm text-gray-500 truncate mt-0.5">
                                                        {group.description}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {group.contact_count} contact{group.contact_count !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleGroup(group.id)}
                                                    className="sr-only"
                                                />
                                                <div
                                                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                                                            ? "bg-blue-600 border-blue-600"
                                                            : "border-gray-300 bg-white"
                                                        }`}
                                                >
                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={adding}
                            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddToGroups}
                            disabled={adding || selectedGroupIds.size === 0}
                            className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(37,99,235,0.2)]"
                        >
                            {adding ? "Adding..." : `Add to ${selectedGroupIds.size} Group${selectedGroupIds.size !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Nested Create Group Modal */}
            {showCreateGroup && (
                <CreateGroupModalNested
                    onClose={() => setShowCreateGroup(false)}
                    onSuccess={() => {
                        setShowCreateGroup(false);
                        loadGroups();
                    }}
                />
            )}
        </div>
    );
}

// Simplified nested create group modal to avoid circular imports
function CreateGroupModalNested({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await api.contactGroups.create({ name: name.trim(), description: description.trim() || undefined });
            onSuccess();
        } catch (err: any) {
            setError(err.error || "Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Create Group</h3>
                {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Group name"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        autoFocus
                    />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                    />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
