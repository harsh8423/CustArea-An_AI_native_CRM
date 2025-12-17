/**
 * AI Agent Deployment Controller
 * Handles deployment configurations per channel
 */

const { pool } = require('../config/db');

/**
 * Get all deployment configurations for tenant
 */
async function getDeployments(req, res) {
    try {
        const tenantId = req.user.tenantId;

        const result = await pool.query(
            `SELECT * FROM ai_agent_deployments WHERE tenant_id = $1`,
            [tenantId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting deployments:', error);
        res.status(500).json({ error: 'Failed to get deployments' });
    }
}

/**
 * Update deployment configuration for a channel
 */
async function updateDeployment(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { channel } = req.params;
        const {
            is_enabled,
            schedule_enabled,
            schedule_start_time,
            schedule_end_time,
            schedule_days,
            schedule_timezone,
            auto_respond,
            handoff_enabled,
            welcome_message,
            handoff_message
        } = req.body;

        // Upsert the deployment config
        const result = await pool.query(
            `INSERT INTO ai_agent_deployments (
                tenant_id, channel, is_enabled, schedule_enabled,
                schedule_start_time, schedule_end_time, schedule_days, schedule_timezone,
                auto_respond, handoff_enabled, welcome_message, handoff_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (tenant_id, channel) 
            DO UPDATE SET
                is_enabled = EXCLUDED.is_enabled,
                schedule_enabled = EXCLUDED.schedule_enabled,
                schedule_start_time = EXCLUDED.schedule_start_time,
                schedule_end_time = EXCLUDED.schedule_end_time,
                schedule_days = EXCLUDED.schedule_days,
                schedule_timezone = EXCLUDED.schedule_timezone,
                auto_respond = EXCLUDED.auto_respond,
                handoff_enabled = EXCLUDED.handoff_enabled,
                welcome_message = EXCLUDED.welcome_message,
                handoff_message = EXCLUDED.handoff_message,
                updated_at = now()
            RETURNING *`,
            [
                tenantId, channel, is_enabled, schedule_enabled,
                schedule_start_time, schedule_end_time, schedule_days, schedule_timezone,
                auto_respond, handoff_enabled, welcome_message, handoff_message
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating deployment:', error);
        res.status(500).json({ error: 'Failed to update deployment' });
    }
}

/**
 * Check if AI agent should respond for a given channel at the current time
 * This is used by the message processing pipeline
 */
async function shouldAgentRespond(tenantId, channel) {
    try {
        const result = await pool.query(
            `SELECT * FROM ai_agent_deployments WHERE tenant_id = $1 AND channel = $2`,
            [tenantId, channel]
        );

        if (result.rows.length === 0) {
            return false; // No config = AI disabled
        }

        const config = result.rows[0];

        // If not enabled, return false
        if (!config.is_enabled) {
            return false;
        }

        // If schedule is not enabled, always respond
        if (!config.schedule_enabled) {
            return true;
        }

        // Check schedule
        const now = new Date();
        const timezone = config.schedule_timezone || 'UTC';
        
        // Get current time in the configured timezone
        const currentTime = now.toLocaleString('en-US', { 
            timeZone: timezone, 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        const currentDay = now.toLocaleString('en-US', { 
            timeZone: timezone, 
            weekday: 'long' 
        }).toLowerCase();

        // Check if current day is active
        if (!config.schedule_days?.includes(currentDay)) {
            return false;
        }

        // Parse times
        const startTime = config.schedule_start_time;
        const endTime = config.schedule_end_time;

        // Handle overnight schedules (e.g., 18:00 to 06:00)
        if (startTime > endTime) {
            // Overnight: respond if current time >= start OR current time <= end
            return currentTime >= startTime || currentTime <= endTime;
        } else {
            // Same day: respond if current time is between start and end
            return currentTime >= startTime && currentTime <= endTime;
        }
    } catch (error) {
        console.error('Error checking agent schedule:', error);
        return false;
    }
}

module.exports = {
    getDeployments,
    updateDeployment,
    shouldAgentRespond
};
