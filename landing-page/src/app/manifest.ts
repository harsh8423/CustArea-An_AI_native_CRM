import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'CustArea - AI Customer Support & Sales',
        short_name: 'CustArea',
        description: 'On-demand AI for Sales and Customer Support. Active when your team is offline or overloaded.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1E4A8D',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
