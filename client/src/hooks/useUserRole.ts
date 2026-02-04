import { useState, useEffect } from 'react';

/**
 * Hook to check if the current user has super admin role
 * @returns Object containing isSuperAdmin flag and loading state
 */
export function useUserRole() {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<string[]>([]);

    useEffect(() => {
        const checkRole = () => {
            try {
                // Get user data from localStorage
                const userStr = localStorage.getItem('user');
                if (!userStr) {
                    setIsSuperAdmin(false);
                    setLoading(false);
                    return;
                }

                const user = JSON.parse(userStr);
                const userRoles = user.roles || [];
                setRoles(userRoles);

                // Check if user has super admin role
                const hasSuper = userRoles.some((role: string) =>
                    role.toLowerCase() === 'super admin' ||
                    role.toLowerCase() === 'super_admin'
                );

                setIsSuperAdmin(hasSuper);
                setLoading(false);
            } catch (error) {
                console.error('Error checking user role:', error);
                setIsSuperAdmin(false);
                setLoading(false);
            }
        };

        checkRole();
    }, []);

    return { isSuperAdmin, loading, roles };
}
