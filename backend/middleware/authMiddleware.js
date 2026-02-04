const { supabase } = require('../config/supabase');
const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');

/**
 * Authenticate requests - supports both Supabase tokens and legacy JWT
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // Verify custom JWT (no fallbacks)
        if (!process.env.JWT_SECRET) {
            console.error('CRITICAL: JWT_SECRET not configured in environment');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Load user from database
        const result = await pool.query(
            `SELECT u.*, t.name as tenant_name
             FROM users u
             LEFT JOIN tenants t ON u.tenant_id = t.id
             WHERE u.id = $1`,
            [verified.userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        // Load user permissions
        const { getUserPermissions } = require('../services/permissionService');
        const permissions = await getUserPermissions(user.id);

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenant_id,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
            permissions: permissions,  // Array of permission keys
            hasPermission: (permKey) => permissions.includes(permKey)
        };

        return next();
    } catch (err) {
        // JWT verification failed - token is invalid or expired
        if (err.name === 'TokenExpiredError') {
            console.log('Token expired for user - needs to re-login');
            return res.status(401).json({ error: 'Token expired', redirect: '/login' });
        }
        if (err.name === 'JsonWebTokenError') {
            console.log('Invalid token signature');
            return res.status(403).json({ error: 'Invalid token', redirect: '/login' });
        }
        
        console.error('Auth middleware error:', err);
        return res.status(403).json({ error: 'Authentication failed', redirect: '/login' });
    }
};

module.exports = authenticateToken;
