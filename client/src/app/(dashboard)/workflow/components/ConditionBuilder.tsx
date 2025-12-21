'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../store';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

interface ConditionBuilderProps {
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

// Parse existing expression to rules (best effort)
function parseExpression(expr: string): ConditionRule[] {
    if (!expr) return [{ variable: '', operator: '==', value: '' }];

    // Try to parse simple conditions like "first_name == 'harsh'"
    const simpleMatch = expr.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*["']?([^"']+)["']?$/);
    if (simpleMatch) {
        return [{
            variable: simpleMatch[1],
            operator: simpleMatch[2],
            value: simpleMatch[3],
        }];
    }

    // For complex expressions, just return as is
    return [{ variable: expr, operator: '==', value: '' }];
}

// Convert rules back to expression
function buildExpression(rules: ConditionRule[]): string {
    return rules
        .filter(r => r.variable && r.value)
        .map(r => {
            const varName = r.variable.replace(/\s+/g, '_').toLowerCase();
            const val = isNaN(Number(r.value)) ? `"${r.value}"` : r.value;

            if (r.operator === 'contains') {
                return `${varName}.includes(${val})`;
            }
            if (r.operator === 'startsWith') {
                return `${varName}.startsWith(${val})`;
            }
            if (r.operator === 'endsWith') {
                return `${varName}.endsWith(${val})`;
            }
            return `${varName} ${r.operator} ${val}`;
        })
        .join(' && ');
}

export default function ConditionBuilder({ value, onChange, nodeId }: ConditionBuilderProps) {
    const { nodes, edges } = useWorkflowStore();
    const [rules, setRules] = useState<ConditionRule[]>(() => parseExpression(value));
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Get variables from upstream set_variable nodes
    const availableVariables = nodes
        .filter(n => {
            // Find nodes that are upstream and set variables
            if (n.type !== 'set_variable') return false;
            // Check if connected upstream
            return true; // Simplified - show all set_variable nodes
        })
        .map(n => {
            const config = (n.data?.config || {}) as Record<string, any>;
            const varName = String(config.name || '');
            const sanitized = varName.replace(/\s+/g, '_').toLowerCase();
            return {
                raw: varName,
                sanitized,
                label: (n.data?.label as string) || n.id,
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
            {/* Simple Mode */}
            {!showAdvanced && (
                <div className="space-y-2">
                    {rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2">
                            {/* Variable Selector */}
                            <select
                                value={rule.variable}
                                onChange={(e) => updateRule(index, 'variable', e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            >
                                <option value="">Select variable...</option>
                                {availableVariables.map(v => (
                                    <option key={v.sanitized} value={v.sanitized}>
                                        {v.raw} ({v.label})
                                    </option>
                                ))}
                                <option value="_custom">Custom...</option>
                            </select>

                            {/* Operator */}
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(index, 'operator', e.target.value)}
                                className="w-32 px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
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
                                className="flex-1 px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            />

                            {/* Remove */}
                            {rules.length > 1 && (
                                <button
                                    onClick={() => removeRule(index)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}

                    <div className="flex items-center justify-between">
                        <button
                            onClick={addRule}
                            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                            <Plus className="w-3 h-3" />
                            Add condition (AND)
                        </button>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                        >
                            Advanced mode
                        </button>
                    </div>
                </div>
            )}

            {/* Advanced Mode */}
            {showAdvanced && (
                <div className="space-y-2">
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder='e.g., first_name == "harsh" && age > 18'
                        rows={3}
                        className="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                    />
                    <button
                        onClick={() => {
                            setRules(parseExpression(value));
                            setShowAdvanced(false);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        Switch to simple mode
                    </button>
                </div>
            )}

            {/* Preview */}
            {!showAdvanced && rules.some(r => r.variable && r.value) && (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-gray-400 mb-1">Generated expression:</p>
                    <code className="text-xs text-violet-700 font-mono break-all">
                        {buildExpression(rules) || '(empty)'}
                    </code>
                </div>
            )}
        </div>
    );
}
