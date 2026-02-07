const { pool } = require('../config/db');
const { canManageAIDeployment } = require('../services/permissionService');

/**
 * Get all AI deployment resources (filtered by user permissions)
 * GET /api/ai/deployments
 */
async function getAIDeployments(req, res) {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;
        const { channel } = req.query;

        // Check if user has ai.configure permission (admin)
        const { checkPermission } = require('../services/permissionService');
        const hasConfigurePermission = await checkPermission(userId, 'ai.configure');

        let query, params;

        if (hasConfigurePermission) {
            // Admin: get all tenant deployments
            query = `
                SELECT 
                    id, tenant_id, channel,
                    email_connection_id, allowed_inbound_email_id,
                    whatsapp_account_id, phone_config_id, widget_config_id,
                    resource_display_name, is_enabled,
                    schedule_enabled, schedule_start_time, schedule_end_time,
                    schedule_days, schedule_timezone,
                    auto_respond, handoff_enabled, max_messages_before_handoff,
                    welcome_message, handoff_message, away_message, priority_mode,
                    created_at, updated_at
                FROM ai_deployment_resources
                WHERE tenant_id = $1
                ${channel ? 'AND channel = $2' : ''}
                ORDER BY channel, resource_display_name
            `;
            params = channel ? [tenantId, channel] : [tenantId];
        } else {
            // Regular user: get only delegated deployments
            query = `
                SELECT 
                    adr.id, adr.tenant_id, adr.channel,
                    adr.email_connection_id, adr.allowed_inbound_email_id,
                    adr.whatsapp_account_id, adr.phone_config_id, adr.widget_config_id,
                    adr.resource_display_name, adr.is_enabled,
                    adr.schedule_enabled, adr.schedule_start_time, adr.schedule_end_time,
                    adr.schedule_days, adr.schedule_timezone,
                    adr.auto_respond, adr.handoff_enabled, adr.max_messages_before_handoff,
                    adr.welcome_message, adr.handoff_message, adr.away_message, adr.priority_mode,
                    adr.created_at, adr.updated_at,
                    uadp.can_view, uadp.can_enable_disable, uadp.can_configure
                FROM user_ai_deployment_permissions uadp
                JOIN ai_deployment_resources adr ON adr.id = uadp.ai_deployment_resource_id
                WHERE uadp.user_id = $1
                ${channel ? 'AND adr.channel = $2' : ''}
                ORDER BY adr.channel, adr.resource_display_name
            `;
            params = channel ? [userId, channel] : [userId];
        }

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        console.error('Error fetching AI deployments:', err);
        res.status(500).json({
            error: 'Failed to fetch AI deployments',
            details: err.message
        });
    }
}

/**
 * Create a new AI deployment resource
 * POST /api/ai/deployments
 */
async function createAIDeployment(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const {
            channel,
            email_connection_id,
            allowed_inbound_email_id,
            whatsapp_account_id,
            phone_config_id,
            widget_config_id,
            resource_display_name,
            is_enabled,
            schedule_enabled,
            schedule_start_time,
            schedule_end_time,
            schedule_days,
            schedule_timezone,
            auto_respond,
            handoff_enabled,
            max_messages_before_handoff,
            welcome_message,
            handoff_message,
            away_message,
            priority_mode
        } = req.body;

        // Validate required fields
        if (!channel) {
            return res.status(400).json({ error: 'Channel is required' });
        }

        // Validate exactly one resource reference
        const resourceRefs = [
            email_connection_id,
            allowed_inbound_email_id,
            whatsapp_account_id,
            phone_config_id,
            widget_config_id
        ].filter(ref => ref != null);

        if (resourceRefs.length !== 1) {
            return res.status(400).json({
                error: 'Exactly one resource reference must be provided'
            });
        }

        const result = await pool.query(`
            INSERT INTO ai_deployment_resources (
                tenant_id, channel,
                email_connection_id, allowed_inbound_email_id,
                whatsapp_account_id, phone_config_id, widget_config_id,
                resource_display_name, is_enabled,
                schedule_enabled, schedule_start_time, schedule_end_time,
                schedule_days, schedule_timezone,
                auto_respond, handoff_enabled, max_messages_before_handoff,
                welcome_message, handoff_message, away_message, priority_mode
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *
        `, [
            tenantId, channel,
            email_connection_id, allowed_inbound_email_id,
            whatsapp_account_id, phone_config_id, widget_config_id,
            resource_display_name, is_enabled ?? false,
            schedule_enabled ?? false, schedule_start_time, schedule_end_time,
            schedule_days, schedule_timezone ?? 'UTC',
            auto_respond ?? true, handoff_enabled ?? true, max_messages_before_handoff ?? 10,
            welcome_message, handoff_message, away_message, priority_mode ?? 'normal'
        ]);

        res.status(201).json({
            success: true,
            message: 'AI deployment created successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error creating AI deployment:', err);
        res.status(500).json({
            error: 'Failed to create AI deployment',
            details: err.message
        });
    }
}

