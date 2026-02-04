"use client";

import { useState, useEffect, useCallback } from 'react';
import { rbacApi } from '@/lib/rbacApi';

interface Permission {
    id: string;
    permission_key: string;
    display_name: string;
    description?: string;
    category: string;
}

export function usePermissions() {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.permissions.getMyPermissions();
            if (response.permissions) {
                setPermissions(response.permissions);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load permissions');
            console.error('Failed to load permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = useCallback((permissionKey: string): boolean => {
        return permissions.includes(permissionKey);
    }, [permissions]);

    const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
        return permissionKeys.some(key => permissions.includes(key));
    }, [permissions]);

    const hasAllPermissions = useCallback((permissionKeys: string[]): boolean => {
        return permissionKeys.every(key => permissions.includes(key));
    }, [permissions]);

    return {
        permissions,
        loading,
        error,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        reload: loadPermissions
    };
}

export function useAllPermissions() {
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [grouped, setGrouped] = useState<Record<string, Permission[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAllPermissions();
    }, []);

    const loadAllPermissions = async () => {
        try {
            setLoading(true);
            const response = await rbacApi.permissions.list();
            if (response.permissions) {
                setAllPermissions(response.permissions);
                setGrouped(response.grouped || {});
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load all permissions');
            console.error('Failed to load all permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        allPermissions,
        grouped,
        loading,
        error,
        reload: loadAllPermissions
    };
}
