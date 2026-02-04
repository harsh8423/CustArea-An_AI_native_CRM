const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const activityLogsController = require('../controllers/activityLogsController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// All analytics routes require authentication and reports.view permission
router.use(authMiddleware);
router.use(requirePermission('reports.view'));

// =====================================
// Analytics Metrics Routes
// =====================================

/**
 * GET /api/analytics/metrics
 * Get analytics metrics with filtering
 * Query params:
 *   - userId: Target user ID (super_admin only)
 *   - timeRange: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 *   - category: 'all' | 'email' | 'phone' | 'campaign' | etc. (default: 'all')
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
router.get('/metrics', analyticsController.getMetrics);

/**
 * GET /api/analytics/charts/:chartType
 * Get formatted data for specific chart types
 * Chart types:
 *   - email-ai-vs-human: Email activity (AI vs Human)
 *   - phone-duration: Phone call durations
 *   - campaign-performance: Campaign metrics
 *   - crm-overview: Leads and contacts
 *   - ticket-status: Ticket metrics
 * Same query params as /metrics
 */
router.get('/charts/:chartType', analyticsController.getChartData);

/**
 * GET /api/analytics/phone-ai-usage
 * Get phone call AI model usage and costs
 * Query params:
 *   - userId: Target user ID (super_admin only)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
router.get('/phone-ai-usage', analyticsController.getPhoneAIUsage);

/**
 * GET /api/analytics/users
 * Get list of users for filtering (super_admin only)
 */
router.get('/users', analyticsController.getUserList);

/**
 * GET /api/analytics/export
 * Export analytics data
 * Query params:
 *   - format: 'csv' | 'json' (default: 'csv')
 *   - Plus all filters from /metrics
 */
router.get('/export', analyticsController.exportAnalytics);

// =====================================
// Activity Logs Routes
// =====================================

/**
 * GET /api/analytics/activity-logs
 * Get activity logs with pagination
 * Query params:
 *   - userId: Target user ID (super_admin only)
 *   - category: Filter by action category
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50)
 */
router.get('/activity-logs', activityLogsController.getActivityLogs);

/**
 * POST /api/analytics/activity-logs
 * Manually create an activity log entry
 * Body:
 *   - actionCategory: string (required)
 *   - actionType: string (required)
 *   - actionDescription: string (required)
 *   - resourceType: string (optional)
 *   - resourceId: uuid (optional)
 *   - resourceName: string (optional)
 *   - oldValues: jsonb (optional)
 *   - newValues: jsonb (optional)
 */
router.post('/activity-logs', activityLogsController.createActivityLog);

module.exports = router;
