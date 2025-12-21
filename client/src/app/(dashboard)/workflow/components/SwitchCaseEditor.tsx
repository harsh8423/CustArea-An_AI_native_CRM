'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useWorkflowStore } from '../store';

interface SwitchCase {
    id: string;
    label: string;
    value: string;
}

interface SwitchCaseEditorProps {
    variable: string;
    cases: SwitchCase[];
    includeDefault: boolean;
    onChange: (config: { variable: string; cases: SwitchCase[]; includeDefault: boolean }) => void;
    theme?: 'light' | 'dark';
}

// Color palette for case handles
const CASE_COLORS = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-yellow-500',
    'bg-red-500',
];

export default function SwitchCaseEditor({
    variable,
    cases,
    includeDefault,
    onChange,
    theme = 'dark'
}: SwitchCaseEditorProps) {
    const { nodes } = useWorkflowStore();

    const [localVariable, setLocalVariable] = useState(variable || '');
    const [localCases, setLocalCases] = useState<SwitchCase[]>(
        cases?.length > 0 ? cases : [{ id: 'case_0', label: 'Case 1', value: '' }]
    );
    const [localIncludeDefault, setLocalIncludeDefault] = useState(includeDefault ?? true);

    // Get available variables from set_variable nodes
    const availableVariables = nodes
        .filter(n => n.type === 'set_variable')
        .flatMap(n => {
            const config = (n.data?.config || {}) as Record<string, any>;
            // Support both old format (name) and new format (variables array)
            if (config.variables && Array.isArray(config.variables)) {
                return config.variables.map((v: any) => ({
                    raw: v.name,
                    sanitized: v.name?.replace(/\s+/g, '_').toLowerCase() || '',
                    nodeLabel: String(n.data?.label || n.id),
                }));
            } else if (config.name) {
                return [{
                    raw: config.name,
                    sanitized: config.name?.replace(/\s+/g, '_').toLowerCase() || '',
                    nodeLabel: String(n.data?.label || n.id),
                }];
            }
            return [];
        })
        .filter(v => v.sanitized);

    useEffect(() => {
        if (variable !== localVariable || JSON.stringify(cases) !== JSON.stringify(localCases) || includeDefault !== localIncludeDefault) {
            onChange({ variable: localVariable, cases: localCases, includeDefault: localIncludeDefault });
        }
    }, [localVariable, localCases, localIncludeDefault]);

    const updateCase = (index: number, field: keyof SwitchCase, newValue: string) => {
        const updated = localCases.map((c, i) =>
            i === index ? { ...c, [field]: newValue } : c
        );
        setLocalCases(updated);
    };

    const addCase = () => {
        const newId = `case_${localCases.length}`;
        const updated = [...localCases, { id: newId, label: `Case ${localCases.length + 1}`, value: '' }];
        setLocalCases(updated);
    };

    const removeCase = (index: number) => {
        if (localCases.length > 1) {
            const updated = localCases.filter((_, i) => i !== index);
            // Re-index case IDs
            const reindexed = updated.map((c, i) => ({ ...c, id: `case_${i}` }));
            setLocalCases(reindexed);
        }
    };

    const moveCase = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= localCases.length) return;

        const updated = [...localCases];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        // Re-index case IDs
        const reindexed = updated.map((c, i) => ({ ...c, id: `case_${i}` }));
        setLocalCases(reindexed);
    };

    const isDark = theme === 'dark';
    const inputClass = isDark
        ? 'bg-[#151522] text-gray-200 border-gray-700 focus:border-violet-500'
        : 'bg-white text-gray-800 border-gray-300 focus:border-blue-500';
    const labelClass = isDark ? 'text-gray-400' : 'text-gray-600';

    return (
        <div className="space-y-4">
            {/* Variable to match - droppable input */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <label className={`text-sm ${labelClass}`}>Variable to match</label>
                    <span className={`text-xs ${isDark ? 'text-violet-400' : 'text-blue-500'}`}>
                        &lt;&gt; Variables
                    </span>
                </div>
                <input
                    type="text"
                    value={localVariable}
                    onChange={(e) => setLocalVariable(e.target.value)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('ring-2', 'ring-violet-500');
                    }}
                    onDragLeave={(e) => {
                        e.currentTarget.classList.remove('ring-2', 'ring-violet-500');
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('ring-2', 'ring-violet-500');
                        const variablePath = e.dataTransfer.getData('variable-path');
                        if (variablePath) {
                            setLocalVariable(`{{${variablePath}}}`);
                        }
                    }}
                    placeholder="Drop a variable here or type {{node.field}}"
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-all ${inputClass}`}
                />
            </div>

            {/* Cases */}
            <div className="space-y-2">
                <label className={`text-sm ${labelClass}`}>Cases</label>

                {localCases.map((caseItem, index) => (
                    <div key={caseItem.id} className="flex items-center gap-2 group">
                        {/* Color indicator */}
                        <div className={`w-3 h-3 rounded-full ${CASE_COLORS[index % CASE_COLORS.length]} flex-shrink-0`} />

                        {/* Case label */}
                        <input
                            type="text"
                            value={caseItem.label}
                            onChange={(e) => updateCase(index, 'label', e.target.value)}
                            placeholder="Label"
                            className={`w-24 px-2 py-1.5 text-sm rounded-lg border focus:outline-none ${inputClass}`}
                        />

                        <span className={`text-sm ${labelClass}`}>=</span>

                        {/* Case value */}
                        <input
                            type="text"
                            value={caseItem.value}
                            onChange={(e) => updateCase(index, 'value', e.target.value)}
                            placeholder="Value to match"
                            className={`flex-1 px-2 py-1.5 text-sm rounded-lg border focus:outline-none ${inputClass}`}
                        />

                        {/* Move buttons */}
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => moveCase(index, 'up')}
                                disabled={index === 0}
                                className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                            >
                                <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => moveCase(index, 'down')}
                                disabled={index === localCases.length - 1}
                                className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Delete button */}
                        {localCases.length > 1 && (
                            <button
                                onClick={() => removeCase(index)}
                                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}

                {/* Add case button */}
                <button
                    onClick={addCase}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                        ? 'text-violet-400 hover:bg-violet-500/10'
                        : 'text-blue-600 hover:bg-blue-50'
                        }`}
                >
                    <Plus className="w-4 h-4" />
                    Add Case
                </button>
            </div>

            {/* Default case toggle */}
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={localIncludeDefault}
                        onChange={(e) => setLocalIncludeDefault(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 text-violet-500 focus:ring-violet-500"
                    />
                    <span className={`text-sm ${labelClass}`}>Include default case (for unmatched values)</span>
                </label>
                {localIncludeDefault && (
                    <div className="w-3 h-3 rounded-full bg-gray-500 flex-shrink-0" />
                )}
            </div>

            {/* Visual preview */}
            <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-[#151522]' : 'bg-gray-50'}`}>
                <p className={`font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Output handles:</p>
                <div className="flex flex-wrap gap-2">
                    {localCases.map((c, i) => (
                        <span key={c.id} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${CASE_COLORS[i % CASE_COLORS.length]}`} />
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{c.label || `Case ${i + 1}`}</span>
                        </span>
                    ))}
                    {localIncludeDefault && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-500" />
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Default</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
