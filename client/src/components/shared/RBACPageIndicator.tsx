"use client";

import { useUserRole } from '@/hooks/useUserRole';
import { Filter, InfoIcon } from 'lucide-react';

interface RBACPageIndicatorProps {
    /**
     * Name of the resource being filtered (e.g., "campaigns", "calls", "agents")
     */
    resourceName: string;
    /**
     * Short description of what the filter does
     */
    filterDescription: string;
    /**
     * Optional: Show as compact version (smaller text, minimal padding)
     */
    compact?: boolean;
}

/**
 * Page-specific RBAC indicator that shows users when they're viewing 
 * filtered data based on their permissions
 */
export function RBACPageIndicator({ resourceName, filterDescription, compact = false }: RBACPageIndicatorProps) {
    const { isSuperAdmin, loading } = useUserRole();

    // Don't show while loading or for super admins
    if (loading || isSuperAdmin) {
        return null;
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                <Filter className="h-3 w-3" />
                <span className="font-medium">Filtered view</span>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 border border-blue-100 rounded-xl p-3">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Filter className="h-4 w-4 text-blue-600" />
                    </div>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900">Viewing Your {resourceName}</h4>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {filterDescription} <span className="text-gray-500 italic">Super administrators see all data.</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
