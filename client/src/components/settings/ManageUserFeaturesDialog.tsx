'use client';

import { useState, useEffect } from 'react';
import { X, Save, ToggleLeft, Loader2, Check, Minus } from 'lucide-react';

interface Feature {
    id: string;
    feature_key: string;
    feature_name: string;
    description: string;
    tenant_enabled: boolean;
    user_override?: {
        is_enabled: boolean;
        granted_by: string;
        granted_at: string;
    };
}

interface ManageUserFeaturesDialogProps {
    userId: string;
    userName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ManageUserFeaturesDialog({ userId, userName, onClose, onSuccess }: ManageUserFeaturesDialogProps) {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Map<string, boolean | null>>(new Map());

    useEffect(() => {
        loadFeatures();
    }, [userId]);

    async function loadFeatures() {
        try {
            const token = localStorage.getItem('token');

            // Load all available features
            const featuresRes = await fetch('http://localhost:8000/api/features', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const allFeatures = await featuresRes.json();

            // Load user's feature overrides
            const userFeaturesRes = await fetch(`http://localhost:8000/api/admin/users/${userId}/features`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userOverridesData = await userFeaturesRes.json();
            const userOverrides = Array.isArray(userOverridesData) ? userOverridesData : [];

            // Ensure allFeatures is an array
            const featuresArray = Array.isArray(allFeatures) ? allFeatures : [];

            // Merge data
            const merged = featuresArray.map((f: any) => {
                const override = userOverrides.find((uf: any) => uf.feature_id === f.id);
                return {
                    id: f.id,
                    feature_key: f.feature_key,
                    feature_name: f.feature_name,
                    description: f.description,
                    tenant_enabled: f.is_enabled,
                    user_override: override ? {
                        is_enabled: override.is_enabled,
                        granted_by: override.granted_by,
                        granted_at: override.granted_at
                    } : undefined
                };
            });

            setFeatures(merged);
        } catch (error) {
            console.error('Failed to load features:', error);
        } finally {
            setLoading(false);
        }
    }

    function getFeatureState(feature: Feature): 'tenant_default' | 'override_enabled' | 'override_disabled' {
        const pendingChange = pendingChanges.get(feature.id);

        if (pendingChange !== undefined) {
            if (pendingChange === null) return 'tenant_default';
            return pendingChange ? 'override_enabled' : 'override_disabled';
        }

        if (!feature.user_override) return 'tenant_default';
        return feature.user_override.is_enabled ? 'override_enabled' : 'override_disabled';
    }

    function toggleFeatureAccess(feature: Feature) {
        const currentState = getFeatureState(feature);
        const changes = new Map(pendingChanges);

        // Simple toggle: enabled <-> disabled
        const isCurrentlyEnabled = currentState === 'override_enabled' ||
            (currentState === 'tenant_default' && feature.tenant_enabled);

        if (isCurrentlyEnabled) {
            changes.set(feature.id, false); // Disable it
        } else {
            changes.set(feature.id, true); // Enable it
        }

        setPendingChanges(changes);
    }

    async function handleSave() {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            for (const [featureId, newValue] of pendingChanges.entries()) {
                // Find the feature to get its feature_key
                const feature = features.find(f => f.id === featureId);
                if (!feature) continue;

                if (newValue === null) {
                    // Remove override
                    await fetch(`http://localhost:8000/api/admin/users/${userId}/features/${featureId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } else {
                    // Grant override - send featureKey, not featureId
                    await fetch(`http://localhost:8000/api/admin/users/${userId}/features`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            featureKey: feature.feature_key,  // Backend expects featureKey
                            isEnabled: newValue
                        })
                    });
                }
            }

            setPendingChanges(new Map());
            await loadFeatures();
            onSuccess?.();
        } catch (error) {
            console.error('Failed to save feature access:', error);
            alert('Failed to save changes');
        } finally {
            setSaving(false);
        }
    }

    const hasPendingChanges = pendingChanges.size > 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Manage Feature Access</h2>
                            <p className="text-sm text-gray-500 mt-1">Configure feature overrides for {userName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {features.map(feature => {
                                const state = getFeatureState(feature);
                                const hasPendingChange = pendingChanges.has(feature.id);

                                return (
                                    <div
                                        key={feature.id}
                                        className={`border rounded-xl p-4 transition-all ${hasPendingChange
                                            ? 'border-indigo-300 bg-indigo-50'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900">{feature.feature_name}</h3>
                                                    {hasPendingChange && (
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                                                            Modified
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-sm text-gray-500 mt-1">{feature.description}</p>

                                            </div>

                                            {/* Simple Enable/Disable Toggle */}
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-medium ${state === 'override_enabled' || (state === 'tenant_default' && feature.tenant_enabled)
                                                    ? 'text-green-600'
                                                    : 'text-gray-400'
                                                    }`}>
                                                    {state === 'override_enabled' || (state === 'tenant_default' && feature.tenant_enabled)
                                                        ? 'Enabled'
                                                        : 'Disabled'}
                                                </span>

                                                <button
                                                    onClick={() => toggleFeatureAccess(feature)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${state === 'override_enabled' || (state === 'tenant_default' && feature.tenant_enabled)
                                                        ? 'bg-green-600'
                                                        : 'bg-gray-300'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state === 'override_enabled' || (state === 'tenant_default' && feature.tenant_enabled)
                                                            ? 'translate-x-6'
                                                            : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            {hasPendingChanges
                                ? `${pendingChanges.size} pending change${pendingChanges.size > 1 ? 's' : ''}`
                                : 'No pending changes'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!hasPendingChanges || saving}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
