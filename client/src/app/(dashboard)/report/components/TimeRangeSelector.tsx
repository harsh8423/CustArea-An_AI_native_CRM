import React from 'react';

interface TimeRangeSelectorProps {
    value: 'daily' | 'weekly' | 'monthly';
    onChange: (value: 'daily' | 'weekly' | 'monthly') => void;
}

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    const options = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }
    ] as const;

    return (
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${value === option.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
