"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';

interface EditUserRolesDialogProps {
    userId: string;
    currentRoleIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

interface Role {
    id: string;
    role_name: string;
    display_name: string;
    description: string;
}

export function EditUserRolesDialog({ userId, currentRoleIds, onClose, onSuccess }: EditUserRolesDialogProps) {
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(currentRoleIds);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const data = await rbacApi.roles.list();
            setAvailableRoles(data.roles || []);
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = (roleId: string) => {
        if (selectedRoleIds.includes(roleId)) {
            setSelectedRoleIds(selectedRoleIds.filter(id => id !== roleId));
        } else {
            setSelectedRoleIds([...selectedRoleIds, roleId]);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await rbacApi.users.assignRoles(userId, selectedRoleIds);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to assign roles:', err);
            alert(`Failed to assign roles: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading roles...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit User Roles</h2>

                <div className="space-y-3 mb-6">
                    {availableRoles.length === 0 ? (
                        <p className="text-sm text-gray-500">No roles available</p>
                    ) : (
                        availableRoles.map(role => (
                            <label
                                key={role.id}
                                className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedRoleIds.includes(role.id)}
                                    onChange={() => toggleRole(role.id)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="ml-3 flex-1">
                                    <div className="font-medium text-gray-900">{role.display_name}</div>
                                    {role.description && (
                                        <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                                    )}
                                </div>
                            </label>
                        ))
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
