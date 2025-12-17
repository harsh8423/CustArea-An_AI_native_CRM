/**
 * Widget Rate Limiter
 * Redis-based rate limiting for widget endpoints
 */

const { redis } = require('../../config/redis');

// Rate limit configurations
const LIMITS = {
    init: { max: 20, window: 60 },     // 20 inits per minute per IP
    chat: { max: 30, window: 60 },     // 30 messages per minute per session
    default: { max: 60, window: 60 }   // 60 requests per minute
};

/**
 * Create rate limiter middleware for a specific action
 */
function rateLimit(action = 'default') {
    const config = LIMITS[action] || LIMITS.default;
    
    return async (req, res, next) => {
        try {
            // Use IP for init, session ID for authenticated requests
            let key;
            if (action === 'init') {
                const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
                key = `widget_rl:${action}:${ip}`;
            } else if (req.widgetToken) {
                key = `widget_rl:${action}:${req.widgetToken.sessionId || req.widgetToken.externalId}`;
            } else {
                const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
                key = `widget_rl:${action}:${ip}`;
            }
            
            const current = await redis.incr(key);
            
            if (current === 1) {
                // First request in window, set expiry
                await redis.expire(key, config.window);
            }
            
            if (current > config.max) {
                const ttl = await redis.ttl(key);
                res.set('Retry-After', ttl.toString());
                return res.status(429).json({ 
                    error: 'Too many requests',
                    retryAfter: ttl
                });
            }
            
            // Add rate limit headers
            res.set('X-RateLimit-Limit', config.max.toString());
            res.set('X-RateLimit-Remaining', Math.max(0, config.max - current).toString());
            
            next();
        } catch (err) {
            console.error('[Widget Rate Limit] Error:', err);
            // Fail open - don't block if Redis is down
            next();
        }
    };
}

module.exports = { rateLimit };
