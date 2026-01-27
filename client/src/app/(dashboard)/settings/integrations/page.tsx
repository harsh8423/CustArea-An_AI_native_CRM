"use client"

import { useState, useEffect } from "react";
import { Check, X, Zap, LayoutDashboard, Users, MessageSquare, Bot, Ticket, GitBranch, Megaphone, BarChart2 } from "lucide-react";
import { api } from "@/lib/api";
import { useFeatures } from "@/contexts/FeatureContext";

interface Feature {
    feature_key: string;
    display_name: string;
    description: string;
    icon: string;
    category: string;
    is_enabled: boolean;
}

const iconMap: Record<string, any> = {
    LayoutDashboard,
    Users,
    MessageSquare,
    Bot,
    Ticket,
    GitBranch,
    Megaphone,
    BarChart2
};

export default function IntegrationsPage() {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const { refreshFeatures } = useFeatures();

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        try {
            setLoading(true);
            const data = await api.features.getTenantFeatures();
            setFeatures(data.details || []);
        } catch (err) {
            console.error("Failed to fetch features:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (featureKey: string, currentlyEnabled: boolean) => {
        setToggling(featureKey);
        try {
            if (currentlyEnabled) {
                await api.features.disable(featureKey);
            } else {
                await api.features.enable(featureKey);
            }
            await fetchFeatures();
            await refreshFeatures(); // Update global feature context
        } catch (err) {
            console.error("Failed to toggle feature:", err);
        } finally {
            setToggling(null);
        }
    };

    const coreFeatures = features.filter(f => f.category === 'core');
    const optionalFeatures = features.filter(f => f.category === 'optional');

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-64 bg-gray-200 rounded"></div>
                    <div className="h-32 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Integrations & Features</h1>
                <p className="text-gray-600 mt-2">Enable or disable features to customize your CRM experience</p>
            </div>
            {/* Optional Features */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Optional Features</h2>
                <div className="space-y-3">
                    {optionalFeatures.map((feature) => {
                        const Icon = iconMap[feature.icon] || Zap;
                        const isEnabled = feature.is_enabled;
                        const isToggling = toggling === feature.feature_key;

                        return (
                            <div
                                key={feature.feature_key}
                                className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-gray-300 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${isEnabled ? 'from-blue-400 to-indigo-500' : 'from-gray-100 to-gray-200'} flex items-center justify-center`}>
                                        <Icon className={`h-6 w-6 ${isEnabled ? 'text-white' : 'text-gray-400'}`} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900">{feature.display_name}</h3>
                                            {isEnabled && <Check className="h-4 w-4 text-green-500" />}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggle(feature.feature_key, isEnabled)}
                                    disabled={isToggling}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition ${isEnabled
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isToggling ? 'Loading...' : isEnabled ? 'Enabled' : 'Disabled'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Disabled features won't appear in your sidebar and their routes will be blocked. Your data is preserved when you disable features.
                </p>
            </div>
        </div>
    );
}
