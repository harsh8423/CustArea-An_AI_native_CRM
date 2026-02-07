import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = 'https://custarea.com';
const siteName = 'CustArea';

export const metadata: Metadata = {
  // Basic SEO
  title: {
    default: 'CustArea - AI Agents for Sales & Customer Support Automation',
    template: '%s | CustArea',
  },
  description: 'Automate your business with CustArea. On-demand AI Agents for WhatsApp, Email, and Phone. Unified inbox, visual workflows, and 24/7 customer engagement.',
  keywords: [
    'AI Sales Agent',
    'Customer Support Automation',
    'WhatsApp Business API',
    'AI Chatbot for Business',
    'Omnichannel Inbox',
    'Unified Customer Communication',
    'Workflow Automation Tool',
    'Sales Pipeline Automation',
    'Lead Qualification AI',
    'Small Business CRM',
    'CustArea',
    'Voice AI Agent',
  ],
  authors: [{ name: 'CustArea Team' }],
  creator: 'CustArea',
  publisher: 'CustArea',
  applicationName: 'CustArea',

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
    title: 'CustArea - AI Agents for Sales & Support Automation',
    description: 'Stop losing leads to missed calls and slow replies. CustArea automates your sales and support with intelligent AI agents on WhatsApp, Email, and Phone.',
    images: [
      {
        url: '/og-image.png', // Ensure this image exists or use logo
        width: 1200,
        height: 630,
        alt: 'CustArea - AI Automation Platform',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'CustArea - AI Agents for Sales & Support',
    description: 'Automate your business communication 24/7. AI Agents for WhatsApp, Email, & Phone.',
    images: ['/og-image.png'], // Ensure this image exists
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
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // Manifest
  manifest: '/manifest.json',

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
  headline: 'AI-Native Customer Engagement Platform',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Cloud/Web',
  description: 'Unified platform for AI-driven customer support and sales automation across WhatsApp, Email, and Phone.',
  url: siteUrl,
  image: `${siteUrl}/icon-512.png`,
  logo: `${siteUrl}/icon-512.png`,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Start for free, upgrade as you grow.',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '150',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    'Omni-Channel Inbox (WhatsApp, Email, Phone)',
    'AI Agents for Sales & Support',
    'Visual Workflow Automation',
    'CRM & Pipeline Management',
    'RAG Knowledge Base',
    'Automated Ticketing',
    'Live Chat Widget',
  ],
};

// Organization Schema
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CustArea',
  url: siteUrl,
  logo: `${siteUrl}/icon-512.png`,
  sameAs: [
    'https://twitter.com/custarea',
    'https://linkedin.com/company/custarea',
    'https://facebook.com/custarea',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    availableLanguage: ['English'],
    email: 'support@custarea.com',
  },
};

// FAQ Schema
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the AI agent handle complex queries?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our AI uses RAG (Retrieval-Augmented Generation) to search your knowledge base for accurate, grounded answers. It automatically detects sentiment and intent, follows guardrails, and escalates to humans when needed.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I connect my existing WhatsApp Business account?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! CustArea integrates with WhatsApp Business API through Twilio. Connect your existing verified business number or set up a new one. All conversations sync to your unified inbox.'
      }
    },
    {
      '@type': 'Question',
      name: 'How does the visual workflow automation work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our drag-and-drop builder lets you create powerful automations without code. Start with a trigger, add conditions and branching logic, use AI nodes to generate responses, and define multi-channel actions.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is my customer data secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Security is our top priority. We use JWT authentication, bcrypt hashing, role-based access control, and per-tenant data isolation. AI guardrails filter sensitive content.'
      }
    },
    {
      '@type': 'Question',
      name: 'What channels do you support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CustArea provides omni-channel support: WhatsApp Business API, Email (webhooks and SMTP), Phone/Voice with real-time AI, and an embeddable Live Chat widget. All channels flow into a unified inbox.'
      }
    }
  ]
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body className="bg-white text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
