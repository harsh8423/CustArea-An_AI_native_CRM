import { Clock, Trash2, User, Bot, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { api } from "@/lib/api";

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    content_text: string;
    created_at: string;
    metadata?: any;
}

interface PhoneLogViewProps {
    messages: Message[];
    conversationId?: string;
    onDelete?: () => void;
    callSummary?: string | null;
}

export function PhoneLogView({ messages, conversationId, onDelete, callSummary }: PhoneLogViewProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatCallTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!conversationId) {
            console.error('No conversation ID provided');
            return;
        }

        setDeletingId(conversationId);
        try {
            await api.conversations.delete(conversationId);
            console.log('Conversation deleted successfully');
            setShowDeleteConfirm(false);

            if (onDelete) {
                onDelete();
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            alert('Failed to delete conversation. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
    };

    // Get call metadata from first message
    const firstMessage = messages[0];
    const callMetadata = firstMessage ? (typeof firstMessage.metadata === 'string' ? JSON.parse(firstMessage.metadata) : firstMessage.metadata) : null;
    const callDuration = callMetadata?.call_duration_seconds || 0;
    const callTime = firstMessage?.created_at;

    return (
        <>
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Call Log?</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            This will permanently delete this call conversation and all related messages. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleDeleteCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                disabled={deletingId !== null}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={deletingId !== null}
                            >
                                {deletingId ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header with Call Info and Delete Button */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <Headphones className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm">Call Transcript</h3>
                            <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                                {callTime && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatCallTime(callTime)}
                                    </span>
                                )}
                                {callDuration > 0 && (
                                    <span>Duration: {formatDuration(callDuration)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {conversationId && (
                        <button
                            onClick={handleDeleteClick}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={deletingId !== null}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </button>
                    )}
                </div>

                {/* Call Summary */}
                {callSummary && (
                    <div className="mt-3 pt-3 border-t border-blue-100">
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">Call Summary</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {callSummary}
                        </p>
                    </div>
                )}
            </div>

            {/* Transcript Messages */}
            <div className="space-y-1.5">
                {messages.map((msg) => {
                    const isCustomer = msg.direction === "inbound";
                    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                    const isAIHandled = metadata?.ai_handled !== false;

                    // Check if this is an action message
                    const isAction = msg.content_text?.startsWith('Action: ');

                    if (isAction) {
                        // Render action message
                        const actionName = msg.content_text.replace('Action: ', '');
                        return (
                            <div
                                key={msg.id}
                                className="p-3 rounded-lg bg-orange-50/50 border-l-2 border-orange-400"
                            >
                                <div className="flex items-start gap-2">
                                    <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 bg-orange-200 text-orange-700">
                                        🔧
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-semibold text-orange-700">
                                                Action Performed
                                            </span>
                                        </div>
                                        <p className="text-sm text-orange-900 font-medium leading-relaxed">
                                            {actionName}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Determine speaker label for regular messages
                    const speaker = isCustomer ? "Customer" : (isAIHandled ? "AI Agent" : "Human Agent");
                    const SpeakerIcon = isCustomer ? User : (isAIHandled ? Bot : User);

                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "p-3 rounded-lg",
                                isCustomer
                                    ? "bg-gray-50"
                                    : isAIHandled
                                        ? "bg-blue-50/50"
                                        : "bg-green-50/50"
                            )}
                        >
                            <div className="flex items-start gap-2">
                                <div className={cn(
                                    "h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                                    isCustomer
                                        ? "bg-gray-200 text-gray-600"
                                        : isAIHandled
                                            ? "bg-blue-200 text-blue-700"
                                            : "bg-green-200 text-green-700"
                                )}>
                                    <SpeakerIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className={cn(
                                            "text-xs font-semibold",
                                            isCustomer
                                                ? "text-gray-700"
                                                : isAIHandled
                                                    ? "text-blue-700"
                                                    : "text-green-700"
                                        )}>
                                            {speaker}
                                        </span>
                                    </div>
                                    {msg.content_text && (
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {msg.content_text}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
