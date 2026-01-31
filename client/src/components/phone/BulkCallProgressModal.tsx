'use client';

/**
 * Bulk Phone Call Progress Modal
 * 
 * Real-time progress tracking for bulk phone calling jobs
 * Features:
 * - Progress bar with percentage
 * - Current call status
 * - Stats (completed/failed/remaining)
 * - Est time remaining
 * - Pause/Resume/Cancel buttons
 * - Failed calls list
 * - Call duration tracking
 */

import { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, Pause, Play, StopCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkCallProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
}

interface JobStatus {
    id: string;
    group_name: string;
    status: string;
    total_recipients: number;
    calls_completed: number;
    calls_failed: number;
    calls_in_progress: number;
    progress_percent: number;
    current_contact_name?: string;
    current_contact_phone?: string;
    call_records: CallRecord[];
    failed_calls: FailedCall[];
    total_call_duration_seconds: number;
    average_call_duration_seconds: number;
    estimated_completion_at?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}

interface CallRecord {
    contactId: string;
    contactName: string;
    phone: string;
    status: string;
    duration: number;
    callSid: string;
    startedAt: string;
    endedAt: string;
}

interface FailedCall {
    contactId: string;
    contactName: string;
    phone: string;
    error: string;
    errorMessage: string;
    timestamp: string;
}

const API_BASE = 'http://localhost:8000/api';

export default function BulkCallProgressModal({ isOpen, onClose, jobId }: BulkCallProgressModalProps) {
    const [job, setJob] = useState<JobStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPausing, setIsPausing] = useState(false);
    const [isResuming, setIsResuming] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // Fetch job status
    const fetchJobStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch job status');
            }

            const data = await response.json();
            setJob(data);
            setLoading(false);
            setError(null);

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Pause job
    const handlePause = async () => {
        setIsPausing(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}/pause`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await fetchJobStatus();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsPausing(false);
        }
    };

    // Resume job
    const handleResume = async () => {
        setIsResuming(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}/resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await fetchJobStatus();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsResuming(false);
        }
    };

    // Cancel job
    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this bulk calling job? This action cannot be undone.')) {
            return;
        }

        setIsCancelling(true);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/phone/bulk-jobs/${jobId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await fetchJobStatus();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsCancelling(false);
        }
    };

    // Poll for updates
    useEffect(() => {
        if (!isOpen || !jobId) return;

        fetchJobStatus();

        // Poll every 3 seconds if job is processing or paused
        const interval = setInterval(() => {
            if (job?.status === 'processing' || job?.status === 'paused') {
                fetchJobStatus();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [isOpen, jobId, job?.status]);

    if (!isOpen) return null;

    // Format duration
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
    };

    // Calculate ETA
    const getETA = (): string => {
        if (!job?.estimated_completion_at) return 'Calculating...';

        const eta = new Date(job.estimated_completion_at);
        const now = new Date();
        const diffMs = eta.getTime() - now.getTime();

        if (diffMs <= 0) return 'Completing soon...';

        const diffMins = Math.ceil(diffMs / 1000 / 60);

        if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-gray-100 text-gray-700',
            processing: 'bg-blue-100 text-blue-700',
            paused: 'bg-yellow-100 text-yellow-700',
            completed: 'bg-green-100 text-green-700',
            failed: 'bg-red-100 text-red-700',
            cancelled: 'bg-gray-100 text-gray-700'
        };

        return (
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', styles[status as keyof typeof styles] || styles.pending)}>
                {status.toUpperCase()}
            </span>
        );
    };

    const remaining = (job?.total_recipients || 0) - (job?.calls_completed || 0) - (job?.calls_failed || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Bulk Calling Progress</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {job?.group_name || 'Loading...'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-lg transition"
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                                <p className="text-red-600">{error}</p>
                            </div>
                        </div>
                    ) : job ? (
                        <>
                            {/* Status & Progress */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-medium text-gray-700">Status</div>
                                    {getStatusBadge(job.status)}
                                </div>

                                {/* Progress Bar */}
                                <div className="relative">
                                    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-500 rounded-full",
                                                job.status === 'completed' ? 'bg-green-500' :
                                                    job.status === 'failed' ? 'bg-red-500' :
                                                        job.status === 'cancelled' ? 'bg-gray-400' :
                                                            'bg-gradient-to-r from-purple-500 to-indigo-500'
                                            )}
                                            style={{ width: `${job.progress_percent}%` }}
                                        />
                                    </div>
                                    <div className="text-center mt-2 text-sm font-semibold text-gray-900">
                                        {job.progress_percent}% Complete
                                    </div>
                                </div>
                            </div>

                            {/* Current Call */}
                            {job.status === 'processing' && job.current_contact_name && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <Phone className="h-5 w-5 text-purple-600 animate-pulse" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-700">Currently Calling</div>
                                            <div className="text-base font-semibold text-gray-900 mt-1">
                                                {job.current_contact_name}
                                            </div>
                                            <div className="text-sm text-gray-500">{job.current_contact_phone}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-green-700">{job.calls_completed}</div>
                                    <div className="text-xs text-green-600 mt-1">Completed</div>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-red-700">{job.calls_failed}</div>
                                    <div className="text-xs text-red-600 mt-1">Failed</div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-blue-700">{remaining}</div>
                                    <div className="text-xs text-blue-600 mt-1">Remaining</div>
                                </div>
                            </div>

                            {/* Time Stats */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-gray-500">Avg Call Duration</div>
                                        <div className="font-semibold text-gray-900">
                                            {formatDuration(job.average_call_duration_seconds || 0)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-gray-500">Est. Time Remaining</div>
                                        <div className="font-semibold text-gray-900">{getETA()}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Failed Calls List */}
                            {job.failed_calls && job.failed_calls.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <PhoneOff className="h-4 w-4" />
                                        Failed Calls ({job.failed_calls.length})
                                    </div>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                        {job.failed_calls.map((call, idx) => (
                                            <div key={idx} className="px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900">{call.contactName}</div>
                                                        <div className="text-sm text-gray-500">{call.phone}</div>
                                                    </div>
                                                    <div className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                                                        {call.error}
                                                    </div>
                                                </div>
                                                {call.errorMessage && (
                                                    <div className="text-xs text-gray-500 mt-1">{call.errorMessage}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Footer - Action Buttons */}
                {job && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                            {job.total_recipients} total contacts
                        </div>

                        <div className="flex gap-2">
                            {job.status === 'processing' && (
                                <button
                                    onClick={handlePause}
                                    disabled={isPausing}
                                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                >
                                    <Pause className="h-4 w-4" />
                                    {isPausing ? 'Pausing...' : 'Pause'}
                                </button>
                            )}

                            {job.status === 'paused' && (
                                <button
                                    onClick={handleResume}
                                    disabled={isResuming}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                >
                                    <Play className="h-4 w-4" />
                                    {isResuming ? 'Resuming...' : 'Resume'}
                                </button>
                            )}

                            {(job.status === 'processing' || job.status === 'paused' || job.status === 'pending') && (
                                <button
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                >
                                    <StopCircle className="h-4 w-4" />
                                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                                </button>
                            )}

                            {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm font-medium"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
