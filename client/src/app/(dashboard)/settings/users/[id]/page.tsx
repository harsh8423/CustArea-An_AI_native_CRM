"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { rbacApi } from '@/lib/rbacApi';
import { usePermissions, useAllPermissions } from '@/hooks/usePermissions';
import { EditUserRolesDialog } from '@/components/settings/EditUserRolesDialog';
import { EditUserPermissionsDialog } from '@/components/settings/EditUserPermissionsDialog';
import { AssignLeadsContactsDialog } from '@/components/settings/AssignLeadsContactsDialog';
import { GrantChannelAccessDialog } from '@/components/settings/GrantChannelAccessDialog';

interface UserDetails {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    created_at: string;
    roles: Array<{ id: string; role_name: string; display_name: string }>;
    direct_permissions: Array<{ id: string; permission_key: string; display_name: string; granted: boolean }>;
    assigned_leads: Array<{ id: string; contact_name: string; status: string }>;
    assigned_contacts: Array<{ id: string; name: string; email: string }>;
    inbound_emails: Array<{ id: string; email_address: string }>;
    outbound_emails: Array<{ id: string; email_type: string; email_address: string }>;
    phone_numbers: Array<{ id: string; phone_number: string }>;
}

export default function UserDetailsPage() {
    const params = useParams();
    const userId = params.id as string;
    const { hasPermission } = usePermissions();
    const { allPermissions } = useAllPermissions();
    const [user, setUser] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Dialog state
    const [showRolesDialog, setShowRolesDialog] = useState(false);
    const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
    const [showLeadsDialog, setShowLeadsDialog] = useState(false);
    const [showContactsDialog, setShowContactsDialog] = useState(false);
    const [showChannelDialog, setShowChannelDialog] = useState(false);

    const canView = hasPermission('users.view');
    const canManage = hasPermission('users.manage');

    useEffect(() => {
        if (canView && userId) {
            loadUserDetails();
        }
    }, [canView, userId]);

    const loadUserDetails = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.users.get(userId);
            if (response.user) {
                setUser(response.user);
            }
        } catch (error) {
            console.error('Failed to load user details:', error);
        } finally {
            setLoading(false);
        }
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

    if (loading) {
        return (
            <div className="p-8">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 mt-4">Loading user details...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-yellow-800 mb-2">User Not Found</h2>
                    <p className="text-yellow-600">The requested user could not be found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <a href="/settings/users" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block">
                    ← Back to Users
                </a>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{user.name || 'No name'}</h1>
                        <p className="text-gray-600 mt-1">{user.email}</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {user.status}
                        </span>
                    </div>
                    {canManage && user.status === 'active' && (
                        <button
                            onClick={async () => {
                                if (confirm('Are you sure you want to deactivate this user?')) {
                                    await rbacApi.users.deactivate(userId);
                                    window.location.href = '/settings/users';
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                        >
                            Deactivate User
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {['overview', 'roles', 'permissions', 'leads', 'channels'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow p-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                            <dl className="grid grid-cols-2 gap-4">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{user.name || 'Not set'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{user.status}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{new Date(user.created_at).toLocaleDateString()}</dd>
                                </div>
                            </dl>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-2">Quick Stats</h3>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">{user.roles.length}</div>
                                    <div className="text-sm text-gray-600">Roles</div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">{user.direct_permissions.filter(p => p.granted).length}</div>
                                    <div className="text-sm text-gray-600">Permissions</div>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">{user.assigned_leads.length}</div>
                                    <div className="text-sm text-gray-600">Leads</div>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-orange-600">{user.assigned_contacts.length}</div>
                                    <div className="text-sm text-gray-600">Contacts</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'roles' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Assigned Roles</h3>
                            {canManage && (
                                <button
                                    onClick={() => setShowRolesDialog(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                >
                                    Edit Roles
                                </button>
                            )}
                        </div>
                        {user.roles.length === 0 ? (
                            <p className="text-gray-500">No roles assigned</p>
                        ) : (
                            <div className="grid gap-3">
                                {user.roles.map((role) => (
                                    <div key={role.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                        <div>
                                            <div className="font-medium text-gray-900">{role.display_name}</div>
                                            <div className="text-sm text-gray-500">{role.role_name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'permissions' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Direct Permission Overrides</h3>
                            {canManage && (
                                <button
                                    onClick={() => setShowPermissionsDialog(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                >
                                    Edit Permissions
                                </button>
                            )}
                        </div>
                        {user.direct_permissions.length === 0 ? (
                            <p className="text-gray-500">No direct permission overrides</p>
                        ) : (
                            <div className="grid gap-2">
                                {user.direct_permissions.map((perm) => (
                                    <div key={perm.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                        <div>
                                            <div className="font-medium text-gray-900">{perm.display_name}</div>
                                            <div className="text-sm text-gray-500">{perm.permission_key}</div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${perm.granted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {perm.granted ? 'Granted' : 'Revoked'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'leads' && (
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Assigned Leads</h3>
                                {canManage && (
                                    <button
                                        onClick={() => setShowLeadsDialog(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Assign Leads
                                    </button>
                                )}
                            </div>
                            {user.assigned_leads.length === 0 ? (
                                <p className="text-gray-500">No leads assigned</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {user.assigned_leads.map((lead) => (
                                                <tr key={lead.id}>
                                                    <td className="px-4 py-3 text-sm">{lead.contact_name}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                                            {lead.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Assigned Contacts</h3>
                                {canManage && (
                                    <button
                                        onClick={() => setShowContactsDialog(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Assign Contacts
                                    </button>
                                )}
                            </div>
                            {user.assigned_contacts.length === 0 ? (
                                <p className="text-gray-500">No contacts assigned</p>
                            ) : (
                                <div className="grid gap-2">
                                    {user.assigned_contacts.map((contact) => (
                                        <div key={contact.id} className="p-3 border border-gray-200 rounded-lg">
                                            <div className="font-medium text-gray-900">{contact.name}</div>
                                            <div className="text-sm text-gray-500">{contact.email}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'channels' && (
                    <div className="space-y-6">
                        <div className="flex justify-end mb-4">
                            {canManage && (
                                <button
                                    onClick={() => setShowChannelDialog(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                >
                                    Manage Channel Access
                                </button>
                            )}
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Inbound Email Access</h3>
                            {user.inbound_emails.length === 0 ? (
                                <p className="text-gray-500 text-sm">No inbound email access granted</p>
                            ) : (
                                <div className="grid gap-2">
                                    {user.inbound_emails.map((email) => (
                                        <div key={email.id} className="p-3 border border-gray-200 rounded-lg">
                                            <code className="text-sm text-blue-600">{email.email_address}</code>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Outbound Email Access</h3>
                            {user.outbound_emails.length === 0 ? (
                                <p className="text-gray-500 text-sm">No outbound email access granted</p>
                            ) : (
                                <div className="grid gap-2">
                                    {user.outbound_emails.map((email) => (
                                        <div key={email.id} className="p-3 border border-gray-200 rounded-lg">
                                            <code className="text-sm text-blue-600">{email.email_address}</code>
                                            <span className="ml-2 text-xs text-gray-500">({email.email_type})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Phone Number Access</h3>
                            {user.phone_numbers.length === 0 ? (
                                <p className="text-gray-500 text-sm">No phone number access granted</p>
                            ) : (
                                <div className="grid gap-2">
                                    {user.phone_numbers.map((phone) => (
                                        <div key={phone.id} className="p-3 border border-gray-200 rounded-lg">
                                            <code className="text-sm text-blue-600">{phone.phone_number}</code>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Dialogs */}
            {showRolesDialog && (
                <EditUserRolesDialog
                    userId={userId}
                    currentRoleIds={user?.roles?.map(r => r.id) || []}
                    onClose={() => setShowRolesDialog(false)}
                    onSuccess={() => {
                        loadUserDetails();
                        setShowRolesDialog(false);
                    }}
                />
            )}

            {showPermissionsDialog && (
                <EditUserPermissionsDialog
                    userId={userId}
                    currentPermissions={user?.direct_permissions || []}
                    onClose={() => setShowPermissionsDialog(false)}
                    onSuccess={() => {
                        loadUserDetails();
                        setShowPermissionsDialog(false);
                    }}
                />
            )}

            {showLeadsDialog && (
                <AssignLeadsContactsDialog
                    userId={userId}
                    type="leads"
                    currentAssignments={user?.assigned_leads || []}
                    onClose={() => setShowLeadsDialog(false)}
                    onSuccess={() => {
                        loadUserDetails();
                        setShowLeadsDialog(false);
                    }}
                />
            )}

            {showContactsDialog && (
                <AssignLeadsContactsDialog
                    userId={userId}
                    type="contacts"
                    currentAssignments={user?.assigned_contacts || []}
                    onClose={() => setShowContactsDialog(false)}
                    onSuccess={() => {
                        loadUserDetails();
                        setShowContactsDialog(false);
                    }}
                />
            )}

            {showChannelDialog && (
                <GrantChannelAccessDialog
                    userId={userId}
                    currentAccess={{
                        inbound_emails: user?.inbound_emails || [],
                        outbound_emails: user?.outbound_emails || [],
                        phone_numbers: user?.phone_numbers || []
                    }}
                    onClose={() => setShowChannelDialog(false)}
                    onSuccess={() => {
                        loadUserDetails();
                        setShowChannelDialog(false);
                    }}
                />
            )}
        </div>
    );
}
