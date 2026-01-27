"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface FeatureContextType {
    features: string[];
    hasFeature: (featureKey: string) => boolean;
    refreshFeatures: () => Promise<void>;
    loading: boolean;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export function FeatureProvider({ children }: { children: ReactNode }) {
    const [features, setFeatures] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFeatures = async () => {
        try {
            setLoading(true);
            const data = await api.features.getTenantFeatures();
            setFeatures(data.features || []);
        } catch (err) {
            console.error('Failed to fetch features:', err);
            // Set default core features if API fails
            setFeatures(['dashboard', 'sales', 'conversation', 'ai_agent']);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeatures();
    }, []);

    const hasFeature = (featureKey: string) => {
        // Core features are always available
        const coreFeatures = ['dashboard', 'sales', 'conversation', 'ai_agent'];
        if (coreFeatures.includes(featureKey)) {
            return true;
        }
        return features.includes(featureKey);
    };

    const refreshFeatures = async () => {
        await fetchFeatures();
    };

    return (
        <FeatureContext.Provider value={{ features, hasFeature, refreshFeatures, loading }}>
            {children}
        </FeatureContext.Provider>
    );
}

export function useFeatures() {
    const context = useContext(FeatureContext);
    if (context === undefined) {
        throw new Error('useFeatures must be used within a FeatureProvider');
    }
    return context;
}
