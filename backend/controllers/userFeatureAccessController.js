const { pool } = require('../config/db');

/**
 * Grant feature access to a user (admin-only)
 * POST /api/admin/users/:userId/features
 */
async function grantFeatureAccess(req, res) {
    try {
        const { userId } = req.params;
        const { featureKey, isEnabled } = req.body;
        const grantedBy = req.user.id;

        console.log('[grantFeatureAccess] Request:', { userId, featureKey, isEnabled, grantedBy });

        // Validate input
        if (!featureKey || typeof isEnabled !== 'boolean') {
            return res.status(400).json({
                error: 'Missing required fields: featureKey, isEnabled'
            });
        }

        // Check if user_feature_access table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_feature_access'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            return res.status(503).json({
                error: 'Feature unavailable',
                message: 'Per-user feature control requires database migration. Please run migration 011_per_user_integrations_ai_deployment.sql'
            });
        }

        // Check if feature exists
        const featureResult = await pool.query(`
            SELECT id FROM features WHERE feature_key = $1
        `, [featureKey]);

        if (featureResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Feature not found',
                feature_key: featureKey
            });
        }

        const featureId = featureResult.rows[0].id;

        // Upsert user feature access
        const result = await pool.query(`
            INSERT INTO user_feature_access (user_id, feature_id, feature_key, is_enabled, granted_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, feature_id)
            DO UPDATE SET
                is_enabled = $4,
                granted_by = $5,
                granted_at = now()
            RETURNING *
        `, [userId, featureId, featureKey, isEnabled, grantedBy]);

        res.status(200).json({
            success: true,
            message: `Feature access ${isEnabled ? 'granted' : 'revoked'}`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error granting feature access:', err);
        res.status(500).json({
            error: 'Failed to grant feature access',
            details: err.message
        });
    }
}

/**
 * Revoke feature access from a user (admin-only)
 * DELETE /api/admin/users/:userId/features/:featureId
 */
async function revokeFeatureAccess(req, res) {
    try {
        const { userId, featureId } = req.params;

        const result = await pool.query(`
            DELETE FROM user_feature_access
            WHERE user_id = $1 AND feature_id = $2
            RETURNING *
        `, [userId, featureId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Feature access override not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Feature access override removed',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error revoking feature access:', err);
        res.status(500).json({
            error: 'Failed to revoke feature access',
            details: err.message
        });
    }
}

/**
 * Get all feature access overrides for a user (admin-only)
 * GET /api/admin/users/:userId/features
 */
async function getUserFeatureOverrides(req, res) {
    try {
        const { userId } = req.params;

        const result = await pool.query(`
            SELECT 
                ufa.*,
                f.display_name as feature_display_name,
                f.description as feature_description,
                u.email as granted_by_email
            FROM user_feature_access ufa
            JOIN features f ON f.id = ufa.feature_id
            LEFT JOIN users u ON u.id = ufa.granted_by
            WHERE ufa.user_id = $1
            ORDER BY ufa.granted_at DESC
        `, [userId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching user feature overrides:', err);
        res.status(500).json({
            error: 'Failed to fetch feature overrides',
            details: err.message
        });
    }
}

/**
 * Get current user's accessible features (with override status)
 * GET /api/users/me/features
 */
async function getMyFeatures(req, res) {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;

        // Get all features with tenant and user-level status
        const result = await pool.query(`
            SELECT 
                f.id,
                f.feature_key,
                f.display_name,
                f.description,
                tf.is_enabled as tenant_enabled,
                ufa.is_enabled as user_override,
                CASE
                    WHEN ufa.is_enabled IS NOT NULL THEN ufa.is_enabled
                    ELSE COALESCE(tf.is_enabled, f.is_default)
                END as has_access
            FROM features f
            LEFT JOIN tenant_features tf ON tf.feature_id = f.id AND tf.tenant_id = $1
            LEFT JOIN user_feature_access ufa ON ufa.feature_id = f.id AND ufa.user_id = $2
            ORDER BY f.display_name
        `, [tenantId, userId]);

        const accessibleFeatures = result.rows
            .filter(row => row.has_access === true)
            .map(row => row.feature_key);

        console.log(`[getMyFeatures] User ${userId} features:`, accessibleFeatures);

        res.json({ features: accessibleFeatures });
    } catch (err) {
        console.error('Error fetching user features:', err);
        res.status(500).json({
            error: 'Failed to fetch features',
            details: err.message
        });
    }
}

module.exports = {
    grantFeatureAccess,
    revokeFeatureAccess,
    getUserFeatureOverrides,
    getMyFeatures
};
