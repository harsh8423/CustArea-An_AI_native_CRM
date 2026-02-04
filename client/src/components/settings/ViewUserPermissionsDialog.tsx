"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { X, Shield, Mail, Phone, MessageSquare, Users, Lock } from 'lucide-react';

interface ViewUserPermissionsDialogProps {
    userId: string;
    userName: string;
    onClose: () => void;
}

interface Role {
    id: string;
    role_name: string;
    display_name: string;
    description: string;
}

interface Permission {
    id: string;
    permission_key: string;
    display_name: string;
    granted: boolean;
}

interface UserDetails {
    roles: Role[];
    direct_permissions: Permission[];
    inbound_emails: any[];
    outbound_emails: any[];
    phone_numbers: any[];
    assigned_leads: any[];
    assigned_contacts: any[];
}

export function ViewUserPermissionsDialog({ userId, userName, onClose }: ViewUserPermissionsDialogProps) {
    const [loading, setLoading] = useState(true);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'channels' | 'data'>('roles');

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                setLoading(true);
                const data = await rbacApi.users.get(userId);
                setUserDetails(data.user);
            } catch (error) {
                console.error('Failed to fetch user details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUserDetails();
    }, [userId]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading permissions...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!userDetails) {
        return null;
    }

    // Group permissions by category
    const permissionsByCategory = userDetails.direct_permissions?.reduce((acc: any, perm: Permission) => {
        const category = perm.permission_key.split('.')[0];
        if (!acc[category]) acc[category] = [];
        acc[category].push(perm);
        return acc;
    }, {}) || {};

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">User Permissions</h2>
                        <p className="text-sm text-gray-600 mt-1">{userName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6">
                    {[
                        { id: 'roles', label: 'Roles', icon: Shield },
                        { id: 'permissions', label: 'Permissions', icon: Lock },
                        { id: 'channels', label: 'Channel Access', icon: MessageSquare },
                        { id: 'data', label: 'Data Access', icon: Users }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium  border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'roles' && (
                        <div className="space-y-3">
                            {userDetails.roles && userDetails.roles.length > 0 ? (
                                userDetails.roles.map((role) => (
                                    <div key={role.id} className="p-4 border border-gray-200 rounded-lg">
                                        <div className="font-semibold text-gray-900">{role.display_name}</div>
                                        {role.description && (
                                            <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-8">No roles assigned</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div className="space-y-4">
                            {Object.keys(permissionsByCategory).length > 0 ? (
                                Object.entries(permissionsByCategory).map(([category, perms]: [string, any]) => (
                                    <div key={category}>
                                        <h3 className="font-semibold text-gray-900 mb-2 capitalize">{category}</h3>
                                        <div className="space-y-2">
                                            {perms.map((perm: Permission) => (
                                                <div key={perm.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                    <span className="text-sm text-gray-700">{perm.display_name}</span>
                                                    <span className={`text-xs px-2 py-1 rounded ${perm.granted
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {perm.granted ? 'Granted' : 'Revoked'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-8">No direct permission overrides</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'channels' && (
                        <div className="space-y-6">
                            {/* Email Access */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Email Addresses
                                </h3>
                                {userDetails.inbound_emails && userDetails.inbound_emails.length > 0 ? (
                                    <div className="space-y-2">
                                        {userDetails.inbound_emails.map((email: any, idx) => (
                                            <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                                                {email.email_address}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">No email access granted</p>
                                )}
                            </div>

                            {/* Phone Access */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    Phone Numbers
                                </h3>
                                {userDetails.phone_numbers && userDetails.phone_numbers.length > 0 ? (
                                    <div className="space-y-2">
                                        {userDetails.phone_numbers.map((phone: any, idx) => (
                                            <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                                                {phone.phone_number}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">No phone access granted</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            {/* Leads */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Assigned Leads</h3>
                                <p className="text-gray-600 text-sm">
                                    {userDetails.assigned_leads?.length || 0} leads assigned
                                </p>
                            </div>

                            {/* Contacts */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Assigned Contacts</h3>
                                <p className="text-gray-600 text-sm">
                                    {userDetails.assigned_contacts?.length || 0} contacts assigned
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
