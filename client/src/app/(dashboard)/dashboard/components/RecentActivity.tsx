'use client';

import { useActivityLogs } from '@/hooks/useActivityLogs';
import { Clock, User as UserIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RecentActivity() {
    const { logs, loading } = useActivityLogs({ limit: 5 });

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Recent Activity
            </h2>

            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                {logs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No recent activity</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="relative pl-6 pb-2 border-l border-gray-100 last:border-0 group">
                            <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-gray-200 ring-4 ring-white group-hover:bg-blue-500 transition-colors"></div>

                            <div className="mb-1">
                                <p className="text-sm text-gray-900 font-medium">
                                    {log.action_description}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                                    <UserIcon className="w-3 h-3" />
                                    {log.user_name}
                                </div>
                                <span className="text-xs text-gray-400">
                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
