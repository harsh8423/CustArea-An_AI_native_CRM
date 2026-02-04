"use client";

import { useState } from 'react';
import { api } from '@/lib/api';

interface ReassignDialogProps {
    type: 'lead' | 'contact';
    itemId: string;
    itemName: string;
    availableUsers: Array<{ id: string; name: string; email: string }>;
    onClose: () => void;
    onSuccess: () => void;
}

export function ReassignDialog({ type, itemId, itemName, availableUsers, onClose, onSuccess }: ReassignDialogProps) {
    const [selectedUserId, setSelectedUserId] = useState('');
    const [note, setNote] = useState('');
    const [reassigning, setReassigning] = useState(false);

    const handleReassign = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }

        try {
            setReassigning(true);

            const endpoint = type === 'lead'
                ? '/communications/reassign-lead'
                : '/communications/reassign-contact';

            const payload = type === 'lead'
                ? { leadId: itemId, toUserId: selectedUserId, note }
                : { contactId: itemId, toUserId: selectedUserId, note };

            const response = await fetch(`http://localhost:8000/api${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to reassign');
            }

            const data = await response.json();
            alert(data.message || `${type === 'lead' ? 'Lead' : 'Contact'} reassigned successfully`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Reassign error:', err);
            alert(`Failed to reassign: ${err.message || 'Unknown error'}`);
        } finally {
            setReassigning(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Reassign {type === 'lead' ? 'Lead' : 'Contact'}
                </h2>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>{itemName}</strong> will be transferred to another user
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assign to User
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Select a user...</option>
                            {availableUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Note (optional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Add a note about this reassignment..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={reassigning}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleReassign}
                        disabled={reassigning || !selectedUserId}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {reassigning ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Reassigning...
                            </>
                        ) : (
                            'Reassign'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
