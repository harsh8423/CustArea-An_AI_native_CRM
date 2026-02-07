import React from 'react';
import DateRangePicker, { DateRange } from '@/components/ui/date-range-picker';

interface TimeRangeSelectorProps {
    value: 'daily' | 'weekly' | 'monthly' | 'custom';
    onChange: (value: 'daily' | 'weekly' | 'monthly' | 'custom') => void;
    customDateRange?: DateRange;
    onCustomDateChange?: (range: DateRange) => void;
}

export default function TimeRangeSelector({
    value,
    onChange,
    customDateRange,
    onCustomDateChange
}: TimeRangeSelectorProps) {
    const ranges = [
        { value: 'daily' as const, label: 'Daily' },
        { value: 'weekly' as const, label: 'Weekly' },
        { value: 'monthly' as const, label: 'Monthly' },
        { value: 'custom' as const, label: 'Custom Range' }
    ];

    return (
        <div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                {ranges.map((range) => (
                    <button
                        key={range.value}
                        onClick={() => onChange(range.value)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${value === range.value
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        {range.label}
                    </button>
                ))}
            </div>

            {/* Show DateRangePicker when custom is selected */}
            {value === 'custom' && customDateRange && onCustomDateChange && (
                <div className="mt-4">
                    <DateRangePicker
                        value={customDateRange}
                        onChange={onCustomDateChange}
                    />
                </div>
            )}
        </div>
    );
}
