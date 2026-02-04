"use client";

import { useState, useEffect } from 'react';
import { Users, Shield, Trash2, Plus, Loader2 } from 'lucide-react';

interface Delegation {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    ai_deployment_resource_id: string;
    resource_display_name: string;
    channel: string;
    can_view: boolean;
    can_enable_disable: boolean;
    can_configure: boolean;
    granted_at: string;
}

interface User {
    id: string;
    email: string;
    name: string;
}

interface AIResource {
    id: string;
    channel: string;
    resource_display_name: string;
}

export function AIDeploymentDelegation() {
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [resources, setResources] = useState<AIResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // Form state
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [canView, setCanView] = useState(true);
    const [canEnableDisable, setCanEnableDisable] = useState(false);
    const [canConfigure, setCanConfigure] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // Load users
            const usersResponse = await fetch('http://localhost:8000/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const usersData = await usersResponse.json();
            const usersArray = Array.isArray(usersData) ? usersData : (usersData.users || []);
            setUsers(usersArray);

            // Load AI resources
            const resourcesResponse = await fetch('http://localhost:8000/api/ai/deployments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const resourcesData = await resourcesResponse.json();
            const deploymentsArray = resourcesData.deployments || [];
            setResources(deploymentsArray);

            // Load all delegations
            await loadDelegations();
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadDelegations = async () => {
        try {
            const token = localStorage.getItem('token');
            // We'll fetch all users' delegations (admin endpoint would be ideal)
            // For now, we'll use a workaround
            const response = await fetch('http://localhost:8000/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const usersData = await response.json();

            // Ensure usersData is an array
            const usersArray = Array.isArray(usersData) ? usersData : (usersData.users || []);

            const allDelegations: Delegation[] = [];

            for (const user of usersArray) {
                try {
                    const delResponse = await fetch(`http://localhost:8000/api/admin/users/${user.id}/ai-deployments`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (delResponse.ok) {
                        const delData = await delResponse.json();
                        const delegationsArray = Array.isArray(delData) ? delData : (delData.delegations || []);

                        delegationsArray.forEach((d: any) => {
                            allDelegations.push({
                                id: d.id,
                                user_id: user.id,
                                user_email: user.email,
                                user_name: user.name || user.email,
                                ai_deployment_resource_id: d.ai_deployment_resource_id,
                                resource_display_name: d.resource_display_name || 'Unknown Resource',
                                channel: d.channel || 'Unknown Channel', // Assuming channel might be part of the delegation object
                                can_view: d.can_view,
                                can_enable_disable: d.can_enable_disable,
                                can_configure: d.can_configure,
                                granted_at: d.granted_at
                            });
                        });
                    }
                } catch (error) {
                    console.error(`Failed to load delegations for user ${user.id}:`, error);
                }
            }

            setDelegations(allDelegations);
        } catch (error) {
            console.error('Failed to load delegations:', error);
        }
    };

    const handleGrantDelegation = async () => {
        if (!selectedUserId || !selectedResourceId) {
            alert('Please select both a user and a resource');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/api/admin/users/${selectedUserId}/ai-deployments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ai_deployment_resource_id: selectedResourceId,
                    can_view: canView,
                    can_enable_disable: canEnableDisable,
                    can_configure: canConfigure
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Delegation granted successfully');
                setShowAddDialog(false);
                resetForm();
                await loadDelegations();
            } else {
                alert(data.error || 'Failed to grant delegation');
            }
        } catch (error) {
            console.error('Failed to grant delegation:', error);
            alert('Failed to grant delegation');
        } finally {
            setSaving(false);
        }
    };

    const handleRevokeDelegation = async (userId: string, resourceId: string) => {
        if (!confirm('Are you sure you want to revoke this delegation?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/api/admin/users/${userId}/ai-deployments/${resourceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                alert('Delegation revoked successfully');
                await loadDelegations();
            } else {
                alert(data.error || 'Failed to revoke delegation');
            }
        } catch (error) {
            console.error('Failed to revoke delegation:', error);
            alert('Failed to revoke delegation');
        }
    };

    const resetForm = () => {
        setSelectedUserId('');
        setSelectedResourceId('');
        setCanView(true);
        setCanEnableDisable(false);
        setCanConfigure(false);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-8 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">AI Deployment Delegations</h2>
                        <p className="text-gray-600 mt-1">
                            Grant users permission to manage specific AI deployments
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddDialog(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Grant Delegation
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 pb-8">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        <p className="text-gray-600 mt-4">Loading delegations...</p>
                    </div>
                ) : delegations.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-12 text-center">
                        <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Delegations</h3>
                        <p className="text-gray-600 mb-6">
                            Grant users permission to manage specific AI deployments.
                        </p>
                        <button
                            onClick={() => setShowAddDialog(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Grant First Delegation
                        </button>
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
                                        Resource
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Permissions
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Granted
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {delegations.map((delegation) => (
                                    <tr key={`${delegation.user_id}-${delegation.ai_deployment_resource_id}`} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {delegation.user_name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {delegation.user_email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {delegation.resource_display_name}
                                                </div>
                                                <div className="text-xs text-gray-500 uppercase">
                                                    {delegation.channel}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {delegation.can_view && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                                        View
                                                    </span>
                                                )}
                                                {delegation.can_enable_disable && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                                        Enable/Disable
                                                    </span>
                                                )}
                                                {delegation.can_configure && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                                        Configure
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(delegation.granted_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleRevokeDelegation(delegation.user_id, delegation.ai_deployment_resource_id)}
                                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                                title="Revoke Delegation"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Delegation Dialog */}
            {showAddDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Shield className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Grant Delegation</h2>
                                    <p className="text-sm text-gray-600 mt-0.5">Allow user to manage AI deployment</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* User Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select User
                                </label>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="">-- Choose a user --</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || user.email} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Resource Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select AI Deployment
                                </label>
                                <select
                                    value={selectedResourceId}
                                    onChange={(e) => setSelectedResourceId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="">-- Choose a resource --</option>
                                    {resources.map(resource => (
                                        <option key={resource.id} value={resource.id}>
                                            {resource.resource_display_name} ({resource.channel})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Permission Checkboxes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Permissions
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={canView}
                                            onChange={(e) => setCanView(e.target.checked)}
                                            className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">View</div>
                                            <div className="text-xs text-gray-500">Can see the deployment</div>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={canEnableDisable}
                                            onChange={(e) => setCanEnableDisable(e.target.checked)}
                                            className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">Enable/Disable</div>
                                            <div className="text-xs text-gray-500">Can turn AI on/off</div>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={canConfigure}
                                            onChange={(e) => setCanConfigure(e.target.checked)}
                                            className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">Configure</div>
                                            <div className="text-xs text-gray-500">Can edit all settings</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAddDialog(false);
                                    resetForm();
                                }}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGrantDelegation}
                                disabled={saving || !selectedUserId || !selectedResourceId}
                                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Granting...
                                    </>
                                ) : (
                                    'Grant Delegation'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
