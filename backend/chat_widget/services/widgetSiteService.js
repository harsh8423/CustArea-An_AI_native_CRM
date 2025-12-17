/**
 * Widget Site Service
 * Manages widget configuration for tenants using existing tenant_widget_config table
 */

const { pool } = require('../../config/db');
const crypto = require('crypto');

/**
 * Get widget config by public key (for widget init)
 */
async function getConfigByPublicKey(publicKey) {
    const result = await pool.query(
        `SELECT * FROM tenant_widget_config WHERE public_key = $1 AND is_active = true`,
        [publicKey]
    );
    return result.rows[0] || null;
}

/**
 * Get widget config by ID
 */
async function getConfigById(configId) {
    const result = await pool.query(
        `SELECT * FROM tenant_widget_config WHERE id = $1`,
        [configId]
    );
    return result.rows[0] || null;
}

/**
 * Get widget config for a tenant
 */
async function getConfigForTenant(tenantId) {
    const result = await pool.query(
        `SELECT * FROM tenant_widget_config WHERE tenant_id = $1`,
        [tenantId]
    );
    return result.rows[0] || null;
}

/**
 * Create or update widget config for a tenant
 */
async function upsertConfig(tenantId, { allowedDomains = [], theme = {}, welcomeMessage = null, requireEmail = false }) {
    const publicKey = 'wgt_' + crypto.randomBytes(16).toString('hex');
    const secretKey = crypto.randomBytes(32).toString('hex');
    
    const result = await pool.query(
        `INSERT INTO tenant_widget_config (tenant_id, public_key, secret_key, allowed_domains, theme, welcome_message, require_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
             allowed_domains = COALESCE($4, tenant_widget_config.allowed_domains),
             theme = COALESCE($5, tenant_widget_config.theme),
             welcome_message = COALESCE($6, tenant_widget_config.welcome_message),
             require_email = COALESCE($7, tenant_widget_config.require_email),
             updated_at = NOW()
         RETURNING *`,
        [tenantId, publicKey, secretKey, allowedDomains, JSON.stringify(theme), welcomeMessage, requireEmail]
    );
    return result.rows[0];
}

/**
 * Update widget config settings
 */
async function updateConfig(configId, { allowedDomains, theme, welcomeMessage, requireEmail, isActive }) {
    const result = await pool.query(
        `UPDATE tenant_widget_config 
         SET allowed_domains = COALESCE($2, allowed_domains),
             theme = COALESCE($3, theme),
             welcome_message = COALESCE($4, welcome_message),
             require_email = COALESCE($5, require_email),
             is_active = COALESCE($6, is_active),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [configId, allowedDomains, theme ? JSON.stringify(theme) : null, welcomeMessage, requireEmail, isActive]
    );
    return result.rows[0];
}

/**
 * Check if domain is allowed for widget config
 */
function isDomainAllowed(config, domain) {
    if (!domain) return false;
    
    // Always allow localhost/127.0.0.1 in development
    const devDomains = ['localhost', '127.0.0.1'];
    if (devDomains.includes(domain)) {
        console.warn(`[Widget] ⚠️ Allowing ${domain} for development. Remove this in production!`);
        return true;
    }
    
    if (!config.allowed_domains || config.allowed_domains.length === 0) {
        return true; // No restrictions = all allowed
    }
    
    // Check exact match or wildcard
    return config.allowed_domains.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(1); // .example.com
            return domain.endsWith(suffix) || domain === allowed.slice(2);
        }
        return domain === allowed;
    });
}

/**
 * Extract domain from request
 */
function getDomainFromRequest(req) {
    const origin = req.headers.origin || req.headers.referer || '';
    try {
        const url = new URL(origin);
        return url.hostname;
    } catch {
        return origin;
    }
}

module.exports = {
    getConfigByPublicKey,
    getConfigById,
    getConfigForTenant,
    upsertConfig,
    updateConfig,
    isDomainAllowed,
    getDomainFromRequest
};
