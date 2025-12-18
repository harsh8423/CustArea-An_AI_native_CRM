"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Tag, Plus, RefreshCw, Edit, Trash2, X
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TicketTag {
    id: string;
    name: string;
    color: string;
    description: string | null;
    ticket_count: number;
    created_at: string;
}

const PRESET_COLORS = [
    "#EF4444", // red
    "#F97316", // orange
    "#EAB308", // yellow
    "#22C55E", // green
    "#06B6D4", // cyan
    "#3B82F6", // blue
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#6B7280", // gray
];

export default function TagsPage() {
    const [tags, setTags] = useState<TicketTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTag, setEditingTag] = useState<TicketTag | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        color: "#6B7280",
        description: ""
    });

    const fetchTags = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.ticketTags.list();
            setTags(res.tags || []);
        } catch (err) {
            console.error("Failed to fetch tags:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const openCreateModal = () => {
        setEditingTag(null);
        setFormData({
            name: "",
            color: "#6B7280",
            description: ""
        });
        setShowModal(true);
    };

    const openEditModal = (tag: TicketTag) => {
        setEditingTag(tag);
        setFormData({
            name: tag.name,
            color: tag.color,
            description: tag.description || ""
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        setSaving(true);
        try {
            const data = {
                name: formData.name,
                color: formData.color,
                description: formData.description || undefined
            };

            if (editingTag) {
                await api.ticketTags.update(editingTag.id, data);
            } else {
                await api.ticketTags.create(data);
            }
            setShowModal(false);
            fetchTags();
        } catch (err) {
            console.error("Failed to save tag:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this tag?")) return;
        try {
            await api.ticketTags.delete(id);
            fetchTags();
        } catch (err) {
            console.error("Failed to delete tag:", err);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Tags</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Organize tickets with color-coded tags
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchTags}
                                className="p-2.5 hover:bg-gray-50 rounded-xl transition-all"
                            >
                                <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
                            </button>
                            <button
                                onClick={openCreateModal}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl hover:opacity-90 transition-all"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm font-medium">New Tag</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="h-6 w-6 text-gray-300 animate-spin" />
                        </div>
                    ) : tags.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <Tag className="h-7 w-7 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-600">No tags yet</h3>
                            <p className="text-sm text-gray-400 mt-1">Create tags to categorize your tickets</p>
                            <button
                                onClick={openCreateModal}
                                className="mt-4 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                            >
                                Create Tag
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {tags.map(tag => (
                                <div
                                    key={tag.id}
                                    className="p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all bg-white group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-10 w-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: tag.color + '20' }}
                                            >
                                                <Tag className="h-5 w-5" style={{ color: tag.color }} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{tag.name}</h3>
                                                <p className="text-xs text-gray-400">
                                                    {tag.ticket_count} ticket{tag.ticket_count !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(tag)}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Edit className="h-3.5 w-3.5 text-gray-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tag.id)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                    {tag.description && (
                                        <p className="text-xs text-gray-500">{tag.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingTag ? "Edit Tag" : "Create Tag"}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="h-4 w-4 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Billing, Urgent, VIP"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData(prev => ({ ...prev, color }))}
                                            className={cn(
                                                "h-8 w-8 rounded-lg transition-all",
                                                formData.color === color && "ring-2 ring-offset-2 ring-gray-400"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                        className="h-8 w-8 rounded-lg cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                />
                            </div>

                            {/* Preview */}
                            <div className="pt-2">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Preview</label>
                                <span
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                                    style={{ backgroundColor: formData.color + '20', color: formData.color }}
                                >
                                    <Tag className="h-3.5 w-3.5" />
                                    {formData.name || "Tag Name"}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formData.name.trim() || saving}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 rounded-xl disabled:opacity-50"
                            >
                                {saving ? "Saving..." : (editingTag ? "Update" : "Create")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
