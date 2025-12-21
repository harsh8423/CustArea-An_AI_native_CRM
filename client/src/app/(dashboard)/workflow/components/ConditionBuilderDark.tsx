'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import { Plus, Trash2 } from 'lucide-react';

interface ConditionBuilderDarkProps {
    value: string;
    onChange: (condition: string) => void;
    nodeId: string;
}

// Operators for condition building
const OPERATORS = [
    { value: '==', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: 'greater or equal' },
    { value: '<=', label: 'less or equal' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
];

interface ConditionRule {
    variable: string;
    operator: string;
    value: string;
}

// Parse existing expression to rules
function parseExpression(expr: string): ConditionRule[] {
    if (!expr) return [{ variable: '', operator: '==', value: '' }];

    const simpleMatch = expr.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*["']?([^"']+)["']?$/);
    if (simpleMatch) {
        return [{
            variable: simpleMatch[1],
            operator: simpleMatch[2],
            value: simpleMatch[3],
        }];
    }

    return [{ variable: expr, operator: '==', value: '' }];
}

// Convert rules back to expression
function buildExpression(rules: ConditionRule[]): string {
    return rules
        .filter(r => r.variable && r.value)
        .map(r => {
            const varName = r.variable.replace(/\s+/g, '_').toLowerCase();
            const val = isNaN(Number(r.value)) ? `"${r.value}"` : r.value;

            if (r.operator === 'contains') return `${varName}.includes(${val})`;
            if (r.operator === 'startsWith') return `${varName}.startsWith(${val})`;
            if (r.operator === 'endsWith') return `${varName}.endsWith(${val})`;
            return `${varName} ${r.operator} ${val}`;
        })
        .join(' && ');
}

export default function ConditionBuilderDark({ value, onChange, nodeId }: ConditionBuilderDarkProps) {
    const { nodes } = useWorkflowStore();
    const [rules, setRules] = useState<ConditionRule[]>(() => parseExpression(value));
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Get variables from set_variable nodes
    const availableVariables = nodes
        .filter(n => n.type === 'set_variable')
        .map(n => {
            const config = (n.data?.config || {}) as Record<string, any>;
            const varName = String(config.name || '');
            return {
                raw: varName,
                sanitized: varName.replace(/\s+/g, '_').toLowerCase(),
                label: String(n.data?.label || n.id),
            };
        })
        .filter(v => v.sanitized);

    // Update expression when rules change
    useEffect(() => {
        const newExpr = buildExpression(rules);
        if (newExpr !== value) {
            onChange(newExpr);
        }
    }, [rules]);

    const updateRule = (index: number, field: keyof ConditionRule, newValue: string) => {
        setRules(prev => prev.map((r, i) =>
            i === index ? { ...r, [field]: newValue } : r
        ));
    };

    const addRule = () => {
        setRules(prev => [...prev, { variable: '', operator: '==', value: '' }]);
    };

    const removeRule = (index: number) => {
        if (rules.length > 1) {
            setRules(prev => prev.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="space-y-3">
            {!showAdvanced && (
                <div className="space-y-2">
                    {rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2">
                            {/* Variable - Droppable Field */}
                            <input
                                type="text"
                                value={rule.variable}
                                onChange={(e) => updateRule(index, 'variable', e.target.value)}
                                placeholder="Drop or type variable..."
                                className="flex-1 px-2 py-1.5 text-sm bg-[#151522] text-gray-200 border border-gray-700 border-dashed rounded-lg focus:outline-none focus:border-violet-500 placeholder:text-gray-500"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('border-violet-500', 'bg-violet-500/10');
                                }}
                                onDragLeave={(e) => {
                                    e.currentTarget.classList.remove('border-violet-500', 'bg-violet-500/10');
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-violet-500', 'bg-violet-500/10');
                                    const text = e.dataTransfer.getData('text/plain');
                                    if (text) {
                                        // Extract variable name from {{node.field}} format
                                        const match = text.match(/\{\{([^}]+)\}\}/);
                                        const varName = match ? match[1].split('.').pop() || text : text;
                                        updateRule(index, 'variable', varName.replace(/\s+/g, '_').toLowerCase());
                                    }
                                }}
                            />

                            {/* Operator */}
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(index, 'operator', e.target.value)}
                                className="w-28 px-2 py-1.5 text-sm bg-[#151522] text-gray-200 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500"
                            >
                                {OPERATORS.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>

                            {/* Value */}
                            <input
                                type="text"
                                value={rule.value}
                                onChange={(e) => updateRule(index, 'value', e.target.value)}
                                placeholder="Value"
                                className="flex-1 px-2 py-1.5 text-sm bg-[#151522] text-gray-200 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500"
                            />

                            {rules.length > 1 && (
                                <button
                                    onClick={() => removeRule(index)}
                                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}

                    <div className="flex items-center justify-between">
                        <button
                            onClick={addRule}
                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium"
                        >
                            <Plus className="w-3 h-3" />
                            Add condition (AND)
                        </button>
                        <button
                            onClick={() => setShowAdvanced(true)}
                            className="text-xs text-gray-500 hover:text-gray-400"
                        >
                            Advanced mode
                        </button>
                    </div>
                </div>
            )}

            {showAdvanced && (
                <div className="space-y-2">
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder='e.g., first_name == "harsh" && age > 18'
                        rows={3}
                        className="w-full px-3 py-2 text-sm font-mono bg-[#151522] text-gray-200 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500 resize-none"
                    />
                    <button
                        onClick={() => {
                            setRules(parseExpression(value));
                            setShowAdvanced(false);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-400"
                    >
                        Switch to simple mode
                    </button>
                </div>
            )}

            {/* Preview */}
            {!showAdvanced && rules.some(r => r.variable && r.value) && (
                <div className="p-2 bg-[#151522] rounded-lg border border-gray-700">
                    <p className="text-[10px] text-gray-500 mb-1">Generated expression:</p>
                    <code className="text-xs text-violet-400 font-mono break-all">
                        {buildExpression(rules) || '(empty)'}
                    </code>
                </div>
            )}

            <p className="text-xs text-gray-500">
                Use variable names directly (e.g., <code className="bg-[#151522] px-1 rounded text-violet-400">first_name=="harsh"</code>) or with path (e.g., <code className="bg-[#151522] px-1 rounded text-violet-400">{'{{node_id.field}}'}</code>)
            </p>
        </div>
    );
}
