// Social media icon configurations with icon paths
export const SOCIAL_ICONS = [
    {
        id: 'whatsapp',
        color: '#25D366',
        label: 'WhatsApp',
        iconPath: '/icons/whatsapp.png'
    },
    {
        id: 'gmail',
        color: '#EA4335',
        label: 'Gmail',
        iconPath: '/icons/gmail.png'
    },
    {
        id: 'sms',
        color: '#34C759',
        label: 'SMS',
        iconPath: '/icons/sms.png'
    },
    {
        id: 'facebook',
        color: '#1877F2',
        label: 'Facebook',
        iconPath: '/icons/facebook.png'
    },
    {
        id: 'phone',
        color: '#D4AF37',
        label: 'Phone',
        iconPath: '/icons/phone.png'
    },
    {
        id: 'instagram',
        color: '#E4405F',
        label: 'Instagram',
        iconPath: '/icons/instagram.png'
    },
] as const;

export type SocialIcon = typeof SOCIAL_ICONS[number];

// Initial positions for icons inside the cube
export const ICON_POSITIONS: [number, number, number][] = [
    [1.2, 1.2, 1.2],
    [-1.2, 1.2, -1.2],
    [1.2, -1.2, -1.2],
    [-1.2, -1.2, 1.2],
    [0, 1.5, 0],
    [0, -1.5, 0],
];
