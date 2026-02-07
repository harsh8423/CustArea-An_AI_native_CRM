/**
 * AI Agent Decision Service
 * Determines if AI should respond based on resource-specific deployments
 */

const { pool } = require('../config/db');

/**
 * Check if AI should respond for a specific resource
 * @param {string} tenantId - Tenant ID
 * @param {string} channel - Channel type (email, whatsapp, phone, widget)
 * @param {string} resourceId - Specific resource ID (email_connection_id, phone_config_id, etc.)
 * @param {string} resourceType - Type of resource (email_connection_id, allowed_inbound_email_id, whatsapp_account_id, phone_config_id, widget_config_id)
 * @returns {Promise<{ shouldRespond: boolean, deployment: object | null, reason: string }>}
 */
async function shouldAgentRespond(tenantId, channel, resourceId, resourceType = null) {
    try {
        // PHONE CHANNEL: Check tenant-level phone feature first
        if (channel === 'phone') {
            const phoneFeatureCheck = await pool.query(`
                SELECT is_phone_enabled FROM tenant_phone_config 
                WHERE tenant_id = $1 AND id = $2
            `, [tenantId, resourceId]);

            if (phoneFeatureCheck.rows.length === 0 || !phoneFeatureCheck.rows[0].is_phone_enabled) {
                return {
                    shouldRespond: false,
                    deployment: null,
                    reason: 'Phone feature is disabled at tenant level'
                };
            }
        }

        // Auto-detect resource type if not provided
        if (!resourceType) {
            resourceType = detectResourceType(channel);
        }

        // Query for resource-specific deployment
        const query = `
            SELECT * FROM ai_deployment_resources 
            WHERE tenant_id = $1 
            AND channel = $2
            AND ${resourceType} = $3
        `;
        
        const result = await pool.query(query, [tenantId, channel, resourceId]);

        if (result.rows.length === 0) {
            return {
                shouldRespond: false,
                deployment: null,
                reason: 'No AI deployment configured for this resource'
            };
        }

        const deployment = result.rows[0];

        // Check if deployment is enabled
        if (!deployment.is_enabled) {
            return {
                shouldRespond: false,
                deployment,
                reason: 'AI is disabled for this resource'
            };
        }

        // Apply priority mode logic
        const priorityResult = evaluatePriorityMode(deployment);
        if (!priorityResult.shouldRespond) {
            return priorityResult;
        }

        // Check schedule if enabled
        if (deployment.schedule_enabled) {
            const scheduleResult = evaluateSchedule(deployment);
            if (!scheduleResult.shouldRespond) {
                return scheduleResult;
            }
        }

        // All checks passed
        return {
            shouldRespond: true,
            deployment,
            reason: 'AI is active for this resource'
        };
    } catch (error) {
        console.error('Error checking AI decision:', error);
        return {
            shouldRespond: false,
            deployment: null,
            reason: `Error: ${error.message}`
        };
    }
}

/**
 * Evaluate priority mode logic
 */
function evaluatePriorityMode(deployment) {
    const { priority_mode } = deployment;

    switch (priority_mode) {
        case 'always_ai':
            return {
                shouldRespond: true,
                deployment,
                reason: 'Priority mode: Always AI'
            };
        
        case 'always_human':
            return {
                shouldRespond: false,
                deployment,
                reason: 'Priority mode: Always Human'
            };
        
        case 'schedule':
            // Will be evaluated by schedule check
            if (!deployment.schedule_enabled) {
                return {
                    shouldRespond: false,
                    deployment,
                    reason: 'Priority mode is schedule but schedule is disabled'
                };
            }
            return { shouldRespond: true, deployment, reason: 'Continue to schedule check' };
        
        case 'normal':
        default:
            // Normal mode: AI during schedule, human otherwise
            return { shouldRespond: true, deployment, reason: 'Continue with normal flow' };
    }
}

/**
 * Evaluate schedule - check if current time is within configured schedule
 */
function evaluateSchedule(deployment) {
    try {
        const { 
            schedule_start_time, 
            schedule_end_time, 
            schedule_days, 
            schedule_timezone 
        } = deployment;

        if (!schedule_start_time || !schedule_end_time) {
            return {
                shouldRespond: true,
                deployment,
                reason: 'Schedule not properly configured, allowing response'
            };
        }

        const now = new Date();
        const timezone = schedule_timezone || 'UTC';

        // Get current time in configured timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const currentTime = formatter.format(now).replace(':', '').padStart(4, '0');
        
        // Get current day
        const dayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'long'
        });
        const currentDay = dayFormatter.format(now);

        // Check if current day is in schedule
        if (schedule_days && !schedule_days.includes(currentDay)) {
            return {
                shouldRespond: false,
                deployment,
                reason: `Outside schedule: ${currentDay} not in active days`
            };
        }

        // Parse times (format: "09:00" -> "0900")
        const startTime = schedule_start_time.replace(':', '').padStart(4, '0');
        const endTime = schedule_end_time.replace(':', '').padStart(4, '0');

        // Handle overnight schedules (e.g., 18:00 to 06:00)
        let isWithinSchedule;
        if (startTime > endTime) {
            // Overnight: respond if current >= start OR current <= end
            isWithinSchedule = currentTime >= startTime || currentTime <= endTime;
        } else {
            // Same day: respond if current is between start and end
            isWithinSchedule = currentTime >= startTime && currentTime <= endTime;
        }

        if (deployment.priority_mode === 'schedule') {
            // Schedule mode: only respond during schedule
            return {
                shouldRespond: isWithinSchedule,
                deployment,
                reason: isWithinSchedule 
                    ? 'Within scheduled hours' 
                    : `Outside scheduled hours (${schedule_start_time}-${schedule_end_time})`
            };
        } else {
            // Normal mode: respond during schedule, send away message outside
            if (!isWithinSchedule && deployment.away_message) {
                return {
                    shouldRespond: false,
                    deployment,
                    reason: 'Outside scheduled hours, away message available',
                    sendAwayMessage: true
                };
            }
            return {
                shouldRespond: isWithinSchedule,
                deployment,
                reason: isWithinSchedule ? 'Within scheduled hours' : 'Outside scheduled hours'
            };
        }
    } catch (error) {
        console.error('Error evaluating schedule:', error);
        return {
            shouldRespond: true,
            deployment,
            reason: `Schedule evaluation error: ${error.message}`
        };
    }
}

/**
 * Auto-detect resource type based on channel
 */
function detectResourceType(channel) {
    const map = {
        'email': 'allowed_inbound_email_id',
        'whatsapp': 'whatsapp_account_id',
        'phone': 'phone_config_id',
        'widget': 'widget_config_id'
    };
    return map[channel] || 'email_connection_id';
}

/**
 * Get AI deployment for a specific resource
 * Used by conversation handlers to fetch configuration
 */
async function getAIDeploymentForResource(tenantId, channel, resourceId, resourceType = null) {
    try {
        if (!resourceType) {
            resourceType = detectResourceType(channel);
        }

        const query = `
            SELECT * FROM ai_deployment_resources 
            WHERE tenant_id = $1 
            AND channel = $2
            AND ${resourceType} = $3
        `;
        
        const result = await pool.query(query, [tenantId, channel, resourceId]);
        
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error fetching AI deployment:', error);
        return null;
    }
}

module.exports = {
    shouldAgentRespond,
    getAIDeploymentForResource,
    evaluatePriorityMode,
    evaluateSchedule
};
