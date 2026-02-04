const { canAccessFeature } = require('../services/permissionService');

/**
 * Middleware to check if user can access a specific feature
 * (respects both tenant-level and user-level feature access)
 * Usage: router.post('/tickets', authMiddleware, requireFeature('ticketing'), ...)
 */
const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasAccess = await canAccessFeature(userId, featureKey);

            if (!hasAccess) {
                return res.status(403).json({ 
                    error: 'Feature not enabled',
                    feature: featureKey,
                    message: `The ${featureKey} feature is not enabled for your account. Contact your admin to enable it.`
                });
            }

            next();
        } catch (err) {
            console.error('Feature check error:', err);
            return res.status(500).json({ 
                error: 'Failed to check feature access',
                details: err.message 
            });
        }
    };
};

module.exports = {
    requireFeature
};
