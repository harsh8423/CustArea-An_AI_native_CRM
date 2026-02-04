"use client";

import { useState, useEffect } from 'react';

interface ForwardEmailDialogProps {
    messageId: string;
    subject: string;
    onClose: () => void;
    onSuccess: () => void;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export function ForwardEmailDialog({ messageId, subject, onClose, onSuccess }: ForwardEmailDialogProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [forwarding, setForwarding] = useState(false);

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

    const handleForward = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }

        try {
            setForwarding(true);
            const response = await fetch('http://localhost:8000/api/communications/forward-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    messageId,
                    toUserId: selectedUserId,
                    note: note.trim() || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to forward email');
            }

            const data = await response.json();
            alert(data.message || 'Email forwarded successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Forward error:', err);
            alert(`Failed to forward email: ${err.message || 'Unknown error'}`);
        } finally {
            setForwarding(false);
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
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Forward Email</h2>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Subject:</p>
                    <p className="text-sm font-medium text-blue-800">{subject}</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Forward to User
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
                            placeholder="Why are you forwarding this email?"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={forwarding}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleForward}
                        disabled={forwarding || !selectedUserId}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {forwarding ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Forwarding...
                            </>
                        ) : (
                            'Forward Email'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