/**
 * Update an AI deployment resource
 * PATCH /api/ai/deployments/:id
 */
async function updateAIDeployment(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Check if user can configure this deployment
        const canConfigure = await canManageAIDeployment(userId, id, 'configure');
        if (!canConfigure) {
            return res.status(403).json({
                error: 'Permission denied',
                message: 'You do not have permission to configure this AI deployment'
            });
        }

        const {
            is_enabled,
            schedule_enabled,
            schedule_start_time,
            schedule_end_time,
            schedule_days,
            schedule_timezone,
            auto_respond,
            handoff_enabled,
            max_messages_before_handoff,
            welcome_message,
            handoff_message,
            away_message,
            priority_mode
        } = req.body;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (is_enabled !== undefined) {
            updates.push(`is_enabled = $${paramCount++}`);
            values.push(is_enabled);
        }
        if (schedule_enabled !== undefined) {
            updates.push(`schedule_enabled = $${paramCount++}`);
            values.push(schedule_enabled);
        }
        if (schedule_start_time !== undefined) {
            updates.push(`schedule_start_time = $${paramCount++}`);
            values.push(schedule_start_time);
        }
        if (schedule_end_time !== undefined) {
            updates.push(`schedule_end_time = $${paramCount++}`);
            values.push(schedule_end_time);
        }
        if (schedule_days !== undefined) {
            updates.push(`schedule_days = $${paramCount++}`);
            values.push(schedule_days);
        }
        if (schedule_timezone !== undefined) {
            updates.push(`schedule_timezone = $${paramCount++}`);
            values.push(schedule_timezone);
        }
        if (auto_respond !== undefined) {
            updates.push(`auto_respond = $${paramCount++}`);
            values.push(auto_respond);
        }
        if (handoff_enabled !== undefined) {
            updates.push(`handoff_enabled = $${paramCount++}`);
            values.push(handoff_enabled);
        }
        if (max_messages_before_handoff !== undefined) {
            updates.push(`max_messages_before_handoff = $${paramCount++}`);
            values.push(max_messages_before_handoff);
        }
        if (welcome_message !== undefined) {
            updates.push(`welcome_message = $${paramCount++}`);
            values.push(welcome_message);
        }
        if (handoff_message !== undefined) {
            updates.push(`handoff_message = $${paramCount++}`);
            values.push(handoff_message);
        }
        if (away_message !== undefined) {
            updates.push(`away_message = $${paramCount++}`);
            values.push(away_message);
        }
        if (priority_mode !== undefined) {
            updates.push(`priority_mode = $${paramCount++}`);
            values.push(priority_mode);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const result = await pool.query(`
            UPDATE ai_deployment_resources
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'AI deployment not found' });
        }

        res.status(200).json({
            success: true,
            message: 'AI deployment updated successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating AI deployment:', err);
        res.status(500).json({
            error: 'Failed to update AI deployment',
            details: err.message
        });
    }
}

/**
 * Delete an AI deployment resource
 * DELETE /api/ai/deployments/:id
 */
async function deleteAIDeployment(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            DELETE FROM ai_deployment_resources
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'AI deployment not found' });
        }

        res.status(200).json({
            success: true,
            message: 'AI deployment deleted successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error deleting AI deployment:', err);
        res.status(500).json({
            error: 'Failed to delete AI deployment',
            details: err.message
        });
    }
}

/**
 * Enable AI on a specific resource
 * POST /api/ai/deployments/:id/enable
 */
async function enableAIDeployment(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if user can enable/disable this deployment
        const canEnableDisable = await canManageAIDeployment(userId, id, 'enable_disable');
        if (!canEnableDisable) {
            return res.status(403).json({
                error: 'Permission denied',
                message: 'You do not have permission to enable/disable this AI deployment'
            });
        }

        const result = await pool.query(`
            UPDATE ai_deployment_resources
            SET is_enabled = true
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'AI deployment not found' });
        }

        res.status(200).json({
            success: true,
            message: 'AI deployment enabled',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error enabling AI deployment:', err);
        res.status(500).json({
            error: 'Failed to enable AI deployment',
            details: err.message
        });
    }
}

