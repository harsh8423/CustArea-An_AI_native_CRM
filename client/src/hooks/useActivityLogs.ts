import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, ActivityLog, ActivityLogsResponse } from '@/lib/analyticsApi';

interface UseActivityLogsParams {
    userId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    enabled?: boolean;
}

export function useActivityLogs(params: UseActivityLogsParams = {}) {
    const [data, setData] = useState<ActivityLogsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        if (params.enabled === false) return;

        try {
            setLoading(true);
            setError(null);
            const response = await analyticsApi.getActivityLogs(params);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activity logs');
            console.error('Error fetching activity logs:', err);
        } finally {
            setLoading(false);
        }
    }, [
        params.userId,
        params.category,
        params.startDate,
        params.endDate,
        params.page,
        params.limit,
        params.enabled
    ]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const loadMore = useCallback(() => {
        if (data && data.page < data.totalPages) {
            // Trigger refetch with next page
            const nextPage = data.page + 1;
            analyticsApi.getActivityLogs({ ...params, page: nextPage })
                .then(response => {
                    setData(prev => ({
                        ...response.data,
                        logs: [...(prev?.logs || []), ...response.data.logs]
                    }));
                })
                .catch(err => {
                    console.error('Error loading more logs:', err);
                });
        }
    }, [data, params]);

    return {
        logs: data?.logs || [],
        total: data?.total || 0,
        page: data?.page || 1,
        totalPages: data?.totalPages || 1,
        loading,
        error,
        refresh: fetchLogs,
        loadMore,
        hasMore: data ? data.page < data.totalPages : false
    };
}

export function useUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchUsers() {
            try {
                setLoading(true);
                const response = await analyticsApi.getUsers();
                setUsers(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch users');
                console.error('Error fetching users:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, []);

    return { users, loading, error };
}
