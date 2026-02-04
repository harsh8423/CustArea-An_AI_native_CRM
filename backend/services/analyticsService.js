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

    // User filter
    if (userId !== null) {
        conditions.push(`user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    } else {
        conditions.push('user_id IS NULL');
    }

    // Time range filter
    conditions.push(`metric_period = $${paramIndex}`);
    params.push(timeRange);
    paramIndex++;

    // Date range filter based on time range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let queryStartDate, queryEndDate;
    
    if (timeRange === 'daily') {
        // For daily, use provided date range or last 30 days
        if (!startDate && !endDate) {
            queryStartDate = new Date(today);
            queryStartDate.setDate(queryStartDate.getDate() - 30);
            queryEndDate = today;
        } else {
            queryStartDate = startDate ? new Date(startDate) : null;
            queryEndDate = endDate ? new Date(endDate) : today;
        }
    } else if (timeRange === 'weekly') {
        // For weekly, get start of current week (Sunday) and end (Saturday)
        const dayOfWeek = today.getDay();
        queryStartDate = new Date(today);
        queryStartDate.setDate(today.getDate() - dayOfWeek); // Start of week (Sunday)
        queryEndDate = new Date(queryStartDate);
        queryEndDate.setDate(queryStartDate.getDate() + 6); // End of week (Saturday)
    } else if (timeRange === 'monthly') {
        // For monthly, get start and end of current month  
        queryStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
        queryEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
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
    // CRITICAL: Only sum user-specific rows to avoid double-counting
    // (increment function creates both user_id and NULL rows)
    const result = await pool.query(`
        SELECT 
            metric_date,
            metric_period,
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
        GROUP BY metric_date, metric_period
        ORDER BY metric_date DESC
    `, params);

    // Calculate totals and format data
    const timeSeriesData = result.rows;
    const totals = calculateTotals(result.rows);
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
    if (category === 'all') {
        return {
            email: sumCategoryMetrics(rows, ['emails_sent_total', 'emails_received']),
            phone: sumCategoryMetrics(rows, ['calls_total', 'calls_duration_seconds']),
            campaign: sumCategoryMetrics(rows, ['campaigns_created', 'campaign_emails_sent']),
            crm: sumCategoryMetrics(rows, ['leads_created', 'contacts_created']),
            ticket: sumCategoryMetrics(rows, ['tickets_created', 'tickets_resolved'])
        };
    }

    // Return specific category data
    return null;
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
