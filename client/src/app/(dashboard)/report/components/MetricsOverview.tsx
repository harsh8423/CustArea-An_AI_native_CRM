import React from 'react';
import { Card } from '@/components/ui/card';
import {
    Mail,
    Phone,
    Users,
    UserPlus,
    Ticket,
    TrendingUp,
    MessageSquare,
    Target
} from 'lucide-react';

interface MetricsOverviewProps {
    metrics: {
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
            campaign_emails_sent: number;
            leads_created: number;
            contacts_created: number;
            tickets_created: number;
            tickets_resolved: number;
            campaign_emails_sent_by_ai?: number;
            campaign_emails_sent_by_human?: number;
        };
    } | null;
    loading: boolean;
    category?: string;
}

interface MetricCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        positive: boolean;
    };
}

function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
    return (
        <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                        {title}
                    </p>
                    <p className="text-3xl font-bold mt-2 text-gray-900">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-sm text-gray-500 mt-1">
                            {subtitle}
                        </p>
                    )}
                    {trend && (
                        <div className={`flex items-center mt-2 text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'
                            }`}>
                            <TrendingUp className="w-4 h-4 mr-1" />
                            {trend.value}% vs last period
                        </div>
                    )}
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                    {icon}
                </div>
            </div>
        </Card>
    );
}

export default function MetricsOverview({ metrics, loading, category = 'all' }: MetricsOverviewProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(8)].map((_, i) => (
                    <Card key={i} className="p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </Card>
                ))}
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="text-center py-8 text-gray-500">
                No metrics available
            </div>
        );
    }

    const { totals } = metrics;

    // Format duration
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Email Metrics */}
            {(category === 'all' || category === 'email') && (
                <>
                    <MetricCard
                        title="Total Emails Sent"
                        value={totals.emails_sent_total}
                        subtitle={`AI: ${totals.emails_sent_by_ai} | Human: ${totals.emails_sent_by_human}`}
                        icon={<Mail className="w-6 h-6 text-blue-600" />}
                    />

                    <MetricCard
                        title="Emails Received"
                        value={totals.emails_received}
                        icon={<MessageSquare className="w-6 h-6 text-green-600" />}
                    />
                </>
            )}

            {/* Phone Metrics */}
            {(category === 'all' || category === 'phone') && (
                <>
                    <MetricCard
                        title="Total Calls"
                        value={totals.calls_total}
                        subtitle={`AI: ${totals.calls_by_ai} | Human: ${totals.calls_by_human}`}
                        icon={<Phone className="w-6 h-6 text-purple-600" />}
                    />

                    <MetricCard
                        title="Call Duration"
                        value={formatDuration(totals.calls_duration_seconds)}
                        icon={<Phone className="w-6 h-6 text-indigo-600" />}
                    />
                </>
            )}

            {/* Lead Metrics */}
            {(category === 'all' || category === 'lead') && (
                <MetricCard
                    title="Leads Created"
                    value={totals.leads_created}
                    icon={<Target className="w-6 h-6 text-orange-600" />}
                />
            )}

            {/* Contact Metrics */}
            {(category === 'all' || category === 'contact') && (
                <MetricCard
                    title="Contacts Created"
                    value={totals.contacts_created}
                    icon={<Users className="w-6 h-6 text-teal-600" />}
                />
            )}

            {/* Campaign Metrics */}
            {(category === 'all' || category === 'campaign') && (
                <>
                    <MetricCard
                        title="Campaigns Created"
                        value={totals.campaigns_created}
                        icon={<TrendingUp className="w-6 h-6 text-pink-600" />}
                    />

                    <MetricCard
                        title="Campaign Emails Sent"
                        value={totals.campaign_emails_sent || 0}
                        subtitle={`AI: ${totals.campaign_emails_sent_by_ai || 0} | Human: ${totals.campaign_emails_sent_by_human || 0}`}
                        icon={<Mail className="w-6 h-6 text-indigo-600" />}
                    />
                </>
            )}

            {/* Ticket Metrics */}
            {(category === 'all' || category === 'ticket') && (
                <MetricCard
                    title="Tickets Resolved"
                    value={totals.tickets_resolved}
                    subtitle={`Total Created: ${totals.tickets_created}`}
                    icon={<Ticket className="w-6 h-6 text-yellow-600" />}
                />
            )}
        </div>
    );
}
