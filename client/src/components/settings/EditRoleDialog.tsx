"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';

interface EditRoleDialogProps {
    roleId: string;
    isSystemRole?: boolean;
    currentData: {
        role_name: string;
        display_name: string;
        description: string;
        permissions: Array<{ id: string; permission_key: string; display_name: string }>;
    };
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

export function EditRoleDialog({ roleId, isSystemRole = false, currentData, onClose, onSuccess }: EditRoleDialogProps) {
    const [displayName, setDisplayName] = useState(currentData.display_name);
    const [description, setDescription] = useState(currentData.description || '');
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
        currentData.permissions.map(p => p.id)
    );
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'permissions'>('details');

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const data = await rbacApi.permissions.list();
            setAllPermissions(data.permissions || []);
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (permissionId: string) => {
        if (selectedPermissionIds.includes(permissionId)) {
            setSelectedPermissionIds(selectedPermissionIds.filter(id => id !== permissionId));
        } else {
            setSelectedPermissionIds([...selectedPermissionIds, permissionId]);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Update role details
            await rbacApi.roles.update(roleId, {
                display_name: displayName,
                description: description
            });

            // Update permissions
            await rbacApi.roles.assignPermissions(roleId, selectedPermissionIds);

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update role:', err);
            alert(`Failed to update role: ${err.message || 'Unknown error'}`);
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

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    {isSystemRole ? 'View System Role' : 'Edit Role'}
                    {isSystemRole && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold uppercase">
                            Read Only
                        </span>
                    )}
                </h2>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 border-b">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'details'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Details
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'permissions'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Permissions ({selectedPermissionIds.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto mb-6">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role Name (System)
                                </label>
                                <input
                                    type="text"
                                    value={currentData.role_name}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">System role name cannot be changed</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display Name {isSystemRole && '(Read Only)'}
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    disabled={isSystemRole}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isSystemRole ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="Enter display name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description {isSystemRole && '(Read Only)'}
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={isSystemRole}
                                    rows={4}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isSystemRole ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    placeholder="Enter role description"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            {Object.entries(groupedPermissions).map(([category, permissions]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {permissions.map(perm => (
                                            <label
                                                key={perm.id}
                                                className={`flex items-start p-3 border border-gray-200 rounded-lg transition-colors ${isSystemRole ? 'cursor-not-allowed opacity-75' : 'hover:bg-gray-50 cursor-pointer'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPermissionIds.includes(perm.id)}
                                                    onChange={() => !isSystemRole && togglePermission(perm.id)}
                                                    disabled={isSystemRole}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                                                />
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium text-gray-900">{perm.display_name}</div>
                                                    {perm.description && (
                                                        <p className="text-sm text-gray-500 mt-0.5">{perm.description}</p>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {isSystemRole ? 'Close' : 'Cancel'}
                    </button>
                    {!isSystemRole && (
                        <button
                            onClick={handleSave}
                            disabled={saving || !displayName.trim()}
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
                    )}
                </div>
            </div>
        </div>
    );
}
