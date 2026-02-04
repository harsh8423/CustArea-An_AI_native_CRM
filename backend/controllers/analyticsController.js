const analyticsService = require('../services/analyticsService');

/**
 * Get analytics metrics
 * GET /api/analytics/metrics
 * Query params: targetUserId, timeRange, category, startDate, endDate
 */
async function getMetrics(req, res) {
    try {
        const {
            userId: targetUserId,
            timeRange = 'daily',
            category = 'all',
            startDate,
            endDate
        } = req.query;

        const metrics = await analyticsService.getAnalyticsMetrics(req.user.id, {
            targetUserId,
            timeRange,
            category,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null
        });

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error in getMetrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics metrics',
            message: error.message
        });
    }
}

/**
 * Get chart-specific data
 * GET /api/analytics/charts/:chartType
 * Chart types: email-ai-vs-human, phone-duration, campaign-performance, crm-overview, ticket-status
 */
async function getChartData(req, res) {
    try {
        const { chartType } = req.params;
        const {
            userId: targetUserId,
            timeRange = 'daily',
            category = 'all',
            startDate,
            endDate
        } = req.query;

        const data = await analyticsService.getChartData(req.user.id, chartType, {
            targetUserId,
            timeRange,
            category,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null
        });

        res.json({
            success: true,
            chartType,
            data
        });
    } catch (error) {
        console.error('Error in getChartData:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chart data',
            message: error.message
        });
    }
}

/**
 * Get phone AI usage data
 * GET /api/analytics/phone-ai-usage
 */
async function getPhoneAIUsage(req, res) {
    try {
        const {
            userId: targetUserId,
            startDate,
            endDate
        } = req.query;

        const data = await analyticsService.getPhoneAIUsage(req.user.id, {
            targetUserId,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null
        });

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in getPhoneAIUsage:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch phone AI usage',
            message: error.message
        });
    }
}

/**
 * Get user list (super admin only)
 * GET /api/analytics/users
 */
async function getUserList(req, res) {
    try {
        const users = await analyticsService.getUserList(req.user.id);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error in getUserList:', error);
        res.status(error.message === 'Permission denied' ? 403 : 500).json({
            success: false,
            error: error.message === 'Permission denied' ? 'Permission denied' : 'Failed to fetch users',
            message: error.message
        });
    }
}

/**
 * Export analytics data
 * GET /api/analytics/export
 * Query params: format (csv|json), same filters as getMetrics
 */
async function exportAnalytics(req, res) {
    try {
        const {
            format = 'csv',
            userId: targetUserId,
            timeRange = 'daily',
            category = 'all',
            startDate,
            endDate
        } = req.query;

        const metrics = await analyticsService.getAnalyticsMetrics(req.user.id, {
            targetUserId,
            timeRange,
            category,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null
        });

        if (format === 'csv') {
            // Convert to CSV
            const csv = convertToCSV(metrics.timeSeriesData);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=analytics-${Date.now()}.csv`);
            res.send(csv);
        } else {
            // Return JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=analytics-${Date.now()}.json`);
            res.json(metrics);
        }
    } catch (error) {
        console.error('Error in exportAnalytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export analytics',
            message: error.message
        });
    }
}

/**
 * Helper function to convert data to CSV
 */
function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
        Object.values(row).map(val => 
            typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
    );

    return [headers, ...rows].join('\n');
}

module.exports = {
    getMetrics,
    getChartData,
    getPhoneAIUsage,
    getUserList,
    exportAnalytics
};
