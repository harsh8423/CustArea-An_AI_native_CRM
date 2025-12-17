/**
 * Widget Auth Middleware
 * Validates widget JWT tokens and attaches config data to request
 */

const { verifyWidgetToken, isTokenValid } = require('../services/widgetAuthService');
const { getConfigById } = require('../services/widgetSiteService');

/**
 * Widget authentication middleware
 * Validates JWT token and verifies widget config access
 */
async function widgetAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyWidgetToken(token);
        
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Check if token is still valid in Redis
        const valid = await isTokenValid(decoded.jti);
        if (!valid) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }
        
        // Get widget config
        const config = await getConfigById(decoded.configId);
        if (!config || !config.is_active) {
            return res.status(403).json({ error: 'Widget not found or inactive' });
        }
        
        // Attach to request
        req.widgetToken = decoded;
        req.widgetConfig = config;
        req.tenantId = config.tenant_id;
        
        next();
    } catch (err) {
        console.error('[Widget Auth] Error:', err);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

module.exports = { widgetAuth };
