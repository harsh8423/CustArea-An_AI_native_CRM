"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { usePermissions } from '@/hooks/usePermissions';
import { ViewRolePermissionsDialog } from '@/components/settings/ViewRolePermissionsDialog';
import { ManageRolePermissionsDialog } from '@/components/settings/ManageRolePermissionsDialog';
import { Shield, Plus, Edit, Trash2, Eye, Users, Lock, Settings, Key } from 'lucide-react';

interface Role {
    id: string;
    role_name: string;
    description: string;
    is_system_role: boolean;
    tenant_id: string | null;
    permission_count: number;
    user_count: number;
    created_at: string;
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
    const [showManagePermissionsDialog, setShowManagePermissionsDialog] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const { hasPermission } = usePermissions();

    const canView = hasPermission('view_roles');
    const canManage = hasPermission('manage_roles');

    useEffect(() => {
        if (canView) {
            loadRoles();
        }
    }, [canView]);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.roles.list();
            setRoles(response.roles || []);
        } catch (error) {
            console.error('Failed to load roles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (role.is_system_role) {
            alert('System roles cannot be deleted');
            return;
        }

        if (role.user_count > 0) {
            if (!confirm(`This role is assigned to ${role.user_count} user(s). Are you sure you want to delete it? Users will lose this role.`)) {
                return;
            }
        }

        if (!confirm(`Are you sure you want to delete the role "${role.role_name}"?`)) {
            return;
        }

        try {
            await rbacApi.roles.delete(role.id);
            alert('Role deleted successfully');
            loadRoles();
        } catch (error: any) {
            console.error('Failed to delete role:', error);
            alert(error.message || 'Failed to delete role');
        }
    };

    const handleViewPermissions = (role: Role) => {
        setSelectedRole(role);
        setShowPermissionsDialog(true);
    };

    const handleEditRole = (role: Role) => {
        if (role.is_system_role) {
            alert('System roles cannot be edited');
            return;
        }
        setSelectedRole(role);
        setShowEditDialog(true);
    };

    const handleManagePermissions = (role: Role) => {
        setSelectedRole(role);
        setShowManagePermissionsDialog(true);
    };

    if (!canView) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600">You don't have permission to view roles.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <Shield className="h-7 w-7 text-blue-600" />
                            Role Management
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Manage user roles and their permissions across the system
                        </p>
                    </div>
                    {canManage && (
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Role
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <Shield className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-blue-600 font-medium">Total Roles</p>
                                <p className="text-2xl font-bold text-blue-900">{roles.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-600 p-2 rounded-lg">
                                <Lock className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-600 font-medium">System Roles</p>
                                <p className="text-2xl font-bold text-purple-900">
                                    {roles.filter(r => r.is_system_role).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-600 p-2 rounded-lg">
                                <Settings className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-green-600 font-medium">Custom Roles</p>
                                <p className="text-2xl font-bold text-green-900">
                                    {roles.filter(r => !r.is_system_role).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Roles List */}
            <div className="flex-1 overflow-auto p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : roles.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Roles Found</h3>
                        <p className="text-gray-600 mb-6">Get started by creating your first custom role</p>
                        {canManage && (
                            <button
                                onClick={() => setShowCreateDialog(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Create Role
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {roles.map((role) => (
                            <div
                                key={role.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {role.role_name}
                                            </h3>
                                            {role.is_system_role && (
                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                    <Lock className="h-3 w-3" />
                                                    System Role
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 text-sm mb-4">
                                            {role.description || 'No description provided'}
                                        </p>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Shield className="h-4 w-4" />
                                                <span className="font-medium">{role.permission_count}</span>
                                                <span>permissions</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Users className="h-4 w-4" />
                                                <span className="font-medium">{role.user_count}</span>
                                                <span>users</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewPermissions(role)}
                                            className="text-gray-400 hover:text-green-600 p-2 rounded-lg hover:bg-green-50 transition-colors"
                                            title="View Permissions"
                                        >
                                            <Eye className="h-5 w-5" />
                                        </button>
                                        {canManage && (
                                            <button
                                                onClick={() => handleManagePermissions(role)}
                                                className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                                                title="Manage Permissions"
                                            >
                                                <Key className="h-5 w-5" />
                                            </button>
                                        )}
                                        {canManage && !role.is_system_role && (
                                            <>
                                                <button
                                                    onClick={() => handleEditRole(role)}
                                                    className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                                    title="Edit Role"
                                                >
                                                    <Edit className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRole(role)}
                                                    className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Delete Role"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </>
                                        )}
                                        {canManage && role.is_system_role && (
                                            <div className="text-gray-300 p-2" title="System roles cannot be modified">
                                                <Lock className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Dialogs */}
            {showPermissionsDialog && selectedRole && (
                <ViewRolePermissionsDialog
                    roleId={selectedRole.id}
                    roleName={selectedRole.role_name}
                    onClose={() => {
                        setShowPermissionsDialog(false);
                        setSelectedRole(null);
                    }}
                />
            )}

            {showCreateDialog && (
                <CreateRoleDialog
                    onClose={() => setShowCreateDialog(false)}
                    onSuccess={() => {
                        loadRoles();
                        setShowCreateDialog(false);
                    }}
                />
            )}

            {showEditDialog && selectedRole && (
                <EditRoleDialog
                    role={selectedRole}
                    onClose={() => {
                        setShowEditDialog(false);
                        setSelectedRole(null);
                    }}
                    onSuccess={() => {
                        loadRoles();
                        setShowEditDialog(false);
                        setSelectedRole(null);
                    }}
                />
            )}

            {showManagePermissionsDialog && selectedRole && (
                <ManageRolePermissionsDialog
                    roleId={selectedRole.id}
                    roleName={selectedRole.role_name}
                    isSystemRole={selectedRole.is_system_role}
                    onClose={() => {
                        setShowManagePermissionsDialog(false);
                        setSelectedRole(null);
                    }}
                    onSuccess={() => {
                        loadRoles();
                    }}
                />
            )}
        </div>
    );
}

// Create Role Dialog Component
function CreateRoleDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [roleName, setRoleName] = useState('');
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!roleName.trim()) {
            alert('Please enter a role name');
            return;
        }

        try {
            setCreating(true);
            await rbacApi.roles.create({
                role_name: roleName.trim(),
                description: description.trim()
            });
            alert('Role created successfully');
            onSuccess();
        } catch (error: any) {
            console.error('Failed to create role:', error);
            alert(error.message || 'Failed to create role');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="h-6 w-6 text-blue-600" />
                    Create New Role
                </h2>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Role Name *
                        </label>
                        <input
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            placeholder="e.g., Sales Manager"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={creating}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the role's purpose..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            disabled={creating}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={creating}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={creating || !roleName.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {creating ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Creating...
                            </>
                        ) : (
                            'Create Role'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Edit Role Dialog Component
function EditRoleDialog({ role, onClose, onSuccess }: { role: Role; onClose: () => void; onSuccess: () => void }) {
    const [roleName, setRoleName] = useState(role.role_name);
    const [description, setDescription] = useState(role.description || '');
    const [updating, setUpdating] = useState(false);

    const handleUpdate = async () => {
        if (!roleName.trim()) {
            alert('Please enter a role name');
            return;
        }

        try {
            setUpdating(true);
            await rbacApi.roles.update(role.id, {
                role_name: roleName.trim(),
                description: description.trim()
            });
            alert('Role updated successfully');
            onSuccess();
        } catch (error: any) {
            console.error('Failed to update role:', error);
            alert(error.message || 'Failed to update role');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Edit className="h-6 w-6 text-blue-600" />
                    Edit Role
                </h2>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Role Name *
                        </label>
                        <input
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={updating}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            disabled={updating}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={updating}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={updating || !roleName.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {updating ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Updating...
                            </>
                        ) : (
                            'Update Role'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
