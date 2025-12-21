/**
 * Service Authentication Middleware
 * For internal service-to-service calls
 */

const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

/**
 * Authenticate service-to-service calls
 */
function authenticateService(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: 'No API key provided' });
    }

    if (apiKey !== SERVICE_API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }

    // Extract tenant_id from body or query
    req.tenantId = req.body?.tenant_id || req.query?.tenant_id;
    
    next();
}

module.exports = { authenticateService };
