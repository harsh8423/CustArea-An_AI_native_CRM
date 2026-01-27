const { pool } = require('../config/db');

/**
 * GET /api/features
 * Get all available features
 */
exports.getAllFeatures = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                feature_key,
                display_name,
                description,
                icon,
                category,
                is_default,
                sort_order
            FROM features
            ORDER BY sort_order
        `);

        res.json({ 
            features: result.rows 
        });
    } catch (err) {
        console.error('Get features error:', err);
        res.status(500).json({ 
            error: 'Failed to fetch features',
            details: err.message 
        });
    }
};

/**
 * GET /api/features/tenant
 * Get tenant's enabled features
 */
exports.getTenantFeatures = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT 
                f.feature_key,
                f.display_name,
                f.description,
                f.icon,
                f.category,
                tf.is_enabled,
                tf.enabled_at,
                tf.disabled_at
            FROM features f
            LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = $1::uuid
            ORDER BY f.sort_order
        `, [tenantId]);

        // Return list of enabled feature keys for easy checking
        const enabledFeatures = result.rows
            .filter(f => f.is_enabled)
            .map(f => f.feature_key);

        res.json({ 
            features: enabledFeatures,
            details: result.rows
        });
    } catch (err) {
        console.error('Get tenant features error:', err);
        res.status(500).json({ 
            error: 'Failed to fetch tenant features',
            details: err.message 
        });
    }
};

/**
 * POST /api/features/:featureKey/enable
 * Enable a feature for tenant
 */
exports.enableFeature = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { featureKey } = req.params;

    try {
        // Get feature info
        const featureResult = await pool.query(`
            SELECT id, category 
            FROM features 
            WHERE feature_key = $1
        `, [featureKey]);

        if (featureResult.rows.length === 0) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const feature = featureResult.rows[0];

        // Enable or update tenant feature
        await pool.query(`
            INSERT INTO tenant_features (tenant_id, feature_id, feature_key, is_enabled, enabled_at)
            VALUES ($1::uuid, $2::uuid, $3, true, now())
            ON CONFLICT (tenant_id, feature_key) 
            DO UPDATE SET
                is_enabled = true,
                enabled_at = now(),
                disabled_at = null,
                updated_at = now()
        `, [tenantId, feature.id, featureKey]);

        res.json({ 
            message: 'Feature enabled successfully',
            featureKey,
            enabled: true
        });
    } catch (err) {
        console.error('Enable feature error:', err);
        res.status(500).json({ 
            error: 'Failed to enable feature',
            details: err.message 
        });
    }
};

/**
 * POST /api/features/:featureKey/disable
 * Disable a feature for tenant
 */
exports.disableFeature = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { featureKey } = req.params;

    try {
        // Get feature info
        const featureResult = await pool.query(`
            SELECT id, category 
            FROM features 
            WHERE feature_key = $1
        `, [featureKey]);

        if (featureResult.rows.length === 0) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const feature = featureResult.rows[0];

        // Block disabling core features
        if (feature.category === 'core') {
            return res.status(403).json({ 
                error: 'Cannot disable core features',
                featureKey 
            });
        }

        // Disable tenant feature
        await pool.query(`
            UPDATE tenant_features
            SET 
                is_enabled = false,
                disabled_at = now(),
                updated_at = now()
            WHERE tenant_id = $1::uuid AND feature_key = $2
        `, [tenantId, featureKey]);

        res.json({ 
            message: 'Feature disabled successfully',
            featureKey,
            enabled: false
        });
    } catch (err) {
        console.error('Disable feature error:', err);
        res.status(500).json({ 
            error: 'Failed to disable feature',
            details: err.message 
        });
    }
};

/**
 * Helper: Check if tenant has feature enabled
 */
exports.checkTenantFeature = async (tenantId, featureKey) => {
    try {
        const result = await pool.query(`
            SELECT is_enabled 
            FROM tenant_features
            WHERE tenant_id = $1::uuid AND feature_key = $2
        `, [tenantId, featureKey]);

        return result.rows.length > 0 && result.rows[0].is_enabled;
    } catch (err) {
        console.error('Check feature error:', err);
        return false;
    }
};
