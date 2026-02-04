"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Send, Loader2 } from 'lucide-react';

interface ForwardConversationDialogProps {
    conversationId: string;
    conversationSubject: string;
    onClose: () => void;
    onSuccess?: () => void;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export function ForwardConversationDialog({
    conversationId,
    conversationSubject,
    onClose,
    onSuccess
}: ForwardConversationDialogProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [forwarding, setForwarding] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const data = await rbacApi.users.list();
                if (data.users) {
                    setUsers(data.users);
                }
            } catch (error) {
                console.error('Failed to fetch users:', error);
                alert('Failed to load users');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleForward = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }

        try {
            setForwarding(true);
            await rbacApi.conversations.forward(conversationId, selectedUserId, note || undefined);
            alert('Conversation forwarded successfully');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Failed to forward conversation:', error);
            alert(error.message || 'Failed to forward conversation');
        } finally {
            setForwarding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Forward Conversation</h2>
                        <p className="text-sm text-gray-600 mt-1 truncate">{conversationSubject}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                        disabled={forwarding}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading users...</p>
                        </div>
                    ) : (
                        <>
                            {/* User Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Forward to User
                                </label>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={forwarding}
                                >
                                    <option value="">Select a user...</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Note (Optional)
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add a note for the recipient..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    disabled={forwarding}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        disabled={forwarding}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleForward}
                        disabled={!selectedUserId || forwarding || loading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {forwarding ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Forwarding...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Forward
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
