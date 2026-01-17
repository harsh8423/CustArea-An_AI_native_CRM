import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = 'https://custarea.com';
const siteName = 'CustArea';

export const metadata: Metadata = {
  // Basic SEO
  title: {
    default: 'CustArea - AI-Native Customer Relationship Platform',
    template: '%s | CustArea',
  },
  description: 'Unite WhatsApp, Email, Phone & Chat in one intelligent platform. Automate workflows visually. Deploy AI agents that truly understand your business. Start free trial today.',
  keywords: [
    'CRM software',
    'AI CRM',
    'Customer relationship management',
    'WhatsApp Business API',
    'Omni-channel inbox',
    'AI customer support',
    'Workflow automation',
    'Customer engagement platform',
    'Sales pipeline management',
    'AI chatbot',
    'Lead management',
    'Customer service automation',
  ],
  authors: [{ name: 'CustArea Team' }],
  creator: 'CustArea',
  publisher: 'CustArea',

  // Canonical URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },

  // Open Graph (Facebook, LinkedIn, etc.)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: 'CustArea - AI-Native Customer Relationship Platform',
    description: 'Unite WhatsApp, Email, Phone & Chat in one intelligent CRM. Automate workflows visually. Deploy AI agents that truly understand your business.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CustArea - AI-Powered CRM Platform',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'CustArea - AI-Native Customer Relationship Platform',
    description: 'Unite all customer conversations in one AI-powered platform. WhatsApp, Email, Phone & Chat unified.',
    images: ['/og-image.png'],
    creator: '@custarea',
    site: '@custarea',
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // App Icons
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // Manifest
  manifest: '/site.webmanifest',

  // Verification (add your verification codes)
  // verification: {
  //   google: 'YOUR_GOOGLE_VERIFICATION_CODE',
  //   yandex: 'YOUR_YANDEX_VERIFICATION_CODE',
  // },

  // Category
  category: 'technology',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1E4A8D' },
  ],
};

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CustArea',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI-Native Customer Relationship Platform that unifies WhatsApp, Email, Phone & Chat with intelligent automation.',
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial available',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '150',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    'Omni-Channel Inbox',
    'AI Agents',
    'Visual Workflow Builder',
    'Sales Pipeline Management',
    'Knowledge Base with RAG',
    'Smart Ticketing',
    'WhatsApp Business Integration',
    'Email Integration',
    'Phone Integration',
    'Live Chat Widget',
  ],
};

// Organization Schema
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CustArea',
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  sameAs: [
    'https://twitter.com/custarea',
    'https://linkedin.com/company/custarea',
    'https://facebook.com/custarea',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    availableLanguage: ['English'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mulish:ital,wght@0,200..1000;1,200..1000&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="bg-white text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
