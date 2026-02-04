const activityLogService = require('../services/activityLogService');

/**
 * Get activity logs
 * GET /api/activity-logs
 * Query params: userId, category, startDate, endDate, page, limit
 */
async function getActivityLogs(req, res) {
    try {
        const {
            userId: targetUserId,
            category,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const result = await activityLogService.getActivityLogs(req.user.id, {
            targetUserId,
            category,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error in getActivityLogs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity logs',
            message: error.message
        });
    }
}

/**
 * Create activity log (for manual logging from service layer)
 * POST /api/activity-logs
 * Body: { actionCategory, actionType, actionDescription, resourceType, resourceId, resourceName }
 */
async function createActivityLog(req, res) {
    try {
        const {
            actionCategory,
            actionType,
            actionDescription,
            resourceType,
            resourceId,
            resourceName,
            oldValues,
            newValues
        } = req.body;

        // Get user's tenant
        const { pool } = require('../config/db');
        const userResult = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const logId = await activityLogService.logActivity({
            userId: req.user.id,
            tenantId: userResult.rows[0].tenant_id,
            actionCategory,
            actionType,
            actionDescription,
            resourceType,
            resourceId,
            resourceName,
            oldValues,
            newValues,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            data: { id: logId }
        });
    } catch (error) {
        console.error('Error in createActivityLog:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create activity log',
            message: error.message
        });
    }
}

module.exports = {
    getActivityLogs,
    createActivityLog
};
