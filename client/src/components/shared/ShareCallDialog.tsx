"use client";

import { useState, useEffect } from 'react';

interface ShareCallDialogProps {
    callId: string;
    callInfo: {
        from_number: string;
        to_number: string;
        direction: string;
        duration?: number;
    };
    onClose: () => void;
    onSuccess: () => void;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export function ShareCallDialog({ callId, callInfo, onClose, onSuccess }: ShareCallDialogProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/api/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }

        try {
            setSharing(true);
            const response = await fetch('http://localhost:8000/api/communications/share-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    callId,
                    toUserId: selectedUserId,
                    note: note.trim() || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to share call');
            }

            const data = await response.json();
            alert(data.message || 'Call log shared successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Share error:', err);
            alert(`Failed to share call: ${err.message || 'Unknown error'}`);
        } finally {
            setSharing(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading users...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Share Call Log</h2>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">From:</span>
                        <span className="font-medium text-blue-800">{callInfo.from_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">To:</span>
                        <span className="font-medium text-blue-800">{callInfo.to_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Direction:</span>
                        <span className="font-medium text-blue-800 capitalize">{callInfo.direction}</span>
                    </div>
                    {callInfo.duration !== undefined && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-medium text-blue-800">{callInfo.duration}s</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Share with User
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Select a user...</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add a Note (optional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Why are you sharing this call log?"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={sharing}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={sharing || !selectedUserId}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {sharing ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Sharing...
                            </>
                        ) : (
                            'Share Call'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
