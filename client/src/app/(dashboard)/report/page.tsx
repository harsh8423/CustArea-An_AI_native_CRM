'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { rbacApi } from '@/lib/rbacApi';
import { RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Import components
import MetricsOverview from './components/MetricsOverview';
import TimeRangeSelector from './components/TimeRangeSelector';
import CategoryFilter from './components/CategoryFilter';
import UserSelector from './components/UserSelector';
import ExportButton from './components/ExportButton';
import ActivityLogsTable from './components/ActivityLogsTable';
import AnalyticsCharts from './components/AnalyticsCharts';

export default function ReportPage() {
    // State
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [category, setCategory] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [activityLogsPage, setActivityLogsPage] = useState(1);

    // Check if user is super admin
    useEffect(() => {
        async function checkPermissions() {
            try {
                const response = await rbacApi.permissions.getMyPermissions();
                // Check if user has reports.view permission
                const permissions = response.permissions || [];
                // Super admins typically have all permissions - we can also check for specific admin permission
                setIsSuperAdmin(permissions.length > 40); // Simple heuristic for super admin
            } catch (error) {
                console.error('Error checking permissions:', error);
            }
        }
        checkPermissions();
    }, []);

    // Date range for API calls (last 30 days)
    const dateRange = useMemo(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
    }, []);

    // Fetch analytics data
    const {
        data: analyticsData,
        loading: analyticsLoading,
        error: analyticsError,
        refresh: refreshAnalytics
    } = useAnalytics({
        userId: selectedUserId || undefined,
        timeRange,
        category: category !== 'all' ? category : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
    });

    // Fetch activity logs
    const {
        logs,
        loading: logsLoading,
        hasMore,
        loadMore,
        refresh: refreshLogs
    } = useActivityLogs({
        userId: selectedUserId || undefined,
        category: category !== 'all' ? category : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page: activityLogsPage,
        limit: 50
    });

    // Refresh all data
    const handleRefreshAll = () => {
        refreshAnalytics();
        refreshLogs();
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto p-8">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">
                                        Analytics & Reports
                                    </h1>
                                    <p className="text-gray-500 mt-1">
                                        Track your performance and activity across all channels
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleRefreshAll}
                                    className="flex items-center space-x-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Refresh</span>
                                </Button>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-4">
                                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                                <CategoryFilter value={category} onChange={setCategory} />
                                {isSuperAdmin && (
                                    <div className="flex items-center space-x-2">
                                        <Shield className="w-4 h-4 text-gray-500" />
                                        <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
                                    </div>
                                )}
                                <div className="ml-auto">
                                    <ExportButton
                                        params={{
                                            userId: selectedUserId || undefined,
                                            timeRange,
                                            category: category !== 'all' ? category : undefined,
                                            startDate: dateRange.startDate,
                                            endDate: dateRange.endDate
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Error Display */}
                        {analyticsError && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-800 text-sm">
                                    Error loading analytics: {analyticsError}
                                </p>
                            </div>
                        )}

                        {/* Metrics Overview */}
                        <MetricsOverview metrics={analyticsData} loading={analyticsLoading} />

                        {/* Charts */}
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                Performance Trends
                            </h2>
                            <AnalyticsCharts
                                timeRange={timeRange}
                                userId={selectedUserId || undefined}
                                category={category !== 'all' ? category : undefined}
                            />
                        </div>

                        {/* Activity Logs */}
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                Activity Log
                            </h2>
                            <ActivityLogsTable
                                logs={logs}
                                loading={logsLoading}
                                hasMore={hasMore}
                                onLoadMore={loadMore}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
