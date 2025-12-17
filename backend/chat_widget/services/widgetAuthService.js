/**
 * Widget Auth Service
 * JWT token generation and validation for widget sessions
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { redis } = require('../../config/redis');

const JWT_SECRET = process.env.WIDGET_JWT_SECRET || process.env.JWT_SECRET || 'widget-secret-change-me';
const TOKEN_TTL = 3600; // 1 hour in seconds

/**
 * Generate a JWT token for widget session
 */
function signWidgetToken(payload) {
    const jti = crypto.randomBytes(16).toString('hex');
    
    const token = jwt.sign(
        {
            ...payload,
            jti,
            type: 'widget'
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    
    return { token, jti };
}

/**
 * Verify a widget JWT token
 */
function verifyWidgetToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'widget') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (err) {
        return null;
    }
}

/**
 * Store token JTI in Redis for revocation check
 */
async function storeTokenJti(jti) {
    await redis.set(`widget_token:${jti}`, '1', 'EX', TOKEN_TTL);
}

/**
 * Check if token JTI is valid (not revoked)
 */
async function isTokenValid(jti) {
    const exists = await redis.get(`widget_token:${jti}`);
    return exists === '1';
}

/**
 * Revoke a token by removing its JTI from Redis
 */
async function revokeToken(jti) {
    await redis.del(`widget_token:${jti}`);
}

/**
 * Hash IP address for storage
 */
function hashIp(ip) {
    return crypto.createHash('sha256').update(ip || '').digest('hex').slice(0, 16);
}

module.exports = {
    signWidgetToken,
    verifyWidgetToken,
    storeTokenJti,
    isTokenValid,
    revokeToken,
    hashIp,
    TOKEN_TTL
};
