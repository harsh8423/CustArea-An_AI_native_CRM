'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Play, Pause, RefreshCw, Mail, Users, Send, Clock,
    TrendingUp, UserCheck, AlertCircle, CheckCircle, X, Eye, Edit,
    Sparkles, Target, BarChart3, Calendar, MessageCircle, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { campaignApi } from '@/lib/campaignApi';

export default function CampaignDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.id as string;

    const [campaign, setCampaign] = useState<any>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'contacts'>('overview');

    useEffect(() => {
        if (campaignId) {
            fetchCampaignData();
        }
    }, [campaignId]);

    const fetchCampaignData = async () => {
        setLoading(true);
        try {
            const [campaignRes, analyticsRes, templatesRes] = await Promise.all([
                campaignApi.get(campaignId),
                campaignApi.getAnalytics(campaignId),
                campaignApi.getTemplates(campaignId)
            ]);

            setCampaign(campaignRes);
            setAnalytics(analyticsRes.analytics);
            setTemplates(templatesRes.templates || []);
        } catch (error) {
            console.error('Failed to fetch campaign data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLaunch = async () => {
        try {
            await campaignApi.launch(campaignId);
            fetchCampaignData();
        } catch (error) {
            console.error('Failed to launch campaign:', error);
            alert('Failed to launch campaign');
        }
    };

    const handlePause = async () => {
        try {
            await campaignApi.pause(campaignId);
            fetchCampaignData();
        } catch (error) {
            console.error('Failed to pause campaign:', error);
        }
    };

    const handleResume = async () => {
        try {
            await campaignApi.resume(campaignId);
            fetchCampaignData();
        } catch (error) {
            console.error('Failed to resume campaign:', error);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <RefreshCw className="h-8 w-8 text-gray-300 animate-spin" />
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Campaign not found</p>
                </div>
            </div>
        );
    }

    const statusColors = {
        draft: 'bg-gray-100 text-gray-600',
        active: 'bg-green-50 text-green-600',
        paused: 'bg-amber-50 text-amber-600',
        completed: 'bg-blue-50 text-blue-600'
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => router.push('/campaign')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-sm font-medium">Back to Campaigns</span>
                        </button>
                        <div className="flex items-center gap-2">
                            {campaign.status === 'draft' && (
                                <button
                                    onClick={handleLaunch}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition"
                                >
                                    <Play className="h-4 w-4" />
                                    Launch Campaign
                                </button>
                            )}
                            {campaign.status === 'active' && (
                                <button
                                    onClick={handlePause}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition"
                                >
                                    <Pause className="h-4 w-4" />
                                    Pause
                                </button>
                            )}
                            {campaign.status === 'paused' && (
                                <button
                                    onClick={handleResume}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition"
                                >
                                    <Play className="h-4 w-4" />
                                    Resume
                                </button>
                            )}
                            <button
                                onClick={fetchCampaignData}
                                className="p-2 hover:bg-gray-100 rounded-xl transition"
                            >
                                <RefreshCw className="h-4 w-4 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
                                <span className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-medium",
                                    statusColors[campaign.status as keyof typeof statusColors] || statusColors.draft
                                )}>
                                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                                </span>
                            </div>
                            <p className="text-gray-500">{campaign.company_name}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 bg-gray-50 p-1 rounded-xl w-fit">
                        {(['overview', 'templates', 'contacts'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded-lg transition",
                                    activeTab === tab
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                )}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'overview' && (
                        <OverviewTab campaign={campaign} analytics={analytics} />
                    )}
                    {activeTab === 'templates' && (
                        <TemplatesTab templates={templates} />
                    )}
                    {activeTab === 'contacts' && (
                        <ContactsTab campaignId={campaignId} />
                    )}
                </div>
            </div>
        </div>
    );
}

