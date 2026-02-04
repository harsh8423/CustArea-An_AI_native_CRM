import React from 'react';

interface CategoryFilterProps {
    value: string;
    onChange: (value: string) => void;
}

const categories = [
    { value: 'all', label: 'All Categories', icon: '📊' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'phone', label: 'Phone', icon: '📞' },
    { value: 'campaign', label: 'Campaigns', icon: '🎯' },
    { value: 'contact', label: 'Contacts', icon: '👥' },
    { value: 'lead', label: 'Leads', icon: '🎪' },
    { value: 'ticket', label: 'Tickets', icon: '🎫' }
];

export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
                {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                        {category.icon} {category.label}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
            </div>
        </div>
    );
}
