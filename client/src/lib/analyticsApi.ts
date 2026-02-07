const API_BASE_URL = "http://localhost:8000/api/analytics";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
};

export interface AnalyticsMetrics {
    totals: {
        emails_sent_total: number;
        emails_sent_by_ai: number;
        emails_sent_by_human: number;
        emails_received: number;
        calls_total: number;
        calls_by_ai: number;
        calls_by_human: number;
        calls_duration_seconds: number;
        campaigns_created: number;
        campaign_emails_sent: number;  // Added: Campaign emails total
        campaign_emails_sent_by_ai?: number;  // Added: AI-sent campaign emails
        campaign_emails_sent_by_human?: number;  // Added: Human-sent campaign emails
        leads_created: number;
        contacts_created: number;
        tickets_created: number;
        tickets_resolved: number;
    };
    timeSeriesData: Array<any>;
    categoryBreakdown: any;
    period: string;
}

export interface ActivityLog {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    action_category: string;
    action_type: string;
    action_description: string;
    resource_type: string | null;
    resource_id: string | null;
    resource_name: string | null;
    old_values: any;
    new_values: any;
    created_at: string;
}

export interface ActivityLogsResponse {
    logs: ActivityLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface User {
    id: string;
    name: string;
    email: string;
    status: string;
}

export const analyticsApi = {
    // Get analytics metrics
    getMetrics: async (params: {
        userId?: string;
        timeRange?: 'daily' | 'weekly' | 'monthly' | 'custom';
        category?: string;
        startDate?: string;
        endDate?: string;
    } = {}): Promise<{ success: boolean; data: AnalyticsMetrics }> => {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.timeRange) queryParams.append('timeRange', params.timeRange);
        if (params.category) queryParams.append('category', params.category);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);

        const res = await fetch(`${API_BASE_URL}/metrics?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to fetch metrics');
        }

        return res.json();
    },

    // Get chart data
    getChartData: async (
        chartType: string,
        params: {
            userId?: string;
            timeRange?: 'daily' | 'weekly' | 'monthly';
            category?: string;
            startDate?: string;
            endDate?: string;
        } = {}
    ): Promise<{ success: boolean; chartType: string; data: any }> => {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.timeRange) queryParams.append('timeRange', params.timeRange);
        if (params.category) queryParams.append('category', params.category);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);

        const res = await fetch(`${API_BASE_URL}/charts/${chartType}?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to fetch chart data');
        }

        return res.json();
    },

    // Get phone AI usage
    getPhoneAIUsage: async (params: {
        userId?: string;
        startDate?: string;
        endDate?: string;
    } = {}): Promise<{ success: boolean; data: any }> => {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);

        const res = await fetch(`${API_BASE_URL}/phone-ai-usage?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to fetch phone AI usage');
        }

        return res.json();
    },

    // Get users (super admin only)
    getUsers: async (): Promise<{ success: boolean; data: User[] }> => {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to fetch users');
        }

        return res.json();
    },

    // Export analytics
    exportAnalytics: async (params: {
        format?: 'csv' | 'json';
        userId?: string;
        timeRange?: 'daily' | 'weekly' | 'monthly';
        category?: string;
        startDate?: string;
        endDate?: string;
    } = {}): Promise<Blob> => {
        const queryParams = new URLSearchParams();
        if (params.format) queryParams.append('format', params.format);
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.timeRange) queryParams.append('timeRange', params.timeRange);
        if (params.category) queryParams.append('category', params.category);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);

        const res = await fetch(`${API_BASE_URL}/export?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            throw new Error('Failed to export analytics');
        }

        return res.blob();
    },

    // Get activity logs
    getActivityLogs: async (params: {
        userId?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ success: boolean; data: ActivityLogsResponse }> => {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.category) queryParams.append('category', params.category);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());

        const res = await fetch(`${API_BASE_URL}/activity-logs?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to fetch activity logs');
        }

        return res.json();
    },

    // Create activity log
    createActivityLog: async (data: {
        actionCategory: string;
        actionType: string;
        actionDescription: string;
        resourceType?: string;
        resourceId?: string;
        resourceName?: string;
        oldValues?: any;
        newValues?: any;
    }): Promise<{ success: boolean; data: { id: string } }> => {
        const res = await fetch(`${API_BASE_URL}/activity-logs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create activity log');
        }

        return res.json();
    }
};