/**
 * Disable AI on a specific resource
 * POST /api/ai/deployments/:id/disable
 */
async function disableAIDeployment(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if user can enable/disable this deployment
        const canEnableDisable = await canManageAIDeployment(userId, id, 'enable_disable');
        if (!canEnableDisable) {
            return res.status(403).json({
                error: 'Permission denied',
                message: 'You do not have permission to enable/disable this AI deployment'
            });
        }

        const result = await pool.query(`
            UPDATE ai_deployment_resources
            SET is_enabled = false
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'AI deployment not found' });
        }

        res.status(200).json({
            success: true,
            message: 'AI deployment disabled',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error disabling AI deployment:', err);
        res.status(500).json({
            error: 'Failed to disable AI deployment',
            details: err.message
        });
    }
}

/**
 * UTILITY FUNCTIONS for Lambda/Phone Handler
 * These functions check if AI is enabled for specific resources
 */

/**
 * Check if AI deployment is enabled for a specific inbound email address
 * Used by: lambda_function.js for email processing
 */
async function checkAIEnabledForEmail(tenantId, inboundEmailAddress) {
    try {
        const result = await pool.query(`
            SELECT * FROM check_ai_enabled_for_email($1, $2)
        `, [tenantId, inboundEmailAddress]);

        if (result.rows.length > 0 && result.rows[0].is_ai_enabled) {
            return {
                enabled: true,
                deploymentId: result.rows[0].deployment_id,
                welcomeMessage: result.rows[0].welcome_message,
                handoffMessage: result.rows[0].handoff_message
            };
        }

        return { enabled: false };
    } catch (err) {
        console.error('Error checking AI for email:', err);
        return { enabled: false };
    }
}

/**
 * Check if AI deployment is enabled for a specific phone number
 * Used by: phone webhook handlers for voice call processing
 * Returns BOTH tenant phone feature status AND AI deployment status
 */
async function checkAIEnabledForPhone(tenantId, phoneNumber) {
    try {
        const result = await pool.query(`
            SELECT * FROM check_ai_enabled_for_phone($1, $2)
        `, [tenantId, phoneNumber]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            
            // Must have BOTH phone feature enabled AND AI deployment enabled
            const bothEnabled = row.is_phone_feature_enabled && row.is_ai_enabled;

            return {
                phoneFeatureEnabled: row.is_phone_feature_enabled,
                aiDeploymentEnabled: row.is_ai_enabled,
                enabled: bothEnabled,  // true only if BOTH are true
                deploymentId: row.deployment_id,
                welcomeMessage: row.welcome_message,
                agentInstructions: row.agent_instructions
            };
        }

        return { 
            phoneFeatureEnabled: false,
            aiDeploymentEnabled: false,
            enabled: false 
        };
    } catch (err) {
        console.error('Error checking AI for phone:', err);
        return { 
            phoneFeatureEnabled: false,
            aiDeploymentEnabled: false,
            enabled: false 
        };
    }
}

module.exports = {
    getAIDeployments,
    createAIDeployment,
    updateAIDeployment,
    deleteAIDeployment,
    enableAIDeployment,
    disableAIDeployment,
    // Export utility functions for use in lambda/phone handlers
    checkAIEnabledForEmail,
    checkAIEnabledForPhone
};
