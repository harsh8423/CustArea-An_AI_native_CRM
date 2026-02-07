import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
}

type PresetType = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const [selectedPreset, setSelectedPreset] = useState<PresetType>('custom');

    const calculatePreset = (preset: PresetType): DateRange => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let startDate: Date;
        const endDate = new Date(today);

        switch (preset) {
            case 'last7':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'last30':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 29);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'last90':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 89);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'thisMonth':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'lastMonth':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate.setFullYear(today.getFullYear(), today.getMonth(), 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'thisYear':
                startDate = new Date(today.getFullYear(), 0, 1);
                startDate.setHours(0, 0, 0, 0);
                break;
            default:
                return value;
        }

        return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
    };

    const handlePresetClick = (preset: PresetType) => {
        setSelectedPreset(preset);
        if (preset !== 'custom') {
            const range = calculatePreset(preset);
            onChange(range);
        }
    };

    const handleDateChange = (field: 'startDate' | 'endDate', dateValue: string) => {
        const date = new Date(dateValue);
        if (field === 'startDate') {
            date.setHours(0, 0, 0, 0);
        } else {
            date.setHours(23, 59, 59, 999);
        }

        onChange({
            ...value,
            [field]: date.toISOString()
        });
    };

    const presets = [
        { id: 'last7', label: 'Last 7 Days' },
        { id: 'last30', label: 'Last 30 Days' },
        { id: 'last90', label: 'Last 90 Days' },
        { id: 'thisMonth', label: 'This Month' },
        { id: 'lastMonth', label: 'Last Month' },
        { id: 'thisYear', label: 'This Year' },
        { id: 'custom', label: 'Custom' }
    ] as const;

    // Format date for input (YYYY-MM-DD)
    const formatDateForInput = (isoString: string) => {
        if (!isoString) return '';
        return isoString.split('T')[0];
    };

    // Get today's date in YYYY-MM-DD format for max attribute
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-2 shadow-sm">
            {/* Preset Buttons */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Presets
                </label>
                <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => handlePresetClick(preset.id as PresetType)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedPreset === preset.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        From
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            value={formatDateForInput(value.startDate)}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            max={formatDateForInput(value.endDate) || today}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        To
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            value={formatDateForInput(value.endDate)}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            min={formatDateForInput(value.startDate)}
                            max={today}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Validation Message */}
            {value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate) && (
                <p className="text-sm text-red-600 mt-2">
                    Start date must be before or equal to end date
                </p>
            )}
        </div>
    );
}
