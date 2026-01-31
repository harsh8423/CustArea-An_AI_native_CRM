"use client"

import { useState, useEffect } from "react";
import { Mail, Send, Clock, CheckCircle, XCircle, Search, Filter, Calendar, Users, Eye, Download } from "lucide-react";
import { api } from "@/lib/api";
import BulkEmailProgressModal from "@/components/conversation/BulkEmailProgressModal";

type TabType = 'single' | 'bulk';

interface OutboundEmail {
    id: string;
    from_email: string;
    to_email: string;
    subject: string;
    status: string;
    sent_at: string;
    provider_type: string;
    error_message?: string;
}

interface BulkJob {
    id: string;
    group_name: string;
    from_email: string;
    subject: string;
    status: string;
    total_recipients: number;
    emails_sent: number;
    emails_failed: number;
    progress_percent: number;
    provider_type: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}

export default function EmailHistoryPage() {
    const [activeTab, setActiveTab] = useState<TabType>('single');
    const [singleEmails, setSingleEmails] = useState<OutboundEmail[]>([]);
    const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('7days');

    // Pagination
    const [singlePage, setSinglePage] = useState(0);
    const [bulkPage, setBulkPage] = useState(0);
    const [singleTotal, setSingleTotal] = useState(0);
    const [bulkTotal, setBulkTotal] = useState(0);
    const limit = 20;

    // Modal state
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [showProgressModal, setShowProgressModal] = useState(false);

    useEffect(() => {
        if (activeTab === 'single') {
            fetchSingleEmails();
        } else {
            fetchBulkJobs();
        }
    }, [activeTab, singlePage, bulkPage, searchQuery, statusFilter, dateFilter]);

    const getDateRange = () => {
        const now = new Date();
        let startDate = new Date();

        switch (dateFilter) {
            case '24h':
                startDate.setDate(now.getDate() - 1);
                break;
            case '7days':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(now.getDate() - 30);
                break;
            default:
                return {};
        }

        return {
            startDate: startDate.toISOString(),
            endDate: now.toISOString()
        };
    };

    const fetchSingleEmails = async () => {
        setLoading(true);
        try {
            const dateRange = getDateRange();
            const data = await api.emailHistory.getOutbound({
                limit,
                offset: singlePage * limit,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                search: searchQuery || undefined,
                ...dateRange
            });
            setSingleEmails(data.emails);
            setSingleTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch single emails:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBulkJobs = async () => {
        setLoading(true);
        try {
            const dateRange = getDateRange();
            const data = await api.emailHistory.getBulkJobs({
                limit,
                offset: bulkPage * limit,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                ...dateRange
            });
            setBulkJobs(data.jobs);
            setBulkTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch bulk jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; icon: any }> = {
            sent: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
            delivered: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
            failed: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
            queued: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
            processing: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
            completed: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
        };

        const style = styles[status.toLowerCase()] || styles.queued;
        const Icon = style.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${style.bg} ${style.text}`}>
                <Icon className="h-3 w-3" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Send History</h1>
                    <p className="text-gray-600">View and manage all your sent emails</p>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                    <div className="border-b border-gray-200">
                        <div className="flex gap-1 p-2">
                            <button
                                onClick={() => setActiveTab('single')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'single'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Mail className="h-4 w-4" />
                                Single Emails
                                {singleTotal > 0 && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{singleTotal}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('bulk')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'bulk'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Users className="h-4 w-4" />
                                Bulk Jobs
                                {bulkTotal > 0 && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{bulkTotal}</span>}
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex flex-wrap gap-3">
                            {/* Search */}
                            <div className="flex-1 min-w-[250px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={activeTab === 'single' ? "Search by recipient or subject..." : "Search by group name..."}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="failed">Failed</option>
                                {activeTab === 'bulk' && <option value="processing">Processing</option>}
                                {activeTab === 'bulk' && <option value="completed">Completed</option>}
                            </select>

                            {/* Date Filter */}
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="24h">Last 24 hours</option>
                                <option value="7days">Last 7 days</option>
                                <option value="30days">Last 30 days</option>
                                <option value="all">All time</option>
                            </select>
                        </div>
                    </div>

                    {/* Table Content */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : activeTab === 'single' ? (
                            /* Single Emails Table */
                            singleEmails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Mail className="h-12 w-12 mb-3" />
                                    <p className="text-sm font-medium">No emails found</p>
                                    <p className="text-xs">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">From</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">To</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Subject</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Sent</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Provider</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {singleEmails.map((email) => (
                                            <tr key={email.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 text-sm text-gray-900">{email.from_email}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{email.to_email}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{email.subject || '(No subject)'}</td>
                                                <td className="px-6 py-4">{getStatusBadge(email.status)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(email.sent_at)}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500 uppercase">{email.provider_type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        ) : (
                            /* Bulk Jobs Table */
                            bulkJobs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Users className="h-12 w-12 mb-3" />
                                    <p className="text-sm font-medium">No bulk jobs found</p>
                                    <p className="text-xs">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Group</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Subject</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Recipients</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Sent/Failed</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Created</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bulkJobs.map((job) => (
                                            <tr key={job.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.group_name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{job.subject}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{job.total_recipients}</td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">
                                                        <span className="text-green-700 font-medium">{job.emails_sent}</span>
                                                        {job.emails_failed > 0 && (
                                                            <> / <span className="text-red-700 font-medium">{job.emails_failed}</span></>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(job.created_at)}</td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedJobId(job.id);
                                                            setShowProgressModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>

                    {/* Pagination */}
                    {((activeTab === 'single' && singleTotal > limit) || (activeTab === 'bulk' && bulkTotal > limit)) && (
                        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing {activeTab === 'single' ? singlePage * limit + 1 : bulkPage * limit + 1} to{' '}
                                {Math.min(
                                    activeTab === 'single' ? (singlePage + 1) * limit : (bulkPage + 1) * limit,
                                    activeTab === 'single' ? singleTotal : bulkTotal
                                )}{' '}
                                of {activeTab === 'single' ? singleTotal : bulkTotal} results
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => activeTab === 'single' ? setSinglePage(p => Math.max(0, p - 1)) : setBulkPage(p => Math.max(0, p - 1))}
                                    disabled={(activeTab === 'single' ? singlePage : bulkPage) === 0}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => activeTab === 'single' ? setSinglePage(p => p + 1) : setBulkPage(p => p + 1)}
                                    disabled={
                                        (activeTab === 'single' ? (singlePage + 1) * limit >= singleTotal : (bulkPage + 1) * limit >= bulkTotal)
                                    }
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Job Details Modal */}
            {selectedJobId && (
                <BulkEmailProgressModal
                    isOpen={showProgressModal}
                    onClose={() => {
                        setShowProgressModal(false);
                        setSelectedJobId(null);
                    }}
                    jobId={selectedJobId}
                    groupName={bulkJobs.find(j => j.id === selectedJobId)?.group_name || ''}
                />
            )}
        </div>
    );
}
