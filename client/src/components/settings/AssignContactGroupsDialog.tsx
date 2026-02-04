"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Loader2, Users } from 'lucide-react';

interface AssignContactGroupsDialogProps {
    userId: string;
    userName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

interface ContactGroup {
    id: string;
    name: string;
    description?: string;
}

export function AssignContactGroupsDialog({
    userId,
    userName,
    onClose,
    onSuccess
}: AssignContactGroupsDialogProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch all contact groups
                const token = localStorage.getItem('token');
                const groupsRes = await fetch('http://localhost:8000/api/contact-groups', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const groupsData = await groupsRes.json();

                // Fetch user's current groups
                const currentGroups = await rbacApi.users.getContactGroups(userId);

                setAvailableGroups(groupsData.contactGroups || []);
                setSelectedGroupIds(currentGroups.contactGroups?.map((g: any) => g.id) || []);
            } catch (error) {
                console.error('Failed to fetch contact groups:', error);
                alert('Failed to load contact groups');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]);

    const handleToggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await rbacApi.users.assignContactGroups(userId, selectedGroupIds);
            alert('Contact groups assigned successfully');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Failed to assign contact groups:', error);
            alert(error.message || 'Failed to assign contact groups');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Assign Contact Groups</h2>
                        <p className="text-sm text-gray-600 mt-1">{userName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading contact groups...</p>
                        </div>
                    ) : availableGroups.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No contact groups available</p>
                            <p className="text-sm text-gray-400 mt-1">Create contact groups first to assign them to users</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 mb-4">
                                Select the contact groups this user should have access to:
                            </p>
                            {availableGroups.map((group) => (
                                <label
                                    key={group.id}
                                    className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedGroupIds.includes(group.id)}
                                        onChange={() => handleToggleGroup(group.id)}
                                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        disabled={saving}
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{group.name}</div>
                                        {group.description && (
                                            <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
