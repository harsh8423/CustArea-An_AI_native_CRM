"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Loader2, Shield, Check, X as XIcon } from 'lucide-react';

interface GrantPermissionsDialogProps {
    userId: string;
    userName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

interface Permission {
    id: string;
    permission_key: string;
    display_name: string;
    category: string;
    description?: string;
}

interface UserPermission {
    permission_id: string;
    granted: boolean; // true = explicit grant, false = explicit revoke
}

export function GrantPermissionsDialog({
    userId,
    userName,
    onClose,
    onSuccess
}: GrantPermissionsDialogProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [userPermissions, setUserPermissions] = useState<Map<string, boolean | null>>(new Map());
    // null = inherited from role, true = explicitly granted, false = explicitly revoked

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch all available permissions
                const permsData = await rbacApi.permissions.list();
                setAllPermissions(permsData.permissions || []);

                // Fetch user's current explicit permissions
                const userData = await rbacApi.users.get(userId);
                const directPerms = userData.user?.direct_permissions || [];

                const permMap = new Map<string, boolean | null>();
                directPerms.forEach((p: UserPermission) => {
                    permMap.set(p.permission_id, p.granted);
                });

                setUserPermissions(permMap);
            } catch (error) {
                console.error('Failed to fetch permissions:', error);
                alert('Failed to load permissions');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]);

    const handleTogglePermission = (permissionId: string) => {
        const newMap = new Map(userPermissions);
        const current = newMap.get(permissionId);

        if (current === null || current === undefined) {
            // Not set -> Grant
            newMap.set(permissionId, true);
        } else if (current === true) {
            // Granted -> Revoke
            newMap.set(permissionId, false);
        } else {
            // Revoked -> Remove (inherit from role)
            newMap.delete(permissionId);
        }

        setUserPermissions(newMap);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Build permissions object as Record<permissionId, granted>
            const permissionsObj: Record<string, boolean> = {};
            userPermissions.forEach((granted, permissionId) => {
                if (granted !== null) {
                    permissionsObj[permissionId] = granted;
                }
            });

            await rbacApi.users.grantPermissions(userId, permissionsObj);
            alert('Permissions updated successfully');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Failed to update permissions:', error);
            alert(error.message || 'Failed to update permissions');
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

    const getPermissionState = (permId: string): 'granted' | 'revoked' | 'inherited' => {
        const state = userPermissions.get(permId);
        if (state === true) return 'granted';
        if (state === false) return 'revoked';
        return 'inherited';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Manage Permissions</h2>
                            <p className="text-sm text-gray-600 mt-0.5">{userName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Legend */}
                <div className="px-6 pt-4 pb-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-6 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center">
                                <Check className="h-3 w-3 text-green-600" />
                            </div>
                            <span className="text-gray-600">Explicitly Granted</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded bg-red-100 flex items-center justify-center">
                                <XIcon className="h-3 w-3 text-red-600" />
                            </div>
                            <span className="text-gray-600">Explicitly Revoked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded border-2 border-gray-300" />
                            <span className="text-gray-600">Inherited from Role</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading permissions...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                                        {category}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {perms.map((perm) => {
                                            const state = getPermissionState(perm.id);
                                            return (
                                                <button
                                                    key={perm.id}
                                                    onClick={() => handleTogglePermission(perm.id)}
                                                    disabled={saving}
                                                    className="flex items-start gap-3 p-3 rounded-lg border transition-colors text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        {state === 'granted' ? (
                                                            <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center">
                                                                <Check className="h-3 w-3 text-green-600" />
                                                            </div>
                                                        ) : state === 'revoked' ? (
                                                            <div className="h-5 w-5 rounded bg-red-100 flex items-center justify-center">
                                                                <XIcon className="h-3 w-3 text-red-600" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-5 w-5 rounded border-2 border-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {perm.display_name}
                                                        </p>
                                                        {perm.description && (
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {perm.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
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
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
