const { pool } = require('../config/db');

/**
 * Grant AI deployment permission to a user
 * POST /api/admin/users/:userId/ai-deployments
 */
async function grantAIDeploymentPermission(req, res) {
    try {
        const { userId } = req.params;
        const {
            ai_deployment_resource_id,
            can_view,
            can_enable_disable,
            can_configure
        } = req.body;
        const grantedBy = req.user.id;

        // Validate input
        if (!ai_deployment_resource_id) {
            return res.status(400).json({
                error: 'Missing required field: ai_deployment_resource_id'
            });
        }

        // Verify AI deployment resource exists
        const resourceResult = await pool.query(`
            SELECT id FROM ai_deployment_resources WHERE id = $1
        `, [ai_deployment_resource_id]);

        if (resourceResult.rows.length === 0) {
            return res.status(404).json({
                error: 'AI deployment resource not found'
            });
        }

        // Upsert delegation permission
        const result = await pool.query(`
            INSERT INTO user_ai_deployment_permissions (
                user_id, ai_deployment_resource_id,
                can_view, can_enable_disable, can_configure,
                granted_by
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, ai_deployment_resource_id)
            DO UPDATE SET
                can_view = $3,
                can_enable_disable = $4,
                can_configure = $5,
                granted_by = $6,
                granted_at = now()
            RETURNING *
        `, [
            userId,
            ai_deployment_resource_id,
            can_view ?? true,
            can_enable_disable ?? false,
            can_configure ?? false,
            grantedBy
        ]);

        res.status(200).json({
            success: true,
            message: 'AI deployment permission granted',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error granting AI deployment permission:', err);
        res.status(500).json({
            error: 'Failed to grant AI deployment permission',
            details: err.message
        });
    }
}

/**
 * Revoke AI deployment permission from a user
 * DELETE /api/admin/users/:userId/ai-deployments/:resourceId
 */
async function revokeAIDeploymentPermission(req, res) {
    try {
        const { userId, resourceId } = req.params;

        const result = await pool.query(`
            DELETE FROM user_ai_deployment_permissions
            WHERE user_id = $1 AND ai_deployment_resource_id = $2
            RETURNING *
        `, [userId, resourceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'AI deployment permission not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'AI deployment permission revoked',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error revoking AI deployment permission:', err);
        res.status(500).json({
            error: 'Failed to revoke AI deployment permission',
            details: err.message
        });
    }
}

/**
 * Get all AI deployment permissions for a user
 * GET /api/admin/users/:userId/ai-deployments
 */
async function getUserAIDeploymentPermissions(req, res) {
    try {
        const { userId } = req.params;

        // First check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_ai_deployment_permissions'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            // Table doesn't exist yet, return empty array
            return res.status(200).json([]);
        }

        const result = await pool.query(`
            SELECT 
                uadp.*,
                adr.channel,
                adr.resource_display_name,
                adr.is_enabled,
                u.email as granted_by_email
            FROM user_ai_deployment_permissions uadp
            JOIN ai_deployment_resources adr ON adr.id = uadp.ai_deployment_resource_id
            LEFT JOIN users u ON u.id = uadp.granted_by
            WHERE uadp.user_id = $1
            ORDER BY adr.channel, adr.resource_display_name
        `, [userId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching user AI deployment permissions:', err);
        // Return empty array instead of error for missing table
        res.status(200).json([]);
    }
}

/**
 * Get current user's AI deployment permissions
 * GET /api/users/me/ai-deployments
 */
async function getMyAIDeployments(req, res) {
    try {
        const userId = req.user.id;
        const { getUserAIDeployments } = require('../services/permissionService');

        const deployments = await getUserAIDeployments(userId);

        res.status(200).json({
            success: true,
            data: deployments,
            count: deployments.length
        });
    } catch (err) {
        console.error('Error fetching user AI deployments:', err);
        res.status(500).json({
            error: 'Failed to fetch AI deployments',
            details: err.message
        });
    }
}

module.exports = {
    grantAIDeploymentPermission,
    revokeAIDeploymentPermission,
    getUserAIDeploymentPermissions,
    getMyAIDeployments
};
