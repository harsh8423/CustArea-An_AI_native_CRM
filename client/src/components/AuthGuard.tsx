"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');

            if (!token) {
                console.log('No token found - redirecting to login');
                router.push('/login');
                return;
            }

            // Verify token is still valid by making a test request
            try {
                const res = await fetch('http://localhost:8000/api/features/tenant', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.status === 401 || res.status === 403) {
                    console.log('Token invalid/expired - clearing and redirecting to login');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    document.cookie = 'token=; path=/; max-age=0';
                    router.push('/login');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
            }
        };

        checkAuth();

        // Also listen for fetch errors globally
        const handleFetchError = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.status === 401 || customEvent.detail?.status === 403) {
                console.log('Auth error detected - redirecting to login');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                document.cookie = 'token=; path=/; max-age=0';
                router.push('/login');
            }
        };

        window.addEventListener('auth-error', handleFetchError);

        return () => {
            window.removeEventListener('auth-error', handleFetchError);
        };
    }, [router]);

    return <>{children}</>;
}
