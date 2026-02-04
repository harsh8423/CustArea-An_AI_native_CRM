"use client";

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Global banner that appears for non-super admin users
 * Informs them they're viewing filtered data based on their permissions
 */
export function FilteredViewBanner() {
    const { isSuperAdmin, loading } = useUserRole();
    const [dismissed, setDismissed] = useState(false);

    // Check if banner was previously dismissed
    useEffect(() => {
        const isDismissed = localStorage.getItem('filteredViewBannerDismissed') === 'true';
        setDismissed(isDismissed);
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('filteredViewBannerDismissed', 'true');
    };

    // Don't show while loading
    if (loading) {
        return null;
    }

    // Don't show for super admins or if dismissed
    if (isSuperAdmin || dismissed) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-800">
                                <span className="font-medium">Filtered View:</span> You are viewing data based on your assigned resources and permissions.
                                <span className="text-gray-600 ml-1">Super administrators see all tenant data.</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white/50"
                        title="Dismiss banner"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
