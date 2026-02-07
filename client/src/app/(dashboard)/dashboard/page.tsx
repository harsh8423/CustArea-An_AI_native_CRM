'use client';

import { useState, useEffect } from 'react';
import {
    Users, Target, MessageSquare, Ticket,
    Loader2, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getWorkflows, getWorkflowRuns } from '../workflow/api';
import QuickActions from './components/QuickActions';
import SystemStatus from './components/SystemStatus';
import UsageWidget from './components/UsageWidget';
import RecentActivity from './components/RecentActivity';

const API_BASE = 'http://localhost:8000/api';

interface DashboardStats {
    contacts: { total: number };
    leads: { total: number };
    conversations: {
        total: number;
        open: number;
        pending: number;
        resolved: number;
    };
    tickets: {
        total: number;
        new: number;
        open: number;
        pending: number;
        resolved: number;
        urgent: number;
    };
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
                deploymentsRes
            ] = await Promise.all([
                api.contacts.list({ limit: 1 }),
                api.leads.getPipeline(),
                api.conversations.getStats(),
                api.tickets.getStats(),
                fetchToken(`${API_BASE}/ai-agent/deployments`).catch(() => [])
            ]);

            const leadsByStage = pipelineRes?.stages?.map((s: any) => ({
                count: s.leads?.length || 0
            })) || [];

            const totalLeads = leadsByStage.reduce((acc: number, s: any) => acc + s.count, 0);

            const convStats = convStatsRes?.stats || {};
            const ticketStats = ticketStatsRes?.stats || {};

            setStats({
                contacts: { total: contactsRes?.total || 0 },
                leads: { total: totalLeads },
                conversations: {
                    total: parseInt(convStats.total_count) || 0,
                    open: parseInt(convStats.open_count) || 0,
                    pending: parseInt(convStats.pending_count) || 0,
                    resolved: parseInt(convStats.resolved_count) || 0,
                },
                tickets: {
                    total: parseInt(ticketStats.total_count) || 0,
                    new: parseInt(ticketStats.new_count) || 0,
                    open: parseInt(ticketStats.open_count) || 0,
                    pending: parseInt(ticketStats.pending_count) || 0,
                    resolved: parseInt(ticketStats.resolved_count) || 0,
                    urgent: parseInt(ticketStats.urgent_count) || 0
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
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-7xl mx-auto p-8">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-black">Dashboard</h1>
                            <p className="text-gray-500 mt-1">Overview of your operations</p>
                        </div>

                        {/* Main Metrics Grid - Quick Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <MetricCard
                                icon={Users}
                                label="Total Contacts"
                                value={stats?.contacts.total || 0}
                                href="/sales/contacts"
                                color="bg-blue-500"
                            />
                            <MetricCard
                                icon={Target}
                                label="Total Leads"
                                value={stats?.leads.total || 0}
                                href="/sales/leads"
                                color="bg-orange-500"
                            />
                            <MetricCard
                                icon={MessageSquare}
                                label="Active Conversations"
                                value={stats?.conversations.open || 0}
                                href="/conversation"
                                color="bg-green-500"
                            />
                            <MetricCard
                                icon={Ticket}
                                label="Open Tickets"
                                value={stats?.tickets.open || 0}
                                href="/tickets"
                                color="bg-purple-500"
                            />
                        </div>

                        {/* Operations Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            <div className="lg:col-span-2">
                                <QuickActions />
                            </div>
                            <div>
                                <SystemStatus deployments={stats?.aiDeployments || []} />
                            </div>
                        </div>

                        {/* Activity & Usage Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <RecentActivity />
                            </div>
                            <div>
                                <UsageWidget />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Components
function MetricCard({ icon: Icon, label, value, href, color }: { icon: any; label: string; value: number; href: string; color: string }) {
    return (
        <Link href={href}>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${color}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-black transition-colors" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
        </Link>
    );
}
