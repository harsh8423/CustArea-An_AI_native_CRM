'use client';

import { useState, useEffect } from 'react';
import {
    Users, Target, MessageSquare, Ticket, Bot, Workflow,
    Mail, Phone, MessageCircle, Globe, Clock, CheckCircle,
    AlertCircle, Loader2, ArrowRight, Sparkles, BarChart3,
    Send, FileText, TrendingUp, Zap, Calendar
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getWorkflows, getWorkflowRuns } from '../workflow/api';

const API_BASE = 'http://localhost:8000/api';

interface DashboardStats {
    contacts: { total: number };
    leads: { total: number; byStage: { stage_name: string; count: number }[] };
    conversations: {
        total: number;
        open: number;
        pending: number;
        resolved: number;
        byChannel: { whatsapp: number; widget: number; email: number; phone: number };
    };
    tickets: {
        total: number;
        new: number;
        open: number;
        pending: number;
        resolved: number;
        urgent: number;
    };
    workflows: { active: number; totalRuns: number };
    aiDeployments: { channel: string; enabled: boolean; schedule?: { start: string; end: string; days: string[] } }[];
}

async function fetchToken(url: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadDashboardData() {
        try {
            const [
                contactsRes,
                pipelineRes,
                convStatsRes,
                ticketStatsRes,
                workflowsRes,
                runsRes,
                deploymentsRes
            ] = await Promise.all([
                api.contacts.list({ limit: 1 }),
                api.leads.getPipeline(),
                api.conversations.getStats(),
                api.tickets.getStats(),
                getWorkflows({ status: 'active' }).catch(() => ({ workflows: [], total: 0 })),
                getWorkflowRuns({ limit: 1 }).catch(() => ({ runs: [], total: 0 })),
                fetchToken(`${API_BASE}/ai-agent/deployments`).catch(() => [])
            ]);

            const leadsByStage = pipelineRes?.stages?.map((s: any) => ({
                stage_name: s.name,
                count: s.leads?.length || 0
            })) || [];

            const totalLeads = leadsByStage.reduce((acc: number, s: any) => acc + s.count, 0);

            const convStats = convStatsRes?.stats || {};
            const ticketStats = ticketStatsRes?.stats || {};

            setStats({
                contacts: { total: contactsRes?.total || 0 },
                leads: { total: totalLeads, byStage: leadsByStage },
                conversations: {
                    total: parseInt(convStats.total_count) || 0,
                    open: parseInt(convStats.open_count) || 0,
                    pending: parseInt(convStats.pending_count) || 0,
                    resolved: parseInt(convStats.resolved_count) || 0,
                    byChannel: {
                        whatsapp: parseInt(convStats.whatsapp_count) || 0,
                        widget: parseInt(convStats.widget_count) || 0,
                        email: parseInt(convStats.email_count) || 0,
                        phone: parseInt(convStats.phone_count) || 0
                    }
                },
                tickets: {
                    total: parseInt(ticketStats.total_count) || 0,
                    new: parseInt(ticketStats.new_count) || 0,
                    open: parseInt(ticketStats.open_count) || 0,
                    pending: parseInt(ticketStats.pending_count) || 0,
                    resolved: parseInt(ticketStats.resolved_count) || 0,
                    urgent: parseInt(ticketStats.urgent_count) || 0
                },
                workflows: {
                    active: workflowsRes?.total || 0,
                    totalRuns: runsRes?.total || 0
                },
                aiDeployments: Array.isArray(deploymentsRes) ? deploymentsRes.map((d: any) => ({
                    channel: d.channel,
                    enabled: d.is_enabled,
                    schedule: d.schedule_enabled ? {
                        start: d.schedule_start_time,
                        end: d.schedule_end_time,
                        days: d.schedule_days
                    } : undefined
                })) : []
            });
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="h-full flex flex-col bg-[#eff0eb]">
                <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)] items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <p className="text-sm text-gray-500 mt-3">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto p-8">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-black">Dashboard</h1>
                            <p className="text-gray-500 mt-1">Overview of your CRM performance</p>
                        </div>

                        {/* Main Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {/* Contacts */}
                            <MetricCard
                                icon={Users}
                                label="Total Contacts"
                                value={stats?.contacts.total || 0}
                                href="/sales/contacts"
                            />
                            {/* Leads */}
                            <MetricCard
                                icon={Target}
                                label="Total Leads"
                                value={stats?.leads.total || 0}
                                href="/sales/leads"
                            />
                            {/* Conversations */}
                            <MetricCard
                                icon={MessageSquare}
                                label="Total Conversations"
                                value={stats?.conversations.total || 0}
                                href="/conversation"
                            />
                            {/* Tickets */}
                            <MetricCard
                                icon={Ticket}
                                label="Total Tickets"
                                value={stats?.tickets.total || 0}
                                href="/tickets"
                            />
                        </div>

                        {/* Leads by Stage */}
                        {stats?.leads.byStage && stats.leads.byStage.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">Leads by Stage</h2>
                                        <p className="text-xs text-gray-500">Pipeline overview</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {stats.leads.byStage.map((stage, i) => (
                                        <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-black">{stage.count}</p>
                                            <p className="text-xs text-gray-500 mt-1 truncate">{stage.stage_name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Conversations & Tickets Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Conversations by Channel */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">Conversations</h2>
                                        <p className="text-xs text-gray-500">By channel & status</p>
                                    </div>
                                </div>

                                {/* By Channel */}
                                <div className="grid grid-cols-4 gap-3 mb-6">
                                    <ChannelBadge icon={MessageCircle} label="WhatsApp" count={stats?.conversations.byChannel.whatsapp || 0} />
                                    <ChannelBadge icon={Globe} label="Widget" count={stats?.conversations.byChannel.widget || 0} />
                                    <ChannelBadge icon={Mail} label="Email" count={stats?.conversations.byChannel.email || 0} />
                                    <ChannelBadge icon={Phone} label="Phone" count={stats?.conversations.byChannel.phone || 0} />
                                </div>

                                {/* By Status */}
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="text-xs text-gray-400 uppercase mb-3">By Status</p>
                                    <div className="flex gap-4">
                                        <StatusPill label="Open" count={stats?.conversations.open || 0} color="bg-yellow-100 text-yellow-700" />
                                        <StatusPill label="Pending" count={stats?.conversations.pending || 0} color="bg-orange-100 text-orange-700" />
                                        <StatusPill label="Resolved" count={stats?.conversations.resolved || 0} color="bg-green-100 text-green-700" />
                                    </div>
                                </div>
                            </div>

                            {/* Tickets */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                        <Ticket className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">Tickets</h2>
                                        <p className="text-xs text-gray-500">Status breakdown</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-black">{stats?.tickets.new || 0}</p>
                                        <p className="text-xs text-gray-500">New</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-black">{stats?.tickets.open || 0}</p>
                                        <p className="text-xs text-gray-500">Open</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-black">{stats?.tickets.pending || 0}</p>
                                        <p className="text-xs text-gray-500">Pending</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-green-50 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-green-700">{stats?.tickets.resolved || 0}</p>
                                        <p className="text-xs text-green-600">Resolved</p>
                                    </div>
                                    <div className="bg-red-50 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-red-700">{stats?.tickets.urgent || 0}</p>
                                        <p className="text-xs text-red-600">Urgent</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI & Workflows Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* AI Agent Status */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">AI Agent</h2>
                                        <p className="text-xs text-gray-500">Deployment status</p>
                                    </div>
                                    <Link href="/ai-agent/deploy" className="ml-auto text-xs text-gray-500 hover:text-black flex items-center gap-1">
                                        Configure <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>

                                <div className="space-y-3">
                                    {['widget', 'whatsapp', 'email', 'phone'].map(channel => {
                                        const deployment = stats?.aiDeployments.find(d => d.channel === channel);
                                        const isEnabled = deployment?.enabled || channel === 'widget';
                                        const schedule = deployment?.schedule;

                                        return (
                                            <div key={channel} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <ChannelIcon channel={channel} />
                                                    <span className="font-medium text-sm capitalize text-black">{channel}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {schedule && (
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {schedule.start} - {schedule.end}
                                                        </span>
                                                    )}
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                                                        }`}>
                                                        {isEnabled ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Workflows */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                        <Workflow className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">Workflows</h2>
                                        <p className="text-xs text-gray-500">Automation metrics</p>
                                    </div>
                                    <Link href="/workflow" className="ml-auto text-xs text-gray-500 hover:text-black flex items-center gap-1">
                                        Manage <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                                        <div className="w-12 h-12 rounded-full bg-black mx-auto flex items-center justify-center mb-3">
                                            <Zap className="w-6 h-6 text-white" />
                                        </div>
                                        <p className="text-3xl font-bold text-black">{stats?.workflows.active || 0}</p>
                                        <p className="text-sm text-gray-500 mt-1">Active Workflows</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                                        <div className="w-12 h-12 rounded-full bg-black mx-auto flex items-center justify-center mb-3">
                                            <BarChart3 className="w-6 h-6 text-white" />
                                        </div>
                                        <p className="text-3xl font-bold text-black">{stats?.workflows.totalRuns || 0}</p>
                                        <p className="text-sm text-gray-500 mt-1">Total Runs</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Coming Soon Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Campaigns Coming Soon */}
                            <Link href="/campaign" className="group">
                                <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                <Send className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-white">Campaigns</h2>
                                                <p className="text-xs text-gray-400">Email & WhatsApp automation</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-white/10 text-white text-xs font-medium rounded-full flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Coming Soon
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                        Create multi-step campaigns with sequences, conditions, and lead tracking.
                                    </p>
                                    <div className="mt-4 flex items-center text-white/60 text-xs group-hover:text-white transition-colors">
                                        Learn more <ArrowRight className="w-3 h-3 ml-1" />
                                    </div>
                                </div>
                            </Link>

                            {/* Reports Coming Soon */}
                            <Link href="/report" className="group">
                                <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-white">Reports</h2>
                                                <p className="text-xs text-gray-400">AI-powered analytics</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-white/10 text-white text-xs font-medium rounded-full flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Coming Soon
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                        Create custom reports with AI. Schedule daily, weekly, or monthly delivery.
                                    </p>
                                    <div className="mt-4 flex items-center text-white/60 text-xs group-hover:text-white transition-colors">
                                        Learn more <ArrowRight className="w-3 h-3 ml-1" />
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Components
function MetricCard({ icon: Icon, label, value, href }: { icon: any; label: string; value: number; href: string }) {
    return (
        <Link href={href}>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-black transition-colors" />
                </div>
                <p className="text-3xl font-bold text-black">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
        </Link>
    );
}

function ChannelBadge({ icon: Icon, label, count }: { icon: any; label: string; count: number }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 text-center">
            <Icon className="w-5 h-5 text-gray-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-black">{count}</p>
            <p className="text-xs text-gray-500">{label}</p>
        </div>
    );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className={`px-4 py-2 rounded-full ${color} flex items-center gap-2`}>
            <span className="font-semibold">{count}</span>
            <span className="text-sm">{label}</span>
        </div>
    );
}

function ChannelIcon({ channel }: { channel: string }) {
    const icons: Record<string, any> = {
        widget: Globe,
        whatsapp: MessageCircle,
        email: Mail,
        phone: Phone
    };
    const Icon = icons[channel] || Globe;
    return <Icon className="w-4 h-4 text-gray-600" />;
}
