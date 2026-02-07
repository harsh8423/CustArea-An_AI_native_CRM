import React from 'react';
import { Card } from '@/components/ui/card';
import { useChartData } from '@/hooks/useAnalytics';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

interface AnalyticsChartsProps {
    timeRange: 'daily' | 'weekly' | 'monthly' | 'custom';
    userId?: string;
    category?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AnalyticsCharts({ timeRange, userId, category }: AnalyticsChartsProps) {
    // Fetch chart data for different visualizations
    const emailChart = useChartData('email-ai-vs-human', { timeRange, userId });
    const phoneChart = useChartData('phone-duration', { timeRange, userId });
    const crmChart = useChartData('crm-overview', { timeRange, userId });

    if (emailChart.loading || phoneChart.loading || crmChart.loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
                        <div className="h-64 bg-gray-200 rounded"></div>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Email Activity: AI vs Human */}
            {(category === 'all' || category === 'email') && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Email Activity: AI vs Human
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={emailChart.data || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                            <XAxis
                                dataKey="date"
                                className="text-gray-600"
                                tick={{ fill: 'currentColor' }}
                            />
                            <YAxis className="text-gray-600" tick={{ fill: 'currentColor' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Bar dataKey="ai" fill="#3B82F6" name="AI" />
                            <Bar dataKey="human" fill="#10B981" name="Human" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Phone Call Duration */}
                {(category === 'all' || category === 'phone') && (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Phone Call Duration
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={phoneChart.data || []}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                                <XAxis
                                    dataKey="date"
                                    className="text-gray-600"
                                    tick={{ fill: 'currentColor' }}
                                />
                                <YAxis className="text-gray-600" tick={{ fill: 'currentColor' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="ai_duration"
                                    stroke="#8B5CF6"
                                    name="AI Duration (s)"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="human_duration"
                                    stroke="#F59E0B"
                                    name="Human Duration (s)"
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                )}

                {/* CRM Overview */}
                {(category === 'all' || category === 'contact' || category === 'lead') && (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            CRM Activity
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={crmChart.data || []}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                                <XAxis
                                    dataKey="date"
                                    className="text-gray-600"
                                    tick={{ fill: 'currentColor' }}
                                />
                                <YAxis className="text-gray-600" tick={{ fill: 'currentColor' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="leads_created" fill="#F59E0B" name="Leads" />
                                <Bar dataKey="contacts_created" fill="#10B981" name="Contacts" />
                                <Bar dataKey="contacts_imported" fill="#3B82F6" name="Imported" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                )}
            </div>
        </div >
    );
}
