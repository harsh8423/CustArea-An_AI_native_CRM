"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Zap, Plus, RefreshCw, Edit, Trash2, X, Check, ChevronDown
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Macro {
    id: string;
    name: string;
    description: string | null;
    macro_type: string;
    actions: MacroAction[];
    schedule_delay_hours: number | null;
    is_active: boolean;
    created_by_name: string | null;
    created_at: string;
}

interface MacroAction {
    type: string;
    value?: string;
    tag_id?: string;
    template?: string;
}

const MACRO_TYPES = [
    { value: "customer_input_required", label: "Customer Input Required", color: "text-blue-600 bg-blue-50" },
    { value: "team_escalation", label: "Team Escalation", color: "text-orange-600 bg-orange-50" },
    { value: "inform", label: "Inform Customer", color: "text-green-600 bg-green-50" },
    { value: "schedule_followup", label: "Schedule Follow-up", color: "text-purple-600 bg-purple-50" },
    { value: "custom", label: "Custom", color: "text-gray-600 bg-gray-100" },
];

const ACTION_TYPES = [
    { value: "set_status", label: "Set Status" },
    { value: "set_priority", label: "Set Priority" },
    { value: "set_team", label: "Assign to Team" },
    { value: "add_tag", label: "Add Tag" },
];

export default function MacrosPage() {
    const [macros, setMacros] = useState<Macro[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        macroType: "custom",
        actions: [] as MacroAction[],
        scheduleDelayHours: "",
        isActive: true
    });

    const fetchMacros = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.macros.list(false);
            setMacros(res.macros || []);
        } catch (err) {
            console.error("Failed to fetch macros:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMacros();
    }, [fetchMacros]);

    const openCreateModal = () => {
        setEditingMacro(null);
        setFormData({
            name: "",
            description: "",
            macroType: "custom",
            actions: [],
            scheduleDelayHours: "",
            isActive: true
        });
        setShowModal(true);
    };

    const openEditModal = (macro: Macro) => {
        setEditingMacro(macro);
        setFormData({
            name: macro.name,
            description: macro.description || "",
            macroType: macro.macro_type,
            actions: macro.actions || [],
            scheduleDelayHours: macro.schedule_delay_hours?.toString() || "",
            isActive: macro.is_active
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        setSaving(true);
        try {
            const data = {
                name: formData.name,
                description: formData.description || undefined,
                macroType: formData.macroType,
                actions: formData.actions,
                scheduleDelayHours: formData.scheduleDelayHours ? parseInt(formData.scheduleDelayHours) : undefined,
                isActive: formData.isActive
            };

            if (editingMacro) {
                await api.macros.update(editingMacro.id, data);
            } else {
                await api.macros.create(data);
            }
            setShowModal(false);
            fetchMacros();
        } catch (err) {
            console.error("Failed to save macro:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this macro?")) return;
        try {
            await api.macros.delete(id);
            fetchMacros();
        } catch (err) {
            console.error("Failed to delete macro:", err);
        }
    };

    const addAction = () => {
        setFormData(prev => ({
            ...prev,
            actions: [...prev.actions, { type: "set_status", value: "pending" }]
        }));
    };

    const updateAction = (index: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            actions: prev.actions.map((action, i) =>
                i === index ? { ...action, [field]: value } : action
            )
        }));
    };

    const removeAction = (index: number) => {
        setFormData(prev => ({
            ...prev,
            actions: prev.actions.filter((_, i) => i !== index)
        }));
    };

    const getMacroTypeConfig = (type: string) => {
        return MACRO_TYPES.find(t => t.value === type) || MACRO_TYPES[4];
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Macros</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Create reusable actions to quickly update tickets
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchMacros}
                                className="p-2.5 hover:bg-gray-50 rounded-xl transition-all"
                            >
                                <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
                            </button>
                            <button
                                onClick={openCreateModal}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl hover:opacity-90 transition-all"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm font-medium">New Macro</span>
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
                    ) : macros.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <Zap className="h-7 w-7 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-600">No macros yet</h3>
                            <p className="text-sm text-gray-400 mt-1">Create your first macro to automate ticket actions</p>
                            <button
                                onClick={openCreateModal}
                                className="mt-4 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                            >
                                Create Macro
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {macros.map(macro => {
                                const typeConfig = getMacroTypeConfig(macro.macro_type);
                                return (
                                    <div
                                        key={macro.id}
                                        className={cn(
                                            "p-4 rounded-xl border transition-all hover:shadow-md",
                                            macro.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                                                    <Zap className="h-4 w-4 text-rose-500" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{macro.name}</h3>
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", typeConfig.color)}>
                                                        {typeConfig.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEditModal(macro)}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <Edit className="h-3.5 w-3.5 text-gray-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(macro.id)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                        {macro.description && (
                                            <p className="text-xs text-gray-500 mb-3">{macro.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            {macro.actions.map((action, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                    {action.type}: {action.value || action.template || action.tag_id}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingMacro ? "Edit Macro" : "Create Macro"}
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
                                    placeholder="e.g., Escalate to Billing"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="What does this macro do?"
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                                <select
                                    value={formData.macroType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, macroType: e.target.value }))}
                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-300"
                                >
                                    {MACRO_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Actions</label>
                                    <button
                                        onClick={addAction}
                                        className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                                    >
                                        + Add Action
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.actions.map((action, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <select
                                                value={action.type}
                                                onChange={(e) => updateAction(index, "type", e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                            >
                                                {ACTION_TYPES.map(type => (
                                                    <option key={type.value} value={type.value}>{type.label}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={action.value || ""}
                                                onChange={(e) => updateAction(index, "value", e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                            />
                                            <button
                                                onClick={() => removeAction(index)}
                                                className="p-2 hover:bg-red-50 rounded-lg"
                                            >
                                                <X className="h-4 w-4 text-gray-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                    className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
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
                                {saving ? "Saving..." : (editingMacro ? "Update" : "Create")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
