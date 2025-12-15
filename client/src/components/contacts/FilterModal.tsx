"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface FilterCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
}

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterCondition[]) => void;
    availableFields: { id: string; label: string }[];
}

const OPERATORS = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
];

export function FilterModal({ isOpen, onClose, onApply, availableFields }: FilterModalProps) {
    const [conditions, setConditions] = useState<FilterCondition[]>([
        { id: crypto.randomUUID(), field: "", operator: "contains", value: "" }
    ]);

    if (!isOpen) return null;

    const addCondition = () => {
        setConditions(prev => [
            ...prev,
            { id: crypto.randomUUID(), field: "", operator: "contains", value: "" }
        ]);
    };

    const removeCondition = (id: string) => {
        setConditions(prev => prev.filter(c => c.id !== id));
    };

    const updateCondition = (id: string, key: keyof FilterCondition, value: string) => {
        setConditions(prev => prev.map(c =>
            c.id === id ? { ...c, [key]: value } : c
        ));
    };

    const handleApply = () => {
        const validConditions = conditions.filter(c => c.field && c.value);
        onApply(validConditions);
        onClose();
    };

    const handleClear = () => {
        setConditions([{ id: crypto.randomUUID(), field: "", operator: "contains", value: "" }]);
        onApply([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Advanced Filters</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-black">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
                    {conditions.map((condition, idx) => (
                        <div key={condition.id} className="flex items-center gap-2">
                            {idx > 0 && <span className="text-xs text-gray-400 w-8">AND</span>}
                            {idx === 0 && <span className="w-8"></span>}

                            <select
                                className="flex-1 p-2 text-sm border border-gray-200 rounded-md"
                                value={condition.field}
                                onChange={(e) => updateCondition(condition.id, "field", e.target.value)}
                            >
                                <option value="">Select field</option>
                                {availableFields.map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>

                            <select
                                className="w-32 p-2 text-sm border border-gray-200 rounded-md"
                                value={condition.operator}
                                onChange={(e) => updateCondition(condition.id, "operator", e.target.value)}
                            >
                                {OPERATORS.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="Value"
                                className="flex-1 p-2 text-sm border border-gray-200 rounded-md"
                                value={condition.value}
                                onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                            />

                            <button
                                onClick={() => removeCondition(condition.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition"
                                disabled={conditions.length === 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={addCondition}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-black"
                    >
                        <Plus className="h-4 w-4" />
                        Add condition
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50/50">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black"
                    >
                        Clear All
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