function OverviewTab({ campaign, analytics }: any) {
    const stats = [
        {
            label: 'Total Enrolled',
            value: analytics?.total_enrolled || 0,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
        },
        {
            label: 'Emails Sent',
            value: analytics?.emails_sent || 0,
            icon: Send,
            color: 'from-purple-500 to-pink-600',
        },
        {
            label: 'Replied',
            value: analytics?.replied || 0,
            icon: MessageCircle,
            color: 'from-green-500 to-emerald-600',
        },
        {
            label: 'Pending',
            value: analytics?.pending || 0,
            icon: Clock,
            color: 'from-amber-500 to-orange-600',
        },
    ];

    const replyRate = analytics?.emails_sent > 0
        ? ((analytics?.replied / analytics?.emails_sent) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center",
                                    stat.color
                                )}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                            <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Performance Metrics */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Reply Rate</div>
                        <div className="text-3xl font-bold text-green-600">{replyRate}%</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Today's Sends</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {analytics?.emails_sent_today || 0}
                            <span className="text-sm text-gray-400 ml-2">/ {campaign.daily_send_limit}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Bounce Rate</div>
                        <div className="text-3xl font-bold text-red-600">
                            {analytics?.emails_sent > 0
                                ? ((analytics.bounced / analytics.emails_sent) * 100).toFixed(1)
                                : '0.0'}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaign Details */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Campaign Details</h3>
                <div className="space-y-3">
                    <DetailRow label="Objective" value={campaign.campaign_objective} />
                    <DetailRow label="Selling Points" value={campaign.selling_points} />
                    <DetailRow label="Pain Points" value={campaign.pain_points} />
                    <DetailRow label="Value Proposition" value={campaign.value_proposition} />
                    {campaign.proof_points && (
                        <DetailRow label="Proof Points" value={campaign.proof_points} />
                    )}
                    <div className="pt-3 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Reply Handling</div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2 py-1 rounded-md text-xs font-medium",
                                        campaign.reply_handling === 'ai'
                                            ? "bg-blue-50 text-blue-600"
                                            : "bg-gray-100 text-gray-600"
                                    )}>
                                        {campaign.reply_handling === 'ai' ? '🤖 AI Agent' : '👤 Human'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Language</div>
                                <div className="text-sm font-medium text-gray-900">{campaign.language}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TemplatesTab({ templates }: any) {
    const initialTemplate = templates.find((t: any) => t.template_type === 'initial');
    const followUpTemplates = templates.filter((t: any) => t.template_type === 'follow_up');

    return (
        <div className="space-y-4">
            {initialTemplate && (
                <TemplateCard template={initialTemplate} index={0} label="Initial Email" />
            )}
            {followUpTemplates.map((template: any, index: number) => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    index={index + 1}
                    label={`Follow-up ${index + 1}`}
                />
            ))}
            {templates.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Sparkles className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500">No templates generated yet</p>
                </div>
            )}
        </div>
    );
}

function TemplateCard({ template, index, label }: any) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                        {index + 1}
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900">{label}</h4>
                        {template.is_ai_generated && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                                <Sparkles className="h-3 w-3" />
                                AI Generated
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    {expanded ? 'Collapse' : 'Expand'}
                </button>
            </div>

            <div className="space-y-3">
                <div>
                    <div className="text-xs text-gray-500 mb-1">Subject</div>
                    <div className="text-sm font-medium text-gray-900">{template.subject}</div>
                </div>

                {expanded && (
                    <>
                        <div>
                            <div className="text-xs text-gray-500 mb-2">Email Body</div>
                            <div
                                className="text-sm text-gray-700 p-4 bg-gray-50 rounded-lg"
                                dangerouslySetInnerHTML={{ __html: template.body_html }}
                            />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-2">Personalization Fields</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(template.personalization_fields || {}).map((field) => (
                                    <span
                                        key={field}
                                        className="px-2 py-1 bg-purple-50 text-purple-600 text-xs font-mono rounded"
                                    >
                                        {`{{${field}}}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ContactsTab({ campaignId }: any) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await campaignApi.getContacts(campaignId, {
                limit: pagination.limit,
                offset: (pagination.page - 1) * pagination.limit,
                search
            });
            setContacts(res.contacts || []);
            setPagination(prev => ({ ...prev, total: res.pagination.total }));
        } catch (error) {
            console.error('Failed to fetch contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [campaignId, pagination.page, search]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
        fetchContacts();
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'replied':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Replied</span>;
            case 'sent':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center gap-1"><Send className="h-3 w-3" /> Sent</span>;
            case 'bounced':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Bounced</span>;
            case 'completed':
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</span>;
            default:
                return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
                <form onSubmit={handleSearch} className="flex items-center gap-2 w-full max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button type="submit" className="hidden">Search</button>
                </form>
                <button onClick={fetchContacts} className="p-2 hover:bg-gray-100 rounded-lg transition">
                    <RefreshCw className={cn("h-4 w-4 text-gray-500", loading && "animate-spin")} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                        <tr>
                            <th className="px-6 py-4 font-medium">Contact</th>
                            <th className="px-6 py-4 font-medium">Company</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Current Step</th>
                            <th className="px-6 py-4 font-medium">Next Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && contacts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading contacts...</td>
                            </tr>
                        ) : contacts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No contacts found</td>
                            </tr>
                        ) : (
                            contacts.map((contact: any) => (
                                <tr key={contact.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{contact.name}</div>
                                        <div className="text-gray-500 text-xs">{contact.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{contact.company || '-'}</td>
                                    <td className="px-6 py-4">
                                        {statusBadge(contact.status)}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        Step {contact.current_follow_up_step}
                                        {contact.last_sent_at && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                Last: {new Date(contact.last_sent_at).toLocaleDateString()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {contact.next_send_at ? (
                                            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(contact.next_send_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        ) : contact.status === 'replied' ? (
                                            <span className="text-gray-400 italic">Sequence stopped</span>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm text-gray-500">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            disabled={pagination.page * pagination.limit >= pagination.total}
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-sm text-gray-900">{value}</div>
        </div>
    );
}
