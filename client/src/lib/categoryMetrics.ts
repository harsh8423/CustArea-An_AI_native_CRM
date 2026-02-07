/**
 * Category-specific metric mappings for analytics filtering
 */

export type CategoryType = 'all' | 'email' | 'phone' | 'campaign' | 'contact' | 'lead' | 'ticket';

export interface CategoryConfig {
    metrics: string[];
    charts: string[];
    label: string;
    description: string;
}

export const CATEGORY_CONFIGS: Record<CategoryType, CategoryConfig> = {
    all: {
        metrics: [], // Empty means show all
        charts: [],
        label: 'All Categories',
        description: 'Overview of all analytics across all channels'
    },
    email: {
        metrics: [
            'emails_sent_total',
            'emails_sent_by_ai',
            'emails_sent_by_human',
            'emails_received',
            'email_conversations_handled',
            'copilot_uses'
        ],
        charts: ['email-ai-vs-human', 'email-trend'],
        label: 'Email Analytics',
        description: 'Email communication metrics and AI assistance usage'
    },
    phone: {
        metrics: [
            'calls_total',
            'calls_by_ai',
            'calls_by_human',
            'calls_duration_seconds',
            'calls_ai_duration_seconds',
            'calls_human_duration_seconds'
        ],
        charts: ['phone-duration', 'phone-ai-vs-human'],
        label: 'Phone Analytics',
        description: 'Phone call metrics and duration tracking'
    },
    campaign: {
        metrics: [
            'campaigns_created',
            'campaigns_launched',
            'campaigns_paused',
            'campaign_emails_sent',
            'bulk_emails_sent',
            'bulk_calls_made',
            'campaign_emails_sent_by_ai',
            'campaign_emails_sent_by_human'
        ],
        charts: ['campaign-performance', 'campaign-emails'],
        label: 'Campaign Analytics',
        description: 'Campaign performance and outreach metrics'
    },
    contact: {
        metrics: [
            'contacts_created',
            'contacts_updated',
            'contacts_imported',
            'contact_groups_created'
        ],
        charts: ['crm-overview'],
        label: 'Contact Analytics',
        description: 'Contact management and import metrics'
    },
    lead: {
        metrics: [
            'leads_created',
            'leads_updated',
            'leads_deleted'
        ],
        charts: ['crm-overview'],
        label: 'Lead Analytics',
        description: 'Lead generation and management metrics'
    },
    ticket: {
        metrics: [
            'tickets_created',
            'tickets_resolved',
            'tickets_updated',
            'tickets_assigned'
        ],
        charts: ['ticket-resolution', 'ticket-trend'],
        label: 'Ticket Analytics',
        description: 'Support ticket tracking and resolution metrics'
    }
};

/**
 * Check if a metric belongs to a category
 */
export function isMetricInCategory(metricName: string, category: CategoryType): boolean {
    if (category === 'all') return true;

    const config = CATEGORY_CONFIGS[category];
    return config.metrics.includes(metricName);
}

/**
 * Check if a chart should be shown for a category
 */
export function shouldShowChart(chartType: string, category: CategoryType): boolean {
    if (category === 'all') return true;

    const config = CATEGORY_CONFIGS[category];
    return config.charts.includes(chartType);
}

/**
 * Get metrics that should be displayed for a category
 */
export function getCategoryMetrics(category: CategoryType): string[] {
    if (category === 'all') return [];
    return CATEGORY_CONFIGS[category]?.metrics || [];
}

/**
 * Get category configuration
 */
export function getCategoryConfig(category: CategoryType): CategoryConfig {
    return CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.all;
}
