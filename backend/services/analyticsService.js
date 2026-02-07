const { pool } = require('../config/db');
const { isSuperAdmin } = require('./permissionService');

/**
 * Analytics Service
 * Handles fetching and calculating analytics metrics with role-based access control
 */

/**
 * Get analytics metrics for a user or tenant
 * @param {string} requestUserId - User making the request
 * @param {Object} filters - { targetUserId, timeRange, category, startDate, endDate }
 * @returns {Promise<Object>} - Analytics data
 */
async function getAnalyticsMetrics(requestUserId, {
    targetUserId = null,
    timeRange = 'daily',
    category = 'all',
    startDate = null,
    endDate = null
}) {
    try {
        // Check if requester is super admin
        const isAdmin = await isSuperAdmin(requestUserId);

        // Get tenant from requesting user
        const userResult = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [requestUserId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const tenantId = userResult.rows[0].tenant_id;

        // Determine which user's data to fetch
        let userId;
        if (isAdmin && targetUserId) {
            // Super admin viewing specific user
            userId = targetUserId;
        } else if (isAdmin && !targetUserId) {
            // Super admin viewing tenant-wide (user_id = NULL)
            userId = null;
        } else {
            // Regular user viewing their own data
            userId = requestUserId;
        }

        // Build query based on filters
        const metrics = await fetchMetrics({
            tenantId,
            userId,
            timeRange,
            category,
            startDate,
            endDate
        });

        return metrics;
    } catch (error) {
        console.error('Error fetching analytics metrics:', error);
        throw error;
    }
}

/**
 * Fetch metrics from database
 * @private
 */
async function fetchMetrics({ tenantId, userId, timeRange, category, startDate, endDate }) {
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;

    // FIXED: User filter logic
    // - If userId is specified, filter for that specific user
    // - If userId is null (tenant-wide view), DON'T filter by user_id at all
    //   This will aggregate all users' metrics for the tenant
    if (userId !== null && userId !== undefined) {
        conditions.push(`user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }
    // Note: We no longer add "user_id IS NULL" condition
    // This allows the query to sum across all users for tenant-wide view

    // CRITICAL FIX: The triggers ONLY write records with metric_period = 'daily'
    // We should ALWAYS query for 'daily' records and filter by date range
    // The timeRange parameter determines the DATE FILTER, not the metric_period filter
    
    // Time range filter - ALWAYS query daily records
    conditions.push(`metric_period = 'daily'`);
    // Note: We don't add timeRange as a parameter since it's hardcoded to 'daily'

    // Date range filter based on time range
    // The timeRange param determines HOW we filter the dates
    const today = new Date();
  /**
 * FIX FOR TIMEZONE ISSUE IN ANALYTICS
 * 
 * PROBLEM:
 * - Database stores metric_date as DATE using CURRENT_DATE (UTC-based)
 * - Server code was using local timezone dates
 * - User in India (UTC+5:30) at 00:14 sees data from tomorrow UTC, which doesn't exist yet
 * 
 * SOLUTION:
 * Replace lines 95-127 in analyticsService.js with this code that uses UTC consistently:
 */

// Calculate date range based on timeRange
// IMPORTANT: Database metric_date is stored as DATE in UTC (CURRENT_DATE in PostgreSQL)
// We must use UTC dates here to match
let queryStartDate, queryEndDate;

// Get current date in UTC (not local timezone)
const now = new Date();
const todayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
));

if (timeRange === 'daily') {
    // For daily: ONLY today's data (in UTC)
    queryStartDate = new Date(todayUTC);
    queryEndDate = new Date(todayUTC);
    queryEndDate.setUTCHours(23, 59, 59, 999); // End of today UTC
} else if (timeRange === 'weekly') {
    // For weekly: Current week (Sunday to Saturday) in UTC
    const dayOfWeek = todayUTC.getUTCDay();
    queryStartDate = new Date(todayUTC);
    queryStartDate.setUTCDate(todayUTC.getUTCDate() - dayOfWeek); // Start of week (Sunday)
    queryEndDate = new Date(queryStartDate);
    queryEndDate.setUTCDate(queryStartDate.getUTCDate() + 6); // End of week (Saturday)
    queryEndDate.setUTCHours(23, 59, 59, 999);
} else if (timeRange === 'monthly') {
    // For monthly: Current month (1st to last day) in UTC
    queryStartDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1));
    queryEndDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 0)); // Last day of month
    queryEndDate.setUTCHours(23, 59, 59, 999);
} else {
    // Fallback: use provided dates or last 30 days (in UTC)
    if (startDate && endDate) {
        queryStartDate = new Date(startDate);
        queryEndDate = new Date(endDate);
    } else {
        queryStartDate = new Date(todayUTC);
        queryStartDate.setUTCDate(queryStartDate.getUTCDate() - 30);
        queryEndDate = todayUTC;
    }
}


    if (queryStartDate) {
        conditions.push(`metric_date >= $${paramIndex}`);
        params.push(queryStartDate);
        paramIndex++;
    }

    if (queryEndDate) {
        conditions.push(`metric_date <= $${paramIndex}`);
        params.push(queryEndDate);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Fetch aggregated metrics
    // We always query 'daily' records and aggregate them by date
    const result = await pool.query(`
        SELECT 
            metric_date,
            -- Email metrics
            SUM(emails_sent_total) as emails_sent_total,
            SUM(emails_sent_by_ai) as emails_sent_by_ai,
            SUM(emails_sent_by_human) as emails_sent_by_human,
            SUM(emails_received) as emails_received,
            SUM(email_conversations_handled) as email_conversations_handled,
            SUM(copilot_uses) as copilot_uses,
            -- Phone metrics
            SUM(calls_total) as calls_total,
            SUM(calls_by_ai) as calls_by_ai,
            SUM(calls_by_human) as calls_by_human,
            SUM(calls_duration_seconds) as calls_duration_seconds,
            SUM(calls_ai_duration_seconds) as calls_ai_duration_seconds,
            SUM(calls_human_duration_seconds) as calls_human_duration_seconds,
            -- Campaign metrics
            SUM(campaigns_created) as campaigns_created,
            SUM(campaigns_launched) as campaigns_launched,
            SUM(campaigns_paused) as campaigns_paused,
            SUM(campaign_emails_sent) as campaign_emails_sent,
            SUM(bulk_emails_sent) as bulk_emails_sent,
            SUM(bulk_calls_made) as bulk_calls_made,
            -- CRM metrics
            SUM(leads_created) as leads_created,
            SUM(leads_updated) as leads_updated,
            SUM(leads_deleted) as leads_deleted,
            SUM(contacts_created) as contacts_created,
            SUM(contacts_updated) as contacts_updated,
            SUM(contacts_imported) as contacts_imported,
            SUM(contact_groups_created) as contact_groups_created,
            -- Ticketing metrics
            SUM(tickets_created) as tickets_created,
            SUM(tickets_updated) as tickets_updated,
            SUM(tickets_resolved) as tickets_resolved,
            SUM(tickets_assigned) as tickets_assigned,
            -- Settings & Admin
            SUM(users_invited) as users_invited,
            SUM(permissions_updated) as permissions_updated,
            -- Conversation metrics
            SUM(conversations_total) as conversations_total,
            SUM(conversations_assigned) as conversations_assigned,
            SUM(messages_sent) as messages_sent
        FROM analytics_metrics
        WHERE ${whereClause}
        GROUP BY metric_date
        ORDER BY metric_date DESC
    `, params);

    // Calculate totals and format data
    const timeSeriesData = result.rows;
    const totals = calculateTotals(result.rows);
    
    // FETCH REAL-TIME CAMPAIGN STATS (AI vs Human)
    // We query the messages table directly to get accurate breakdowns for the selected period
    const campaignStats = await fetchCampaignMessageStats(tenantId, userId, queryStartDate, queryEndDate);
    
    // Merge into totals
    totals.campaign_emails_sent_by_ai = parseInt(campaignStats.ai_sent || 0);
    totals.campaign_emails_sent_by_human = parseInt(campaignStats.human_sent || 0);
    
    // Optional: Overwrite total with real-time count if more accurate, 
    // but usually we trust the analytics_metrics aggregation for totals. 
    // For now, we just add the breakdown.

    const categoryBreakdown = calculateCategoryBreakdown(result.rows, category);

    return {
        totals,
        timeSeriesData,
        categoryBreakdown,
        period: timeRange
    };
}

/**
 * Calculate totals from time series data
 * @private
 */
function calculateTotals(rows) {
    const totals = {
        emails_sent_total: 0,
        emails_sent_by_ai: 0,
        emails_sent_by_human: 0,
        emails_received: 0,
        calls_total: 0,
        calls_by_ai: 0,
        calls_by_human: 0,
        calls_duration_seconds: 0,
        campaigns_created: 0,
        campaign_emails_sent: 0,  // ADDED: This was missing!
        leads_created: 0,
        contacts_created: 0,
        tickets_created: 0,
        tickets_resolved: 0
    };

    rows.forEach(row => {
        Object.keys(totals).forEach(key => {
            totals[key] += parseInt(row[key] || 0);
        });
    });

    return totals;
}

/**
 * Calculate category-specific breakdown
 * @private
 */
function calculateCategoryBreakdown(rows, category) {
    // Calculate breakdown for all categories
    const allCategories = {
        email: sumCategoryMetrics(rows, ['emails_sent_total', 'emails_sent_by_ai', 'emails_sent_by_human', 'emails_received']),
        phone: sumCategoryMetrics(rows, ['calls_total', 'calls_by_ai', 'calls_by_human', 'calls_duration_seconds']),
        campaign: sumCategoryMetrics(rows, ['campaigns_created', 'campaigns_launched', 'campaigns_paused', 'campaign_emails_sent']),
        crm: sumCategoryMetrics(rows, ['leads_created', 'leads_updated', 'contacts_created', 'contacts_updated', 'contacts_imported', 'contact_groups_created']),
        ticket: sumCategoryMetrics(rows, ['tickets_created', 'tickets_resolved', 'tickets_updated'])
    };

    if (category === 'all') {
        return allCategories;
    }

    // Return specific category data with additional context
    const categoryData = {
        [category]: allCategories[category] || {},
        categoryName: category
    };
    
    return categoryData;
}

/**
 * Sum specific metrics for a category
 * @private
 */
function sumCategoryMetrics(rows, metricKeys) {
    const result = {};
    metricKeys.forEach(key => {
        result[key] = rows.reduce((sum, row) => sum + parseInt(row[key] || 0), 0);
    });
    return result;
}

/**
 * Get chart data formatted for specific chart types
 * @param {string} requestUserId - User making the request
 * @param {string} chartType - Type of chart (email, phone, campaign, etc.)
 * @param {Object} filters - Filters
 * @returns {Promise<Object>} - Chart-specific data
 */
async function getChartData(requestUserId, chartType, filters) {
    try {
        const metrics = await getAnalyticsMetrics(requestUserId, filters);

        switch (chartType) {
            case 'email-ai-vs-human':
                return formatEmailAIChart(metrics.timeSeriesData);
            
            case 'phone-duration':
                return formatPhoneDurationChart(metrics.timeSeriesData);
            
            case 'campaign-performance':
                return formatCampaignChart(metrics.timeSeriesData);
            
            case 'crm-overview':
                return formatCRMChart(metrics.timeSeriesData);
            
            case 'ticket-status':
                return formatTicketChart(metrics.timeSeriesData);
            
            default:
                return metrics;
        }
    } catch (error) {
        console.error('Error fetching chart data:', error);
        throw error;
    }
}

/**
 * Format email AI vs Human chart data
 * @private
 */
function formatEmailAIChart(timeSeriesData) {
    return timeSeriesData.map(row => ({
        date: row.metric_date,
        ai: parseInt(row.emails_sent_by_ai || 0),
        human: parseInt(row.emails_sent_by_human || 0),
        total: parseInt(row.emails_sent_total || 0)
    }));
}

/**
 * Format phone duration chart data
 * @private
 */
function formatPhoneDurationChart(timeSeriesData) {
    return timeSeriesData.map(row => ({
        date: row.metric_date,
        ai_duration: parseInt(row.calls_ai_duration_seconds || 0),
        human_duration: parseInt(row.calls_human_duration_seconds || 0),
        total_duration: parseInt(row.calls_duration_seconds || 0),
        ai_calls: parseInt(row.calls_by_ai || 0),
        human_calls: parseInt(row.calls_by_human || 0)
    }));
}

/**
 * Format campaign performance chart data
 * @private
 */
function formatCampaignChart(timeSeriesData) {
    return timeSeriesData.map(row => ({
        date: row.metric_date,
        campaigns_created: parseInt(row.campaigns_created || 0),
        campaigns_launched: parseInt(row.campaigns_launched || 0),
        emails_sent: parseInt(row.campaign_emails_sent || 0)
    }));
}

/**
 * Format CRM overview chart data
 * @private
 */
function formatCRMChart(timeSeriesData) {
    return timeSeriesData.map(row => ({
        date: row.metric_date,
        leads_created: parseInt(row.leads_created || 0),
        contacts_created: parseInt(row.contacts_created || 0),
        contacts_imported: parseInt(row.contacts_imported || 0)
    }));
}

/**
 * Format ticket status chart data
 * @private
 */
function formatTicketChart(timeSeriesData) {
    return timeSeriesData.map(row => ({
        date: row.metric_date,
        created: parseInt(row.tickets_created || 0),
        resolved: parseInt(row.tickets_resolved || 0),
        updated: parseInt(row.tickets_updated || 0)
    }));
}

/**
 * Get phone call AI usage data for pricing analysis
 * @param {string} requestUserId - User making the request
 * @param {Object} filters - { targetUserId, startDate, endDate }
 * @returns {Promise<Object>} - AI usage and cost data
 */
async function getPhoneAIUsage(requestUserId, { targetUserId = null, startDate = null, endDate = null }) {
    try {
        const isAdmin = await isSuperAdmin(requestUserId);

        const userResult = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [requestUserId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const tenantId = userResult.rows[0].tenant_id;

        const conditions = ['pcau.tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;

        // User filter
        if (!isAdmin) {
            conditions.push(`pcau.user_id = $${paramIndex}`);
            params.push(requestUserId);
            paramIndex++;
        } else if (targetUserId) {
            conditions.push(`pcau.user_id = $${paramIndex}`);
            params.push(targetUserId);
            paramIndex++;
        }

        // Date range
        if (startDate) {
            conditions.push(`pcau.created_at >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            conditions.push(`pcau.created_at <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const result = await pool.query(`
            SELECT 
                pcau.id,
                pcau.phone_call_id,
                pc.from_number,
                pc.to_number,
                pc.duration_seconds,
                -- Model details
                stt.provider as stt_provider,
                stt.model_name as stt_model,
                llm.provider as llm_provider,
                llm.model_name as llm_model,
                tts.provider as tts_provider,
                tts.model_name as tts_model,
                rts.provider as realtime_provider,
                rts.model_name as realtime_model,
                -- Usage
                pcau.stt_duration_seconds,
                pcau.llm_tokens_used,
                pcau.tts_characters_used,
                pcau.realtime_duration_seconds,
                -- Costs
                pcau.stt_cost,
                pcau.llm_cost,
                pcau.tts_cost,
                pcau.realtime_cost,
                pcau.total_estimated_cost,
                pcau.created_at
            FROM phone_call_ai_usage pcau
            LEFT JOIN phone_calls pc ON pc.id = pcau.phone_call_id
            LEFT JOIN x_stt stt ON stt.id = pcau.stt_model_id
            LEFT JOIN x_llm llm ON llm.id = pcau.llm_model_id
            LEFT JOIN x_tts tts ON tts.id = pcau.tts_model_id
            LEFT JOIN x_realtime_sts rts ON rts.id = pcau.realtime_model_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY pcau.created_at DESC
        `, params);

        // Calculate summary
        const summary = {
            total_calls: result.rows.length,
            total_cost: result.rows.reduce((sum, row) => sum + parseFloat(row.total_estimated_cost || 0), 0),
            total_duration: result.rows.reduce((sum, row) => sum + parseInt(row.duration_seconds || 0), 0),
            by_model: {}
        };

        return {
            usage: result.rows,
            summary
        };
    } catch (error) {
        console.error('Error fetching phone AI usage:', error);
        throw error;
    }
}

/**
 * Get list of users for super admin dropdown
 * @param {string} requestUserId - User making the request (must be super_admin)
 * @returns {Promise<Array>} - List of users
 */
async function getUserList(requestUserId) {
    try {
        const isAdmin = await isSuperAdmin(requestUserId);
        if (!isAdmin) {
            throw new Error('Permission denied');
        }

        const userResult = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [requestUserId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const tenantId = userResult.rows[0].tenant_id;

        const result = await pool.query(`
            SELECT 
                id,
                name,
                email,
                status
            FROM users
            WHERE tenant_id = $1 AND status = 'active'
            ORDER BY name
        `, [tenantId]);

        return result.rows;
    } catch (error) {
        console.error('Error fetching user list:', error);
        throw error;
    }
}

module.exports = {
    getAnalyticsMetrics,
    getChartData,
    getPhoneAIUsage,
    getUserList
};

/**
 * Fetch campaign message stats (AI vs Human) for a period
 * @private
 */
async function fetchCampaignMessageStats(tenantId, userId, startDate, endDate) {
    const conditions = [
        'm.tenant_id = $1', 
        'm.direction = \'outbound\'',
        'c.is_campaign = true'
    ];
    const params = [tenantId];
    let paramIndex = 2;

    // User filter
    if (userId) {
        conditions.push(`c.owner_id = $${paramIndex}`); // Assuming conversations have owner_id or we link via contact/campaign
        // Actually, messages usually don't have user_id directly linkable easily without join.
        // But for campaigns, the 'sender' is often the system or specific user.
        // For simplicity in this implementation, we might skip detailed user filtering for campaign blasts 
        // unless strictly required, as campaigns are often tenant-wide. 
        // Let's stick to tenant-level for global reports to be safe, or if we need user specificity:
        // conditions.push(`m.user_id = $${paramIndex}`); -- Messages don't always have user_id
        // So we'll ignore userId for campaign stats aggregation to avoid under-counting 
        // (campaign worker sends messages, not necessarily a logged-in user).
    }

    // Date range
    if (startDate) {
        conditions.push(`m.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        conditions.push(`m.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
    }

    const query = `
        SELECT 
            COUNT(CASE WHEN m.role IN ('ai', 'assistant') THEN 1 END) as ai_sent,
            COUNT(CASE WHEN m.role NOT IN ('ai', 'assistant') THEN 1 END) as human_sent
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE ${conditions.join(' AND ')}
    `;

    try {
        const result = await pool.query(query, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error fetching campaign message stats:', error);
        return { ai_sent: 0, human_sent: 0 };
    }
}
