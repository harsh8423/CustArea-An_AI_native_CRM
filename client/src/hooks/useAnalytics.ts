import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, AnalyticsMetrics } from '@/lib/analyticsApi';

interface UseAnalyticsParams {
    userId?: string;
    timeRange?: 'daily' | 'weekly' | 'monthly' | 'custom';
    category?: string;
    startDate?: string;
    endDate?: string;
    enabled?: boolean;
}

export function useAnalytics(params: UseAnalyticsParams = {}) {
    const [data, setData] = useState<AnalyticsMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        if (params.enabled === false) return;

        try {
            setLoading(true);
            setError(null);
            const response = await analyticsApi.getMetrics(params);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [
        params.userId,
        params.timeRange,
        params.category,
        params.startDate,
        params.endDate,
        params.enabled
    ]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return {
        data,
        loading,
        error,
        refresh: fetchAnalytics
    };
}

export function useChartData(
    chartType: string,
    params: UseAnalyticsParams = {}
) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchChartData = useCallback(async () => {
        if (params.enabled === false) return;

        try {
            setLoading(true);
            setError(null);
            const response = await analyticsApi.getChartData(chartType, params);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
            console.error('Error fetching chart data:', err);
        } finally {
            setLoading(false);
        }
    }, [
        chartType,
        params.userId,
        params.timeRange,
        params.category,
        params.startDate,
        params.endDate,
        params.enabled
    ]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    return {
        data,
        loading,
        error,
        refresh: fetchChartData
    };
}
