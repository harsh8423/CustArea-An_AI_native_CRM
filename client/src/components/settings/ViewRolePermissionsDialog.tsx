"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Loader2, Shield, List } from 'lucide-react';

interface ViewRolePermissionsDialogProps {
    roleId: string;
    roleName: string;
    onClose: () => void;
}

interface Permission {
    id: string;
    permission_key: string;
    display_name: string;
    category: string;
    description?: string;
}

export function ViewRolePermissionsDialog({
    roleId,
    roleName,
    onClose
}: ViewRolePermissionsDialogProps) {
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Permission[]>([]);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                setLoading(true);
                const data = await rbacApi.roles.get(roleId);
                setPermissions(data.role?.permissions || []);
            } catch (error) {
                console.error('Failed to fetch role permissions:', error);
                alert('Failed to load permissions');
            } finally {
                setLoading(false);
            }
        };
        fetchPermissions();
    }, [roleId]);

    // Group permissions by category
    const groupedPermissions = permissions.reduce((acc, perm) => {
        const category = perm.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Role Permissions</h2>
                            <p className="text-sm text-gray-600 mt-0.5">{roleName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Loading permissions...</p>
                        </div>
                    ) : permissions.length === 0 ? (
                        <div className="text-center py-12">
                            <List className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No permissions assigned to this role</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {perms.map((perm) => (
                                            <div
                                                key={perm.id}
                                                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex-shrink-0 mt-0.5">
                                                    <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center">
                                                        <svg className="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {perm.display_name}
                                                    </p>
                                                    {perm.description && (
                                                        <p className="text-xs text-gray-600 mt-0.5">
                                                            {perm.description}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-400 mt-1 font-mono">
                                                        {perm.permission_key}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            Total: <span className="font-semibold text-gray-900">{permissions.length}</span> permissions
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
