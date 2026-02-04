"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { useAllPermissions, usePermissions } from '@/hooks/usePermissions';
import { EditRoleDialog } from '@/components/settings/EditRoleDialog';

interface Role {
    id: string;
    role_name: string;
    display_name: string;
    description: string;
    is_system_role: boolean;
    user_count: number;
    permission_count: number;
}

export function RoleManagement() {
    const { hasPermission } = usePermissions();
    const { grouped: groupedPermissions } = useAllPermissions();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newRole, setNewRole] = useState({ role_name: '', display_name: '', description: '' });
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    // Edit role state
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [rolePermissions, setRolePermissions] = useState<any[]>([]);

    const canView = hasPermission('roles.view');
    const canManage = hasPermission('roles.manage');

    useEffect(() => {
        if (canView) {
            loadRoles();
        }
    }, [canView]);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.roles.list();
            if (response.roles) {
                setRoles(response.roles);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRole = async () => {
        if (!newRole.role_name || !newRole.display_name) {
            alert('Please fill in role name and display name');
            return;
        }

        try {
            setCreating(true);
            const response = await rbacApi.roles.create({
                ...newRole,
                permissionIds: selectedPermissions
            });

            if (response.error) {
                alert(response.error);
            } else {
                alert('Role created successfully!');
                setShowCreateDialog(false);
                setNewRole({ role_name: '', display_name: '', description: '' });
                setSelectedPermissions([]);
                loadRoles();
            }
        } catch (error: any) {
            console.error('Failed to create role:', error);
            alert(error.message || 'Failed to create role');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteRole = async (roleId: string, isSystemRole: boolean) => {
        if (isSystemRole) {
            alert('Cannot delete system roles');
            return;
        }

        const roleToDelete = roles.find(r => r.id === roleId);
        const confirmMessage = `Are you sure you want to delete "${roleToDelete?.display_name}"?\n\nThis will:\n• Remove the role from ${roleToDelete?.user_count || 0} user(s)\n• Remove all ${roleToDelete?.permission_count || 0} permission assignment(s)\n\nThis action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await rbacApi.roles.delete(roleId);
            alert('Role deleted successfully');
            loadRoles();
        } catch (error: any) {
            console.error('Failed to delete role:', error);
            alert(error.message || 'Failed to delete role');
        }
    };

    const handleEditRole = async (role: Role) => {
        try {
            // Fetch role details with permissions
            const response = await rbacApi.roles.get(role.id);
            // Backend returns { role: { ...role, permissions: [...] } }
            setRolePermissions(response.role?.permissions || response.permissions || []);
            setEditingRole(role);
        } catch (error) {
            console.error('Failed to load role details:', error);
            alert('Failed to load role details');
        }
    };

    const togglePermission = (permId: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
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
        <div className="h-full flex flex-col">
            <div className="p-8 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
                        <p className="text-gray-600 mt-1">Manage roles and their permissions</p>
                    </div>
                    {canManage && (
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            + Create Role
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto px-8 pb-8">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-gray-600 mt-4">Loading roles...</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {roles.map((role) => (
                            <div key={role.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900">{role.display_name}</h3>
                                        {role.is_system_role && (
                                            <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                System Role
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-sm text-gray-600 mb-4 min-h-[40px]">{role.description || 'No description'}</p>

                                <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-6 bg-gray-50 rounded-lg p-3">
                                    <span>{role.user_count} users</span>
                                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span>{role.permission_count} permissions</span>
                                </div>

                                <div className="flex gap-2 opacity-100 transition-opacity">
                                    {canManage && (
                                        <>
                                            {!role.is_system_role ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEditRole(role)}
                                                        className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id, role.is_system_role)}
                                                        className="bg-white border border-red-100 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleEditRole(role)}
                                                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium cursor-default flex items-center justify-center gap-2"
                                                    title="System roles cannot be edited. View permissions only."
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    View Only
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Role Dialog */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-3xl w-full mx-4 my-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold mb-6 text-gray-900">Create Custom Role</h2>

                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Role Name (Internal ID)
                                    </label>
                                    <input
                                        type="text"
                                        value={newRole.role_name}
                                        onChange={(e) => setNewRole({ ...newRole, role_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                        placeholder="e.g., marketing_manager"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newRole.display_name}
                                        onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                                        placeholder="e.g., Marketing Manager"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={newRole.description}
                                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    placeholder="Role description..."
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4 text-gray-900">Assign Permissions</h3>
                            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl p-1 bg-gray-50/50">
                                {Object.entries(groupedPermissions).map(([category, perms]) => (
                                    <div key={category} className="mb-2 last:mb-0 bg-white rounded-lg border border-gray-100 overflow-hidden">
                                        <div className="px-4 py-2 bg-gray-50/80 border-b border-gray-100">
                                            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500">{category}</h4>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-2">
                                            {perms.map((perm: any) => (
                                                <label key={perm.id} className="flex items-start p-2 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermissions.includes(perm.id)}
                                                        onChange={() => togglePermission(perm.id)}
                                                        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{perm.display_name}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono">{perm.permission_key}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateDialog(false);
                                    setNewRole({ role_name: '', display_name: '', description: '' });
                                    setSelectedPermissions([]);
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                                disabled={creating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRole}
                                disabled={creating || !newRole.role_name || !newRole.display_name}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {creating ? 'Creating...' : 'Create Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Role Dialog */}
            {editingRole && (
                <EditRoleDialog
                    roleId={editingRole.id}
                    isSystemRole={editingRole.is_system_role}
                    currentData={{
                        role_name: editingRole.role_name,
                        display_name: editingRole.display_name,
                        description: editingRole.description,
                        permissions: rolePermissions
                    }}
                    onClose={() => {
                        setEditingRole(null);
                        setRolePermissions([]);
                    }}
                    onSuccess={() => {
                        setEditingRole(null);
                        setRolePermissions([]);
                        loadRoles();
                    }}
                />
            )}
        </div>
    );
}
