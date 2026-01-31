"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle, Loader2, Download, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface BulkEmailProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    groupName: string;
}

interface JobStatus {
    id: string;
    group_name: string;
    status: string;
    total_recipients: number;
    emails_sent: number;
    emails_failed: number;
    progress_percent: number;
    current_email: string | null;
    error_message: string | null;
    failed_emails: Array<{ email: string; name: string; error: string; timestamp: string }>;
    started_at: string;
    completed_at: string | null;
    estimatedSecondsRemaining: number | null;
}

export default function BulkEmailProgressModal({
    isOpen,
    onClose,
    jobId,
    groupName
}: BulkEmailProgressModalProps) {
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [showFailedEmails, setShowFailedEmails] = useState(false);
    const [loading, setLoading] = useState(true);

    // Poll for job status
    useEffect(() => {
        if (!isOpen || !jobId) return;

        const fetchStatus = async () => {
            try {
                const status = await api.bulkEmail.getJobStatus(jobId);
                setJobStatus(status);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching job status:', error);
            }
        };

        // Initial fetch
        fetchStatus();

        // Poll every 2 seconds while job is running
        const interval = setInterval(() => {
            if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed' || jobStatus?.status === 'cancelled') {
                clearInterval(interval);
            } else {
                fetchStatus();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isOpen, jobId, jobStatus?.status]);

    if (!isOpen) return null;

    const formatTime = (seconds: number | null) => {
        if (!seconds) return 'Calculating...';
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const getStatusIcon = () => {
        if (!jobStatus) return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;

        switch (jobStatus.status) {
            case 'completed':
                return <CheckCircle2 className="h-6 w-6 text-green-500" />;
            case 'failed':
                return <XCircle className="h-6 w-6 text-red-500" />;
            case 'processing':
                return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
            case 'queued':
                return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
            default:
                return <AlertCircle className="h-6 w-6 text-gray-400" />;
        }
    };

    const getStatusText = () => {
        if (!jobStatus) return 'Loading...';

        switch (jobStatus.status) {
            case 'completed':
                return 'Completed';
            case 'failed':
                return 'Failed';
            case 'processing':
                return 'Sending...';
            case 'queued':
                return 'Queued';
            case 'cancelled':
                return 'Cancelled';
            default:
                return jobStatus.status;
        }
    };

    const canClose = jobStatus?.status === 'completed' || jobStatus?.status === 'failed' || jobStatus?.status === 'cancelled';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        {getStatusIcon()}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Bulk Email Job</h2>
                            <p className="text-sm text-gray-600">{groupName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={!canClose}
                        className={`p-2 rounded-lg transition ${canClose
                                ? 'hover:bg-gray-200 text-gray-600'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
                        title={canClose ? 'Close' : 'Job still running...'}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <>
                            {/* Status Badge */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Status:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${jobStatus?.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        jobStatus?.status === 'failed' ? 'bg-red-100 text-red-700' :
                                            jobStatus?.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                    }`}>
                                    {getStatusText()}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            {jobStatus && (
                                <div>
                                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                                        <span>Progress</span>
                                        <span className="font-medium">{jobStatus.progress_percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out rounded-full"
                                            style={{ width: `${jobStatus.progress_percent}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Stats Grid */}
                            {jobStatus && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-gray-900">{jobStatus.total_recipients}</div>
                                        <div className="text-xs text-gray-600 mt-1">Total</div>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-green-600">{jobStatus.emails_sent}</div>
                                        <div className="text-xs text-gray-600 mt-1">Sent</div>
                                    </div>
                                    <div className="bg-red-50 rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-red-600">{jobStatus.emails_failed}</div>
                                        <div className="text-xs text-gray-600 mt-1">Failed</div>
                                    </div>
                                </div>
                            )}

                            {/* Current Email */}
                            {jobStatus?.status === 'processing' && jobStatus.current_email && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <span className="font-medium">Currently sending to:</span>
                                        <br />
                                        <span className="font-mono text-xs">{jobStatus.current_email}</span>
                                    </p>
                                </div>
                            )}

                            {/* Estimated Time */}
                            {jobStatus?.status === 'processing' && jobStatus.estimatedSecondsRemaining && (
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <span>Estimated time remaining:</span>
                                    <span className="font-medium">{formatTime(jobStatus.estimatedSecondsRemaining)}</span>
                                </div>
                            )}

                            {/* Error Message */}
                            {jobStatus?.error_message && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-sm text-red-800">
                                        <span className="font-medium">Error:</span> {jobStatus.error_message}
                                    </p>
                                </div>
                            )}

                            {/* Failed Emails Section */}
                            {jobStatus && jobStatus.failed_emails && jobStatus.failed_emails.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setShowFailedEmails(!showFailedEmails)}
                                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
                                    >
                                        <span className="text-sm font-medium text-gray-900">
                                            Failed Emails ({jobStatus.failed_emails.length})
                                        </span>
                                        <Download className={`h-4 w-4 transition-transform ${showFailedEmails ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showFailedEmails && (
                                        <div className="max-h-64 overflow-y-auto">
                                            {jobStatus.failed_emails.map((failed, idx) => (
                                                <div key={idx} className="px-4 py-3 border-t border-gray-200 hover:bg-gray-50">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-gray-900">{failed.name || failed.email}</p>
                                                            <p className="text-xs font-mono text-gray-600">{failed.email}</p>
                                                        </div>
                                                        <XCircle className="h-4 w-4 text-red-500 mt-1 ml-2 flex-shrink-0" />
                                                    </div>
                                                    <p className="text-xs text-red-600 mt-1">{failed.error}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    {jobStatus?.status === 'processing' ? (
                        <p className="text-sm text-gray-600">
                            Job is running in the background. You can close this window.
                        </p>
                    ) : (
                        <p className="text-sm text-gray-600">
                            {jobStatus?.status === 'completed' && `Completed at ${new Date(jobStatus.completed_at!).toLocaleString()}`}
                            {jobStatus?.status === 'failed' && 'Job failed. See error details above.'}
                            {jobStatus?.status === 'cancelled' && 'Job was cancelled.'}
                        </p>
                    )}
                    <button
                        onClick={onClose}
                        disabled={!canClose}
                        className={`px-4 py-2 rounded-lg font-medium transition ${canClose
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {canClose ? 'Close' : 'Running...'}
                    </button>
                </div>
            </div>
        </div>
    );
}
