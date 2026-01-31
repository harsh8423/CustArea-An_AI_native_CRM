'use client';

/**
 * Bulk Phone Calling Page
 * 
 * Features:
 * - Start new bulk calling jobs
 * - View active job progress
 * - View bulk calling history
 * - Pause/Resume/Cancel jobs
 */

import { useState, useEffect } from 'react';
import { Phone, Users, Clock, TrendingUp, PhoneOff, Pause, Play, StopCircle, RefreshCw, Plus, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = 'http://localhost:8000/api';

interface Group {
    id: string;
    name: string;
    contact_count: number;
}

interface BulkJob {
    id: string;
    group_name: string;
    caller_phone_number: string;
    call_mode: 'ai' | 'human';
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';
    total_recipients: number;
    calls_completed: number;
    calls_failed: number;
    calls_in_progress: number;
    progress_percent: number;
    current_contact_name?: string;
    current_contact_phone?: string;
    call_records?: any[];
    failed_calls?: any[];
    total_call_duration_seconds: number;
    average_call_duration_seconds: number;
    estimated_completion_at?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}

export default function BulkCallingPage() {
    const [view, setView] = useState<'history' | 'new'>('history');
    const [jobs, setJobs] = useState<BulkJob[]>([]);
    const [selectedJob, setSelectedJob] = useState<BulkJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
    const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

    // New job form
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [customInstruction, setCustomInstruction] = useState('');
    const [callerNumber, setCallerNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch bulk jobs
    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/phone/bulk-jobs?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch jobs');

            const data = await response.json();
            setJobs(data.jobs || []);

            // Auto-select first active job if none selected
            if (!selectedJob && data.jobs?.length > 0) {
                const activeJob = data.jobs.find((j: BulkJob) => j.status === 'processing' || j.status === 'paused');
                setSelectedJob(activeJob || data.jobs[0]);
            }

            setLoading(false);
        } catch (err: any) {
            console.error('Failed to fetch jobs:', err);
            setLoading(false);
        }
    };

    // Fetch groups
    const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/contact-groups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch groups');

            const data = await response.json();
            setGroups(data.groups || []);
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        } finally {
            setLoadingGroups(false);
        }
    };

    // Fetch phone numbers from voice agents
    const fetchPhoneNumbers = async () => {
        setLoadingPhoneNumbers(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/voice-agents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch phone numbers');

            const data = await response.json();
            // Filter only active voice agents
            const activeAgents = (data.voiceAgents || []).filter((agent: any) => agent.is_active);
            setPhoneNumbers(activeAgents);
        } catch (err) {
            console.error('Failed to fetch phone numbers:', err);
        } finally {
            setLoadingPhoneNumbers(false);
        }
    };

    // Start bulk calling job
    const handleStartBulkCall = async () => {
        if (!selectedGroupId || !callerNumber) {
            setError('Please select a group and enter caller number');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/phone/bulk-call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    groupId: selectedGroupId,
                    callerPhoneNumber: callerNumber,
                    callMode: 'ai',
                    customInstruction: customInstruction || undefined
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start bulk call');
            }

            const data = await response.json();

            // Reset form
            setSelectedGroupId('');
            setCustomInstruction('');

            // Switch to history view and refresh
            setView('history');
            await fetchJobs();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Job actions
    const pauseJob = async (jobId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}/pause`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchJobs();
        } catch (err) {
            console.error('Failed to pause job:', err);
        }
    };

    const resumeJob = async (jobId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}/resume`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchJobs();
        } catch (err) {
            console.error('Failed to resume job:', err);
        }
    };

    const cancelJob = async (jobId: string) => {
        if (!confirm('Are you sure you want to cancel this bulk calling job?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchJobs();
        } catch (err) {
            console.error('Failed to cancel job:', err);
        }
    };

    // Smart polling: only poll when there are active/paused jobs
    useEffect(() => {
        // Initial fetch
        fetchJobs();

        // Set up polling interval - check every 5 seconds
        const interval = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE}/phone/bulk-jobs?limit=50`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) return;

                const data = await response.json();
                const fetchedJobs = data.jobs || [];

                // Only continue polling if there are active/paused jobs
                const hasActiveJobs = fetchedJobs.some((j: BulkJob) =>
                    j.status === 'processing' || j.status === 'paused'
                );

                setJobs(fetchedJobs);

                // If no active jobs, we still poll but less frequently is handled by interval
                // The interval continues but the state updates stop triggering re-renders
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, []); // Empty dependency array - only run once on mount

    // Sync selectedJob with jobs data when it updates
    useEffect(() => {
        if (selectedJob && jobs.length > 0) {
            // Find the updated version of the selected job
            const updatedJob = jobs.find(j => j.id === selectedJob.id);
            if (updatedJob) {
                // Update selectedJob state with fresh data
                setSelectedJob(updatedJob);
            }
        }
    }, [jobs]); // Re-run when jobs array updates

    // Fetch groups when switching to new job view
    useEffect(() => {
        if (view === 'new') {
            if (groups.length === 0) fetchGroups();
            if (phoneNumbers.length === 0) fetchPhoneNumbers();
        }
    }, [view]);

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const getETA = (job: BulkJob): string => {
        if (!job.estimated_completion_at) return 'Calculating...';
        const eta = new Date(job.estimated_completion_at);
        const now = new Date();
        const diffMs = eta.getTime() - now.getTime();
        if (diffMs <= 0) return 'Completing soon...';
        const diffMins = Math.ceil(diffMs / 1000 / 60);
        if (diffMins < 60) return `${diffMins} min`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
            processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Phone },
            paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Pause },
            completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
            failed: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
            cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', icon: StopCircle }
        };

        const config = styles[status as keyof typeof styles] || styles.pending;
        const Icon = config.icon;

        return (
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1', config.bg, config.text)}>
                <Icon className="h-3 w-3" />
                {status.toUpperCase()}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[#eff0eb]">
            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left Sidebar - Jobs List */}
                <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-gray-900 text-lg">Bulk Calling</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{jobs.length} jobs</p>
                            </div>
                            <button
                                onClick={fetchJobs}
                                className="p-2 hover:bg-gray-50 rounded-xl transition"
                            >
                                <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
                            </button>
                        </div>

                        {/* New Job Button */}
                        <button
                            onClick={() => setView('new')}
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 font-medium text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            New Bulk Call
                        </button>
                    </div>

                    {/* Jobs List */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Users className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-sm font-medium text-gray-500">No bulk jobs yet</p>
                                <p className="text-xs text-gray-400 mt-1 text-center">Start a new bulk calling campaign</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {jobs.map((job) => (
                                    <button
                                        key={job.id}
                                        onClick={() => {
                                            setSelectedJob(job);
                                            setView('history');
                                        }}
                                        className={cn(
                                            "w-full px-3 py-3 rounded-xl text-left transition",
                                            selectedJob?.id === job.id
                                                ? "bg-gradient-to-r from-purple-50 to-indigo-50"
                                                : "hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-sm text-gray-900 truncate">{job.group_name}</span>
                                            {getStatusBadge(job.status)}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                {job.calls_completed}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <XCircle className="h-3 w-3 text-red-500" />
                                                {job.calls_failed}
                                            </span>
                                            <span className="text-gray-400">
                                                {job.progress_percent}%
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    {view === 'new' ? (
                        /* New Bulk Call Form */
                        <>
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-900">Start New Bulk Call</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Call multiple contacts in a group with AI agent</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-2xl space-y-6">
                                    {error && (
                                        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-700">
                                            <AlertCircle className="h-5 w-5" />
                                            {error}
                                        </div>
                                    )}

                                    {/* Select Group */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Select Contact Group <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                            disabled={loadingGroups}
                                        >
                                            <option value="">-- Select a group --</option>
                                            {groups.map((group) => (
                                                <option key={group.id} value={group.id}>
                                                    {group.name} ({group.contact_count} contacts)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Caller Number - Dropdown */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Caller Phone Number <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={callerNumber}
                                            onChange={(e) => setCallerNumber(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                            disabled={loadingPhoneNumbers}
                                        >
                                            <option value="">-- Select a phone number --</option>
                                            {phoneNumbers.map((agent) => (
                                                <option key={agent.id} value={agent.phone_number}>
                                                    {agent.phone_number} ({agent.voice_agent_name})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {phoneNumbers.length === 0 && !loadingPhoneNumbers
                                                ? 'No active voice agents configured. Please set up a voice agent first.'
                                                : 'Select from your configured voice agent numbers'}
                                        </p>
                                    </div>

                                    {/* Custom Instructions */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Custom Instructions (Optional)
                                        </label>
                                        <textarea
                                            value={customInstruction}
                                            onChange={(e) => setCustomInstruction(e.target.value)}
                                            placeholder="e.g., Be brief, ask about product feedback"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-none"
                                            rows={3}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">These instructions will be prioritized for all calls in this campaign</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleStartBulkCall}
                                            disabled={submitting || !selectedGroupId || !callerNumber}
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
                                        >
                                            <Phone className="h-5 w-5" />
                                            {submitting ? 'Starting...' : 'Start Bulk Call'}
                                        </button>
                                        <button
                                            onClick={() => setView('history')}
                                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : selectedJob ? (
                        /* Job Details & Progress */
                        <>
                            <div className="px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{selectedJob.group_name}</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">{selectedJob.total_recipients} contacts</p>
                                    </div>
                                    {getStatusBadge(selectedJob.status)}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Progress Bar */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">Progress</span>
                                        <span className="text-sm font-semibold text-gray-900">{selectedJob.progress_percent}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-500 rounded-full",
                                                selectedJob.status === 'completed' ? 'bg-green-500' :
                                                    selectedJob.status === 'failed' ? 'bg-red-500' :
                                                        'bg-gradient-to-r from-purple-500 to-indigo-500'
                                            )}
                                            style={{ width: `${selectedJob.progress_percent}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Current Call */}
                                {selectedJob.status === 'processing' && selectedJob.current_contact_name && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <Phone className="h-5 w-5 text-purple-600 animate-pulse" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-700">Currently Calling</div>
                                                <div className="text-base font-semibold text-gray-900 mt-1">{selectedJob.current_contact_name}</div>
                                                <div className="text-sm text-gray-500">{selectedJob.current_contact_phone}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                        <div className="text-2xl font-bold text-green-700">{selectedJob.calls_completed}</div>
                                        <div className="text-xs text-green-600 mt-1">Completed</div>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                        <div className="text-2xl font-bold text-red-700">{selectedJob.calls_failed}</div>
                                        <div className="text-xs text-red-600 mt-1">Failed</div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                        <div className="text-2xl font-bold text-blue-700">
                                            {selectedJob.total_recipients - selectedJob.calls_completed - selectedJob.calls_failed}
                                        </div>
                                        <div className="text-xs text-blue-600 mt-1">Remaining</div>
                                    </div>
                                </div>

                                {/* Time Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        <div>
                                            <div className="text-gray-500">Avg Duration</div>
                                            <div className="font-semibold text-gray-900">{formatDuration(selectedJob.average_call_duration_seconds || 0)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <TrendingUp className="h-4 w-4 text-gray-400" />
                                        <div>
                                            <div className="text-gray-500">Est. Remaining</div>
                                            <div className="font-semibold text-gray-900">{getETA(selectedJob)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Completed Calls */}
                                {selectedJob.call_records && selectedJob.call_records.length > 0 && (
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            Completed Calls ({selectedJob.call_records.length})
                                        </div>
                                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                            {selectedJob.call_records.map((call: any, idx: number) => (
                                                <div key={idx} className="px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{call.contactName}</div>
                                                            <div className="text-sm text-gray-500">{call.phone}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                                                                {call.duration}s
                                                            </div>
                                                            {call.summary && (
                                                                <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                                                                    {call.summary}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Failed Calls */}
                                {selectedJob.failed_calls && selectedJob.failed_calls.length > 0 && (
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                            <PhoneOff className="h-4 w-4" />
                                            Failed Calls ({selectedJob.failed_calls.length})
                                        </div>
                                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                            {selectedJob.failed_calls.map((call: any, idx: number) => (
                                                <div key={idx} className="px-4 py-3 border-b border-gray-100 last:border-0">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{call.contactName}</div>
                                                            <div className="text-sm text-gray-500">{call.phone}</div>
                                                        </div>
                                                        <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                                                            {call.error}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t border-gray-100">
                                    {selectedJob.status === 'processing' && (
                                        <>
                                            <button
                                                onClick={() => pauseJob(selectedJob.id)}
                                                className="flex-1 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
                                            >
                                                <Pause className="h-4 w-4" />
                                                Pause
                                            </button>
                                            <button
                                                onClick={() => cancelJob(selectedJob.id)}
                                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
                                            >
                                                <StopCircle className="h-4 w-4" />
                                                Cancel
                                            </button>
                                        </>
                                    )}

                                    {selectedJob.status === 'paused' && (
                                        <button
                                            onClick={() => resumeJob(selectedJob.id)}
                                            className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
                                        >
                                            <Play className="h-4 w-4" />
                                            Resume
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* No Job Selected */
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Users className="h-16 w-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Job Selected</h3>
                            <p className="text-sm text-gray-400">Select a job from the list or start a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
