
import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserRolesDialog } from './EditUserRolesDialog';
import { ViewUserPermissionsDialog } from './ViewUserPermissionsDialog';
import { GrantPermissionsDialog } from './GrantPermissionsDialog';
import { ManageUserFeaturesDialog } from './ManageUserFeaturesDialog';
import { GrantChannelAccessDialog } from './GrantChannelAccessDialog';
import { Edit, Shield, Trash2, UserCog, UserPlus, Eye, KeyRound, ToggleLeft, Radio } from 'lucide-react';

interface User {
    id: string;
    email: string;
    name: string;
    legacy_role: string;
    status: string;
    created_at: string;
    roles: string[];
    assigned_leads_count: number;
    assigned_contacts_count: number;
    is_current_user: boolean;
}

export function UserManagement() {
    const { hasPermission } = usePermissions();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditRolesDialog, setShowEditRolesDialog] = useState(false);
    const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
    const [showGrantPermissionsDialog, setShowGrantPermissionsDialog] = useState(false);
    const [showManageFeaturesDialog, setShowManageFeaturesDialog] = useState(false);
    const [showChannelAccessDialog, setShowChannelAccessDialog] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const [userChannelAccess, setUserChannelAccess] = useState<any>(null);
    const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);

    // Check permissions
    const canView = hasPermission('users.view');
    const canInvite = hasPermission('users.invite'); // Using invite perm for create as well
    const canManage = hasPermission('users.manage');

    useEffect(() => {
        if (canView) {
            loadUsers();
        }
    }, [canView]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.users.list();
            if (response.users) {
                setUsers(response.users);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditRoles = async (user: User) => {
        // We need role IDs, but list returns names. Fetch details first.
        try {
            const data = await rbacApi.users.get(user.id);
            if (data.user && data.user.roles) {
                const roleIds = data.user.roles.map((r: any) => r.id);
                setSelectedUserId(user.id);
                setSelectedUserRoles(roleIds);
                setShowEditRolesDialog(true);
            }
        } catch (error) {
            console.error('Failed to fetch user roles:', error);
            alert('Failed to load user details');
        }
    };

    const handleDeactivateUser = async (userId: string) => {
        if (!confirm('Are you sure you want to deactivate this user?')) {
            return;
        }

        try {
            await rbacApi.users.deactivate(userId);
            alert('User deactivated successfully');
            loadUsers();
        } catch (error: any) {
            console.error('Failed to deactivate user:', error);
            alert(error.message || 'Failed to deactivate user');
        }
    };

    const handleViewPermissions = (user: User) => {
        setSelectedUserId(user.id);
        setSelectedUserName(user.name || user.email);
        setShowPermissionsDialog(true);
    };

    const handleGrantPermissions = (user: User) => {
        setSelectedUserId(user.id);
        setSelectedUserName(user.name || user.email);
        setShowGrantPermissionsDialog(true);
    };

    const handleManageFeatures = (user: User) => {
        setSelectedUserId(user.id);
        setSelectedUserName(user.name || user.email);
        setShowManageFeaturesDialog(true);
    };

    const handleManageChannelAccess = async (user: User) => {
        try {
            // Fetch user details including current channel access
            const data = await rbacApi.users.get(user.id);
            if (data.user) {
                setUserChannelAccess({
                    inbound_emails: data.user.inbound_emails || [],
                    outbound_emails: data.user.outbound_emails || [],
                    phone_numbers: data.user.phone_numbers || []
                });
                setSelectedUserId(user.id);
                setSelectedUserName(user.name || user.email);
                setShowChannelAccessDialog(true);
            }
        } catch (error) {
            console.error('Failed to fetch user channel access:', error);
            alert('Failed to load user channel access');
        }
    };

    // Check if user has super admin role
    const isSuperAdmin = (user: User) => {
        return user.roles?.some(role =>
            role.toLowerCase() === 'super admin' ||
            role.toLowerCase() === 'super_admin'
        ) || false;
    };

    if (!canView) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600">You don't have permission to view users.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-8 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
                    </div>
                    {canInvite && (
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <UserPlus className="h-4 w-4" />
                            Create User
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto px-8 pb-8">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-gray-600 mt-4">Loading users...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Roles
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Assigned
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-900">{user.name || 'No name'}</span>
                                                        {user.is_current_user && (
                                                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                                                                YOU
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles && user.roles.length > 0 ? (
                                                    user.roles.map((role, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                                                        >
                                                            {role}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic">No roles</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'active'
                                                ? 'bg-green-50 text-green-700 border border-green-100'
                                                : 'bg-red-50 text-red-700 border border-red-100'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {isSuperAdmin(user) ? (
                                                <div className="flex items-center gap-1">
                                                    <Shield className="h-4 w-4 text-purple-600" />
                                                    <span className="text-purple-700 font-medium">All Access</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <span>{user.assigned_leads_count} Leads</span>
                                                    <span>{user.assigned_contacts_count} Contacts</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                {canView && (
                                                    <button
                                                        onClick={() => handleViewPermissions(user)}
                                                        className="text-gray-400 hover:text-green-600 p-1 rounded-lg hover:bg-green-50 transition-colors"
                                                        title="View Permissions"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canManage && (
                                                    <>
                                                        <button
                                                            onClick={() => handleManageChannelAccess(user)}
                                                            className="text-gray-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors"
                                                            title="Manage Channel Access"
                                                        >
                                                            <Radio className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleManageFeatures(user)}
                                                            className="text-gray-400 hover:text-blue-500 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                            title="Manage Feature Access"
                                                        >
                                                            <ToggleLeft className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleGrantPermissions(user)}
                                                            className="text-gray-400 hover:text-purple-600 p-1 rounded-lg hover:bg-purple-50 transition-colors"
                                                            title="Manage Permissions"
                                                        >
                                                            <KeyRound className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditRoles(user)}
                                                            className="text-gray-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                            title="Edit Roles"
                                                        >
                                                            <UserCog className="h-4 w-4" />
                                                        </button>

                                                        {!user.is_current_user && !isSuperAdmin(user) && (
                                                            <button
                                                                onClick={() => handleDeactivateUser(user.id)}
                                                                className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                disabled={user.status !== 'active'}
                                                                title={user.status !== 'active' ? 'User already deactivated' : 'Deactivate User'}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {(user.is_current_user || isSuperAdmin(user)) && (
                                                            <div className="p-1" title={user.is_current_user ? 'Cannot deactivate yourself' : 'Cannot deactivate super admin'}>
                                                                <Trash2 className="h-4 w-4 text-gray-300 cursor-not-allowed" />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {users.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No users found. Create your first user!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showCreateDialog && (
                <CreateUserDialog
                    onClose={() => setShowCreateDialog(false)}
                    onSuccess={loadUsers}
                />
            )}

            {showEditRolesDialog && selectedUserId && (
                <EditUserRolesDialog
                    userId={selectedUserId}
                    currentRoleIds={selectedUserRoles}
                    onClose={() => {
                        setShowEditRolesDialog(false);
                        setSelectedUserId(null);
                        setSelectedUserRoles([]);
                    }}
                    onSuccess={loadUsers}
                />
            )}

            {showPermissionsDialog && selectedUserId && (
                <ViewUserPermissionsDialog
                    userId={selectedUserId}
                    userName={selectedUserName}
                    onClose={() => {
                        setShowPermissionsDialog(false);
                        setSelectedUserId(null);
                        setSelectedUserName('');
                    }}
                />
            )}

            {showGrantPermissionsDialog && selectedUserId && (
                <GrantPermissionsDialog
                    userId={selectedUserId}
                    userName={selectedUserName}
                    onClose={() => {
                        setShowGrantPermissionsDialog(false);
                        setSelectedUserId(null);
                        setSelectedUserName('');
                    }}
                    onSuccess={loadUsers}
                />
            )}

            {showManageFeaturesDialog && selectedUserId && (
                <ManageUserFeaturesDialog
                    userId={selectedUserId}
                    userName={selectedUserName}
                    onClose={() => {
                        setShowManageFeaturesDialog(false);
                        setSelectedUserId(null);
                        setSelectedUserName('');
                    }}
                    onSuccess={loadUsers}
                />
            )}

            {showChannelAccessDialog && selectedUserId && userChannelAccess && (
                <GrantChannelAccessDialog
                    userId={selectedUserId}
                    currentAccess={userChannelAccess}
                    onClose={() => {
                        setShowChannelAccessDialog(false);
                        setSelectedUserId(null);
                        setUserChannelAccess(null);
                    }}
                    onSuccess={loadUsers}
                />
            )}
        </div>
    );
}
