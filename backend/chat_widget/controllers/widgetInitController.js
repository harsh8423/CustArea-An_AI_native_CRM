/**
 * Widget Init Controller
 * Handles widget session initialization using tenant_widget_config
 */

const { getConfigByPublicKey, isDomainAllowed, getDomainFromRequest } = require('../services/widgetSiteService');
const { findOrCreateSession } = require('../services/widgetSessionService');
const { signWidgetToken, storeTokenJti, hashIp } = require('../services/widgetAuthService');

/**
 * POST /api/widget/init
 * Initialize a widget session and return JWT token
 */
async function initSession(req, res) {
    try {
        const { siteId, anonId } = req.body || {};
        
        if (!siteId || !anonId) {
            return res.status(400).json({ error: 'siteId and anonId required' });
        }
        
        // Validate widget config by public key
        const config = await getConfigByPublicKey(siteId);
        if (!config || !config.is_active) {
            return res.status(401).json({ error: 'Unknown or inactive widget' });
        }
        
        // Validate domain
        const domain = getDomainFromRequest(req);
        if (!isDomainAllowed(config, domain)) {
            console.log(`[Widget Init] Domain not allowed: ${domain} for config ${config.id}`);
            return res.status(403).json({ error: 'Domain not allowed' });
        }
        
        // Find or create session
        const session = await findOrCreateSession(config.id, config.tenant_id, anonId);
        
        // Generate JWT
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
        const { token, jti } = signWidgetToken({
            configId: config.id,
            tenantId: config.tenant_id,
            sessionId: session.id,
            externalId: anonId,
            ipHash: hashIp(ip)
        });
        
        // Store JTI in Redis
        await storeTokenJti(jti);
        
        console.log(`[Widget Init] Session initialized for tenant ${config.tenant_id}`);
        
        return res.json({
            token,
            sessionId: session.id,
            contactId: session.contact_id,
            welcomeMessage: config.welcome_message,
            requireEmail: config.require_email,
            theme: config.theme
        });
        
    } catch (err) {
        console.error('[Widget Init] Error:', err);
        return res.status(500).json({ error: 'Failed to initialize session' });
    }
}

module.exports = { initSession };
