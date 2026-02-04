const { pool } = require('../config/db');
const { isSuperAdmin } = require('./permissionService');

/**
 * Activity Log Service
 * Handles creating and retrieving activity logs with role-based access control
 */

/**
 * Log a user activity
 * @param {Object} params - Activity details
 * @returns {Promise<string>} - Created log ID
 */
async function logActivity({
    userId,
    tenantId,
    actionCategory,
    actionType,
    actionDescription,
    resourceType = null,
    resourceId = null,
    resourceName = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null
}) {
    try {
        const result = await pool.query(`
            SELECT log_user_activity(
                $1::uuid, $2::uuid, $3::text, $4::text, $5::text,
                $6::text, $7::uuid, $8::text, $9::jsonb, $10::jsonb
            ) as log_id
        `, [
            tenantId, userId, actionCategory, actionType, actionDescription,
            resourceType, resourceId, resourceName, 
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null
        ]);

        return result.rows[0].log_id;
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error;
    }
}

/**
 * Get activity logs with filtering and pagination
 * Respects user permissions (super_admin sees all, users see their own)
 * @param {string} requestUserId - User making the request
 * @param {Object} filters - { targetUserId, category, timeRange, page, limit }
 * @returns {Promise<Object>} - { logs, total, page, limit }
 */
async function getActivityLogs(requestUserId, {
    targetUserId = null,
    category = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 50
}) {
    try {
        // Check if requester is super admin
        const isAdmin = await isSuperAdmin(requestUserId);

        // Build WHERE conditions
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Get tenant from requesting user
        const userResult = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [requestUserId]);
        if (userResult.rows.length === 0) {
            return { logs: [], total: 0, page, limit };
        }
        const tenantId = userResult.rows[0].tenant_id;

        // Always filter by tenant
        conditions.push(`al.tenant_id = $${paramIndex}`);
        params.push(tenantId);
        paramIndex++;

        // Role-based user filtering
        if (!isAdmin) {
            // Regular users only see their own logs
            conditions.push(`al.user_id = $${paramIndex}`);
            params.push(requestUserId);
            paramIndex++;
        } else if (targetUserId) {
            // Super admin can filter by specific user
            conditions.push(`al.user_id = $${paramIndex}`);
            params.push(targetUserId);
            paramIndex++;
        }

        // Category filter
        if (category && category !== 'all') {
            conditions.push(`al.action_category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
        }

        // Date range filter
        if (startDate) {
            conditions.push(`al.created_at >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            conditions.push(`al.created_at <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM activity_logs al
            ${whereClause}
        `, params);
        const total = parseInt(countResult.rows[0].total);

        // Get paginated logs
        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const logsResult = await pool.query(`
            SELECT 
                al.id,
                al.user_id,
                u.name as user_name,
                u.email as user_email,
                al.action_category,
                al.action_type,
                al.action_description,
                al.resource_type,
                al.resource_id,
                al.resource_name,
                al.old_values,
                al.new_values,
                al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.user_id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, params);

        return {
            logs: logsResult.rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
}

/**
 * Convenience methods for logging specific activities
 */

async function logEmailSent({ userId, tenantId, messageId, sentBy, recipientEmail }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'email',
        actionType: 'sent',
        actionDescription: `Email sent ${sentBy === 'ai' ? 'by AI' : 'manually'} to ${recipientEmail}`,
        resourceType: 'message',
        resourceId: messageId,
        resourceName: recipientEmail
    });
}

async function logCallMade({ userId, tenantId, callId, handledBy, phoneNumber, duration }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'phone',
        actionType: 'completed',
        actionDescription: `Call ${handledBy === 'ai' ? 'handled by AI' : 'made manually'} to ${phoneNumber} (${duration}s)`,
        resourceType: 'phone_call',
        resourceId: callId,
        resourceName: phoneNumber
    });
}

async function logCampaignAction({ userId, tenantId, campaignId, campaignName, action }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'campaign',
        actionType: action,
        actionDescription: `Campaign "${campaignName}" ${action}`,
        resourceType: 'campaign',
        resourceId: campaignId,
        resourceName: campaignName
    });
}

async function logContactAction({ userId, tenantId, contactId, contactName, action, count = null }) {
    const description = count 
        ? `${count} contacts ${action}`
        : `Contact "${contactName}" ${action}`;
    
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'contact',
        actionType: action,
        actionDescription: description,
        resourceType: 'contact',
        resourceId: contactId,
        resourceName: contactName
    });
}

async function logLeadAction({ userId, tenantId, leadId, leadName, action, oldValues = null, newValues = null }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'lead',
        actionType: action,
        actionDescription: `Lead "${leadName}" ${action}`,
        resourceType: 'lead',
        resourceId: leadId,
        resourceName: leadName,
        oldValues,
        newValues
    });
}

async function logTicketAction({ userId, tenantId, ticketId, ticketNumber, action }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'ticket',
        actionType: action,
        actionDescription: `Ticket #${ticketNumber} ${action}`,
        resourceType: 'ticket',
        resourceId: ticketId,
        resourceName: `#${ticketNumber}`
    });
}

async function logSettingsChange({ userId, tenantId, settingType, description }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'settings',
        actionType: 'updated',
        actionDescription: description,
        resourceType: settingType
    });
}

async function logUserManagement({ userId, tenantId, targetUserId, targetUserName, action }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'user_management',
        actionType: action,
        actionDescription: `User "${targetUserName}" ${action}`,
        resourceType: 'user',
        resourceId: targetUserId,
        resourceName: targetUserName
    });
}

async function logImport({ userId, tenantId, importType, count, importId }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'import',
        actionType: 'completed',
        actionDescription: `Imported ${count} ${importType}`,
        resourceType: importType,
        resourceId: importId,
        resourceName: `${count} items`
    });
}

async function logGroupAction({ userId, tenantId, groupId, groupName, action }) {
    return logActivity({
        userId,
        tenantId,
        actionCategory: 'group',
        actionType: action,
        actionDescription: `Group "${groupName}" ${action}`,
        resourceType: 'contact_group',
        resourceId: groupId,
        resourceName: groupName
    });
}

module.exports = {
    logActivity,
    getActivityLogs,
    // Convenience methods
    logEmailSent,
    logCallMade,
    logCampaignAction,
    logContactAction,
    logLeadAction,
    logTicketAction,
    logSettingsChange,
    logUserManagement,
    logImport,
    logGroupAction
};
