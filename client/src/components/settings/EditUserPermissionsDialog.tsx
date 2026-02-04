"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';

interface EditUserPermissionsDialogProps {
    userId: string;
    currentPermissions: Array<{ id: string; permission_key: string; display_name: string; granted: boolean }>;
    onClose: () => void;
    onSuccess: () => void;
}

interface Permission {
    id: string;
    permission_key: string;
    display_name: string;
    description: string;
    category: string;
}

type PermissionState = 'inherited' | 'granted' | 'revoked';

export function EditUserPermissionsDialog({ userId, currentPermissions, onClose, onSuccess }: EditUserPermissionsDialogProps) {
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [permissionStates, setPermissionStates] = useState<Record<string, PermissionState>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const data = await rbacApi.permissions.list();
            setAllPermissions(data.permissions || []);

            // Initialize permission states
            const states: Record<string, PermissionState> = {};
            currentPermissions.forEach(cp => {
                states[cp.id] = cp.granted ? 'granted' : 'revoked';
            });
            setPermissionStates(states);
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const cyclePermissionState = (permissionId: string) => {
        const currentState = permissionStates[permissionId] || 'inherited';
        const nextState: PermissionState =
            currentState === 'inherited' ? 'granted' :
                currentState === 'granted' ? 'revoked' : 'inherited';

        setPermissionStates({
            ...permissionStates,
            [permissionId]: nextState
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Build permissions object: { permissionId: granted (boolean) }
            const permissions: Record<string, boolean> = {};
            Object.entries(permissionStates).forEach(([permId, state]) => {
                if (state !== 'inherited') {
                    permissions[permId] = state === 'granted';
                }
            });

            await rbacApi.users.grantPermissions(userId, permissions);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update permissions:', err);
            alert(`Failed to update permissions: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    // Group permissions by category
    const groupedPermissions = allPermissions.reduce((acc, perm) => {
        const category = perm.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const getStateColor = (state: PermissionState) => {
        switch (state) {
            case 'granted': return 'bg-green-100 border-green-500 text-green-900';
            case 'revoked': return 'bg-red-100 border-red-500 text-red-900';
            default: return 'bg-gray-100 border-gray-300 text-gray-600';
        }
    };

    const getStateLabel = (state: PermissionState) => {
        switch (state) {
            case 'granted': return 'Granted';
            case 'revoked': return 'Revoked';
            default: return 'Inherited';
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading permissions...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit User Permissions</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Click on each permission to cycle: Inherited → Granted → Revoked
                </p>

                <div className="space-y-6 mb-6">
                    {Object.entries(groupedPermissions).map(([category, permissions]) => (
                        <div key={category}>
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                {category}
                            </h3>
                            <div className="space-y-2">
                                {permissions.map(perm => {
                                    const state = permissionStates[perm.id] || 'inherited';
                                    return (
                                        <button
                                            key={perm.id}
                                            onClick={() => cyclePermissionState(perm.id)}
                                            className={`w-full text-left p-3 border-2 rounded-lg transition-all hover:shadow-md ${getStateColor(state)}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium">{perm.display_name}</div>
                                                    {perm.description && (
                                                        <p className="text-xs opacity-75 mt-0.5">{perm.description}</p>
                                                    )}
                                                </div>
                                                <span className="ml-3 px-3 py-1 rounded-full text-xs font-semibold bg-white/50">
                                                    {getStateLabel(state)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
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
