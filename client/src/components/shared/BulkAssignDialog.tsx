"use client";

import { useState } from 'react';
import { api } from '@/lib/api';

interface BulkAssignDialogProps {
    type: 'contacts' | 'contactGroups';
    selectedIds: string[];
    availableUsers: Array<{ id: string; name: string; email: string }>;
    onClose: () => void;
    onSuccess: () => void;
}

export function BulkAssignDialog({ type, selectedIds, availableUsers, onClose, onSuccess }: BulkAssignDialogProps) {
    const [selectedUserId, setSelectedUserId] = useState('');
    const [assigning, setAssigning] = useState(false);

    const handleAssign = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }

        try {
            setAssigning(true);

            const endpoint = type === 'contacts'
                ? '/contacts/bulk-assign'
                : '/contacts/groups/bulk-assign';

            const payload = type === 'contacts'
                ? { contactIds: selectedIds, toUserId: selectedUserId }
                : { groupIds: selectedIds, toUserId: selectedUserId };

            const response = await fetch(`http://localhost:8000/api${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign');
            }

            const data = await response.json();
            alert(data.message || 'Successfully assigned');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Bulk assign error:', err);
            alert(`Failed to assign: ${err.message || 'Unknown error'}`);
        } finally {
            setAssigning(false);
        }
    };

    const itemType = type === 'contacts' ? 'contact' : 'contact group';
    const itemTypePlural = type === 'contacts' ? 'contacts' : 'contact groups';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Assign {itemTypePlural}
                </h2>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? itemType : itemTypePlural} will be assigned to the selected user
                    </p>
                </div>

                <div className="mb-6">
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

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={assigning}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={assigning || !selectedUserId}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {assigning ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Assigning...
                            </>
                        ) : (
                            'Assign'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
