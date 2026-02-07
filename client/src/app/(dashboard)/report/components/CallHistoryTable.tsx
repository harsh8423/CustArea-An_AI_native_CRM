import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
    Phone,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    User,
    Bot,
    Mic,
    Volume2,
    Activity
} from 'lucide-react';

interface CallHistoryTableProps {
    userId?: string;
    timeRange: string;
    startDate?: string;
    endDate?: string;
}

export default function CallHistoryTable({
    userId,
    timeRange,
    startDate,
    endDate
}: CallHistoryTableProps) {
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        fetchCalls();
    }, [userId, timeRange, startDate, endDate, page]);

    const fetchCalls = async () => {
        setLoading(true);
        try {
            // Calculate dates based on timeRange if not custom
            let queryStartDate = startDate;
            let queryEndDate = endDate;

            if (timeRange !== 'custom') {
                const now = new Date();
                const end = new Date(now);
                const start = new Date(now);

                if (timeRange === 'daily') {
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else if (timeRange === 'weekly') {
                    start.setDate(now.getDate() - 7);
                } else if (timeRange === 'monthly') {
                    start.setDate(now.getDate() - 30);
                }

                queryStartDate = start.toISOString();
                queryEndDate = end.toISOString();
            }

            const res = await api.phone.getHistory({
                limit: 20,
                offset: (page - 1) * 20,
                userId: userId,
                startDate: queryStartDate,
                endDate: queryEndDate,
            });

            if (page === 1) {
                setCalls(res.calls || []);
            } else {
                setCalls(prev => [...prev, ...(res.calls || [])]);
            }
            setHasMore((res.calls?.length || 0) === 20);
        } catch (error) {
            console.error('Failed to fetch call history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                        <tr>
                            <th className="px-4 py-3">Direction & Status</th>
                            <th className="px-4 py-3">Participants</th>
                            <th className="px-4 py-3">AI Configuration</th>
                            <th className="px-4 py-3">Providers</th>
                            <th className="px-4 py-3">Timing</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {calls.map((call) => (
                            <tr key={call.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {call.direction === 'inbound' ? (
                                            <ArrowDownLeft className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <ArrowUpRight className="w-4 h-4 text-blue-500" />
                                        )}
                                        <div>
                                            <div className="font-medium capitalize">{call.direction}</div>
                                            <div className={`text-xs px-1.5 py-0.5 rounded-full inline-block mt-1 ${call.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                call.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {call.status}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-gray-900">
                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                            <span>{call.contact_name || call.from_number}</span>
                                        </div>
                                        {call.user_name && (
                                            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                                <Bot className="w-3.5 h-3.5" />
                                                <span>Agent: {call.user_name}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="space-y-1 text-xs">
                                        {call.ai_model && (
                                            <div title="AI Model" className="flex items-center gap-1.5">
                                                <Activity className="w-3.5 h-3.5 text-purple-500" />
                                                <span className="font-mono text-purple-700 bg-purple-50 px-1 rounded">{call.ai_model}</span>
                                            </div>
                                        )}
                                        {call.ai_voice_id && (
                                            <div title="Voice ID" className="flex items-center gap-1.5 text-gray-600">
                                                <Volume2 className="w-3.5 h-3.5" />
                                                <span>{call.ai_voice_id}</span>
                                            </div>
                                        )}
                                        {call.latency_mode && (
                                            <div title="Latency Mode" className="flex items-center gap-1.5 text-gray-500">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{call.latency_mode}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                                        {call.ai_provider && <div><span className="font-semibold">AI:</span> {call.ai_provider}</div>}
                                        {call.stt_provider && <div><span className="font-semibold">STT:</span> {call.stt_provider}</div>}
                                        {call.tts_provider && <div><span className="font-semibold">TTS:</span> {call.tts_provider}</div>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        {formatDuration(call.duration_seconds || 0)}
                                    </div>
                                    <div className="text-gray-400">
                                        {new Date(call.created_at).toLocaleString()}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && calls.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    No phone calls found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {hasMore && (
                <div className="p-4 border-t text-center">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loading}>
                        {loading ? 'Loading...' : 'Load More Calls'}
                    </Button>
                </div>
            )}
        </Card>
    );
}
