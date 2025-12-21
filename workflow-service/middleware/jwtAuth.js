/**
 * JWT Authentication Middleware
 * Validates JWT tokens from main backend
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authenticate JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.tenantId = decoded.tenantId || decoded.tenant_id;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

/**
 * Extract tenant ID without requiring authentication
 * Used for endpoints that need tenant context but don't require auth
 */
function extractTenant(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            req.tenantId = decoded.tenantId || decoded.tenant_id;
        } catch (error) {
            // Token invalid but we'll continue without user context
        }
    }
    
    next();
}

module.exports = { authenticateToken, extractTenant };
