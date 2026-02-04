import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityLog } from '@/lib/analyticsApi';
import {
    Mail,
    Phone,
    Users,
    Target,
    Ticket,
    Settings,
    UserPlus,
    Megaphone,
    RefreshCw
} from 'lucide-react';

interface ActivityLogsTableProps {
    logs: ActivityLog[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
    email: <Mail className="w-4 h-4" />,
    phone: <Phone className="w-4 h-4" />,
    contact: <Users className="w-4 h-4" />,
    lead: <Target className="w-4 h-4" />,
    ticket: <Ticket className="w-4 h-4" />,
    campaign: <Megaphone className="w-4 h-4" />,
    settings: <Settings className="w-4 h-4" />,
    user_management: <UserPlus className="w-4 h-4" />,
    import: <RefreshCw className="w-4 h-4" />
};

const categoryColors: Record<string, string> = {
    email: 'bg-blue-100 text-blue-700',
    phone: 'bg-purple-100 text-purple-700',
    contact: 'bg-green-100 text-green-700',
    lead: 'bg-orange-100 text-orange-700',
    ticket: 'bg-yellow-100 text-yellow-700',
    campaign: 'bg-pink-100 text-pink-700',
    settings: 'bg-gray-100 text-gray-700',
    user_management: 'bg-indigo-100 text-indigo-700',
    import: 'bg-teal-100 text-teal-700'
};

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

export default function ActivityLogsTable({
    logs,
    loading,
    hasMore,
    onLoadMore
}: ActivityLogsTableProps) {
    if (loading && logs.length === 0) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    if (logs.length === 0) {
        return (
            <Card className="p-12 text-center">
                <p className="text-gray-500">
                    No activity logs found
                </p>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Activity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Resource
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-gray-900">
                                        {log.action_description}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {log.action_type}
                                    </p>
                                </td>
                                <td className="px-6 py-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {log.user_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {log.user_email}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[log.action_category] || categoryColors.settings
                                        }`}>
                                        {categoryIcons[log.action_category] || categoryIcons.settings}
                                        <span className="ml-1 capitalize">{log.action_category}</span>
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {log.resource_name ? (
                                        <div>
                                            <p className="text-sm text-gray-900">
                                                {log.resource_name}
                                            </p>
                                            {log.resource_type && (
                                                <p className="text-xs text-gray-500 capitalize">
                                                    {log.resource_type}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                    {formatDate(log.created_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <div className="px-6 py-4 border-t border-gray-200 text-center">
                    <Button
                        variant="outline"
                        onClick={onLoadMore}
                        disabled={loading}
                        className="w-full sm:w-auto"
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </Button>
                </div>
            )}
        </Card>
    );
}
