"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Shield, Check } from 'lucide-react';

interface Permission {
    id: string;
    permission_name: string;
    description: string;
    category: string;
}

interface RolePermissionsDialogProps {
    roleId: string;
    roleName: string;
    isSystemRole: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ManageRolePermissionsDialog({
    roleId,
    roleName,
    isSystemRole,
    onClose,
    onSuccess
}: RolePermissionsDialogProps) {
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [roleId]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load all permissions
            const permsResponse = await rbacApi.permissions.list();
            setAllPermissions(permsResponse.permissions || []);

            // Load role permissions
            const roleResponse = await rbacApi.roles.get(roleId);
            const rolePerms = roleResponse.role?.permissions || [];
            setRolePermissions(new Set(rolePerms.map((p: any) => p.id)));
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (permissionId: string) => {
        if (isSystemRole) return; // Prevent changes to system roles

        const newPermissions = new Set(rolePermissions);
        if (newPermissions.has(permissionId)) {
            newPermissions.delete(permissionId);
        } else {
            newPermissions.add(permissionId);
        }
        setRolePermissions(newPermissions);
    };

    const handleSave = async () => {
        if (isSystemRole) {
            alert('System roles cannot be modified');
            return;
        }

        try {
            setSaving(true);
            await rbacApi.roles.assignPermissions(roleId, Array.from(rolePermissions));
            alert('Permissions updated successfully');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to save permissions:', error);
            alert(error.message || 'Failed to save permissions');
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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Shield className="h-6 w-6 text-blue-600" />
                            Manage Permissions
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Role: <span className="font-medium">{roleName}</span>
                            {isSystemRole && (
                                <span className="ml-2 text-purple-600 text-xs">(System Role - Read Only)</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>{rolePermissions.size}</strong> of <strong>{allPermissions.length}</strong> permissions selected
                                </p>
                            </div>

                            {Object.entries(groupedPermissions).map(([category, permissions]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {permissions.map((permission) => {
                                            const isSelected = rolePermissions.has(permission.id);
                                            return (
                                                <div
                                                    key={permission.id}
                                                    onClick={() => togglePermission(permission.id)}
                                                    className={`
                                                        border rounded-lg p-4 transition-all cursor-pointer
                                                        ${isSystemRole ? 'cursor-not-allowed opacity-75' : ''}
                                                        ${isSelected
                                                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`
                                                            flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5
                                                            ${isSelected
                                                                ? 'bg-blue-600 border-blue-600'
                                                                : 'border-gray-300 bg-white'
                                                            }
                                                        `}>
                                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                                                {permission.permission_name}
                                                            </p>
                                                            {permission.description && (
                                                                <p className="text-sm text-gray-600 mt-1">
                                                                    {permission.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isSystemRole && (
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                'Save Permissions'
                            )}
                        </button>
                    </div>
                )}

                {isSystemRole && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-purple-50">
                        <p className="text-sm text-purple-800 text-center">
                            System roles are managed by the system and cannot be modified
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
