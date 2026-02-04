const { pool } = require('../config/db');

/**
 * GET /api/features
 * Get all features with tenant-specific enabled status
 */
exports.getAllFeatures = async (req, res) => {
    const tenantId = req.user.tenantId;
    
    try {
        const result = await pool.query(`
            SELECT 
                f.id,
                f.feature_key,
                f.display_name as feature_name,
                f.description,
                f.icon,
                f.category,
                COALESCE(tf.is_enabled, f.is_default) as is_enabled,
                f.is_default,
                f.sort_order
            FROM features f
            LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = $1
            ORDER BY f.sort_order
        `, [tenantId]);

        res.json(result.rows);
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
                f.id,
                f.feature_key,
                f.display_name,
                f.description,
                f.icon,
                f.category,
                f.is_default,
                COALESCE(tf.is_enabled, f.is_default) as is_enabled,
                tf.enabled_at,
                tf.disabled_at
            FROM features f
            LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = $1
            ORDER BY f.sort_order
        `, [tenantId]);

        // Extract enabled feature_key strings for sidebar filtering
        const enabledFeatures = result.rows
            .filter(f => f.is_enabled)
            .map(f => f.feature_key);

        console.log(`[Features] Tenant ${tenantId} enabled features:`, enabledFeatures);

        res.json({ 
            success: true,
            features: enabledFeatures,  // Array of feature_key strings for sidebar: ['dashboard', 'sales', ...]
            details: result.rows        // Full feature objects for Integrations page
        });
    } catch (err) {
        console.error("Error getting tenant features:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to get tenant features",
            features: ['dashboard', 'sales', 'conversation', 'ai_agent'],
            details: []
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
