import React from 'react';
import { useUsers } from '@/hooks/useActivityLogs';

interface UserSelectorProps {
    value: string | null;
    onChange: (value: string | null) => void;
}

export default function UserSelector({ value, onChange }: UserSelectorProps) {
    const { users, loading } = useUsers();

    if (loading) {
        return (
            <div className="animate-pulse">
                <div className="h-10 bg-gray-200 rounded-lg w-48"></div>
            </div>
        );
    }

    return (
        <div className="relative">
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-[200px]"
            >
                <option value="">All Users (Tenant-wide)</option>
                {users.map((user) => (
                    <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
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
