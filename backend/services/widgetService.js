const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { queueIncomingMessage } = require('../config/redis');

const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET || 'widget-secret-change-me';

/**
 * Get widget config by public key
 */
async function getConfigByPublicKey(publicKey) {
    const result = await pool.query(
        `SELECT wc.*, t.name as tenant_name FROM tenant_widget_config wc
         JOIN tenants t ON wc.tenant_id = t.id
         WHERE wc.public_key = $1 AND wc.is_active = true`,
        [publicKey]
    );
    return result.rows[0] || null;
}

/**
 * Get widget config by tenant ID
 */
async function getConfigByTenantId(tenantId) {
    const result = await pool.query(
        `SELECT * FROM tenant_widget_config WHERE tenant_id = $1`,
        [tenantId]
    );
    return result.rows[0] || null;
}

/**
 * Create or update widget config for tenant
 */
async function upsertConfig(tenantId, data) {
    const { allowedDomains, theme, welcomeMessage, requireEmail } = data;

    // Check if exists
    const existing = await getConfigByTenantId(tenantId);
    
    if (existing) {
        const result = await pool.query(
            `UPDATE tenant_widget_config SET
                allowed_domains = COALESCE($2, allowed_domains),
                theme = COALESCE($3, theme),
                welcome_message = COALESCE($4, welcome_message),
                require_email = COALESCE($5, require_email),
                updated_at = now()
             WHERE tenant_id = $1
             RETURNING *`,
            [tenantId, allowedDomains, theme ? JSON.stringify(theme) : null, welcomeMessage, requireEmail]
        );
        return result.rows[0];
    } else {
        // Generate new keys
        const publicKey = crypto.randomBytes(16).toString('hex');
        const secretKey = crypto.randomBytes(32).toString('hex');

        const result = await pool.query(
            `INSERT INTO tenant_widget_config (
                tenant_id, public_key, secret_key, allowed_domains, theme, welcome_message, require_email
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                tenantId,
                publicKey,
                secretKey,
                allowedDomains || [],
                theme ? JSON.stringify(theme) : '{}',
                welcomeMessage || 'Hi! How can I help you today?',
                requireEmail || false
            ]
        );
        return result.rows[0];
    }
}

/**
 * Check if domain is allowed for widget
 */
function isDomainAllowed(config, domain) {
    if (!config.allowed_domains || config.allowed_domains.length === 0) {
        return true; // No restrictions
    }
    
    // Handle localhost for development
    if (domain === 'localhost' || domain.startsWith('localhost:')) {
        return true;
    }

    return config.allowed_domains.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(1);
            return domain.endsWith(suffix);
        }
        return domain === allowed;
    });
}

/**
 * Sign widget session token
 */
function signWidgetToken(payload) {
    const jti = crypto.randomBytes(16).toString('hex');
    return jwt.sign(
        { ...payload, jti },
        WIDGET_JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Verify widget token
 */
function verifyWidgetToken(token) {
    try {
        return jwt.verify(token, WIDGET_JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Find or create widget visitor
 */
async function findOrCreateVisitor(tenantId, visitorToken, userData = {}) {
    let result = await pool.query(
        `SELECT * FROM widget_visitors WHERE tenant_id = $1 AND visitor_token = $2`,
        [tenantId, visitorToken]
    );

    if (result.rows.length > 0) {
        // Update last seen
        await pool.query(
            `UPDATE widget_visitors SET 
                last_seen_at = now(), 
                page_views = page_views + 1,
                email = COALESCE($3, email),
                name = COALESCE($4, name)
             WHERE id = $5`,
            [tenantId, visitorToken, userData.email, userData.name, result.rows[0].id]
        );
        return result.rows[0];
    }

    result = await pool.query(
        `INSERT INTO widget_visitors (tenant_id, visitor_token, email, name, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, visitorToken, userData.email, userData.name, userData.userAgent, JSON.stringify(userData.metadata || {})]
    );
    return result.rows[0];
}

/**
 * Handle widget initialization
 */
async function handleWidgetInit(publicKey, visitorToken, domain, userData = {}) {
    const config = await getConfigByPublicKey(publicKey);
    if (!config || !config.is_active) {
        throw new Error('Invalid or inactive widget');
    }

    if (!isDomainAllowed(config, domain)) {
        throw new Error('Domain not allowed');
    }

    const tenantId = config.tenant_id;

    // Find or create visitor
    const visitor = await findOrCreateVisitor(tenantId, visitorToken, userData);

    // Generate session token
    const token = signWidgetToken({
        tenantId,
        visitorId: visitor.id,
        visitorToken,
        publicKey
    });

    return {
        token,
        visitorId: visitor.id,
        welcomeMessage: config.welcome_message,
        theme: config.theme
    };
}

/**
 * Handle widget chat message
 */
async function handleChatMessage(tokenPayload, message, metadata = {}) {
    const { tenantId, visitorId, visitorToken } = tokenPayload;

    // Find or create conversation
    let convResult = await pool.query(
        `SELECT * FROM conversations 
         WHERE tenant_id = $1 AND channel = 'widget' AND channel_contact_id = $2 AND status != 'closed'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, visitorToken]
    );

    let conversation;
    if (convResult.rows.length === 0) {
        // Get visitor for potential contact linking
        const visitor = await pool.query(
            `SELECT * FROM widget_visitors WHERE id = $1`,
            [visitorId]
        );

        convResult = await pool.query(
            `INSERT INTO conversations (tenant_id, contact_id, channel, channel_contact_id, status)
             VALUES ($1, $2, 'widget', $3, 'open') RETURNING *`,
            [tenantId, visitor.rows[0]?.contact_id || null, visitorToken]
        );
    }
    conversation = convResult.rows[0];

    // Create message
    const msgResult = await pool.query(
        `INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel,
            content_text, provider, status
        ) VALUES ($1, $2, 'inbound', 'user', 'widget', $3, 'widget', 'received')
        RETURNING *`,
        [tenantId, conversation.id, message]
    );

    const msg = msgResult.rows[0];

    // Insert widget metadata
    await pool.query(
        `INSERT INTO message_widget_metadata (message_id, widget_session_id, visitor_id, page_url, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [msg.id, metadata.sessionId || visitorToken, visitorId, metadata.pageUrl, metadata.userAgent]
    );

    // Queue for AI processing
    try {
        await queueIncomingMessage(msg.id, tenantId, conversation.id, 'widget');
    } catch (err) {
        console.error('Failed to queue widget message:', err);
    }

    return { message: msg, conversation };
}

module.exports = {
    getConfigByPublicKey,
    getConfigByTenantId,
    upsertConfig,
    isDomainAllowed,
    signWidgetToken,
    verifyWidgetToken,
    findOrCreateVisitor,
    handleWidgetInit,
    handleChatMessage
};
