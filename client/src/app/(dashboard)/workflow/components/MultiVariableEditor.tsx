'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Variable {
    name: string;
    value: string;
}

interface MultiVariableEditorProps {
    value: Variable[];
    onChange: (variables: Variable[]) => void;
    theme?: 'light' | 'dark';
}

export default function MultiVariableEditor({ value, onChange, theme = 'dark' }: MultiVariableEditorProps) {
    const [variables, setVariables] = useState<Variable[]>(
        value?.length > 0 ? value : [{ name: '', value: '' }]
    );

    useEffect(() => {
        if (value && JSON.stringify(value) !== JSON.stringify(variables)) {
            setVariables(value.length > 0 ? value : [{ name: '', value: '' }]);
        }
    }, [value]);

    const updateVariable = (index: number, field: 'name' | 'value', newValue: string) => {
        const updated = variables.map((v, i) =>
            i === index ? { ...v, [field]: newValue } : v
        );
        setVariables(updated);
        onChange(updated);
    };

    const addVariable = () => {
        const updated = [...variables, { name: '', value: '' }];
        setVariables(updated);
        onChange(updated);
    };

    const removeVariable = (index: number) => {
        if (variables.length > 1) {
            const updated = variables.filter((_, i) => i !== index);
            setVariables(updated);
            onChange(updated);
        }
    };

    const isDark = theme === 'dark';
    const inputClass = isDark
        ? 'bg-[#151522] text-gray-200 border-gray-700 focus:border-violet-500'
        : 'bg-white text-gray-800 border-gray-300 focus:border-blue-500';

    return (
        <div className="space-y-3">
            {variables.map((variable, index) => (
                <div key={index} className="flex items-start gap-2 group">
                    <div className="flex items-center pt-2 opacity-0 group-hover:opacity-50 cursor-grab">
                        <GripVertical className="w-4 h-4 text-gray-500" />
                    </div>

                    <div className="flex-1 space-y-2">
                        {/* Variable name */}
                        <div className="flex items-center gap-2">
                            <label className={`text-xs w-16 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Name
                            </label>
                            <input
                                type="text"
                                value={variable.name}
                                onChange={(e) => updateVariable(index, 'name', e.target.value)}
                                placeholder="variable_name"
                                className={`flex-1 px-3 py-1.5 text-sm rounded-lg border focus:outline-none ${inputClass}`}
                            />
                        </div>

                        {/* Variable value */}
                        <div className="flex items-center gap-2">
                            <label className={`text-xs w-16 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Value
                            </label>
                            <input
                                type="text"
                                value={variable.value}
                                onChange={(e) => updateVariable(index, 'value', e.target.value)}
                                placeholder="Value or {{expression}}"
                                className={`flex-1 px-3 py-1.5 text-sm rounded-lg border focus:outline-none ${inputClass}`}
                            />
                        </div>
                    </div>

                    {/* Delete button */}
                    {variables.length > 1 && (
                        <button
                            onClick={() => removeVariable(index)}
                            className="p-1.5 mt-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))}

            {/* Add variable button */}
            <button
                onClick={addVariable}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                        ? 'text-violet-400 hover:bg-violet-500/10'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
            >
                <Plus className="w-4 h-4" />
                Add Variable
            </button>

            {/* Summary preview */}
            {variables.filter(v => v.name).length > 0 && (
                <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-[#151522] text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                    <span className="font-medium">Will set:</span>{' '}
                    {variables.filter(v => v.name).map(v => v.name).join(', ')}
                </div>
            )}
        </div>
    );
}
