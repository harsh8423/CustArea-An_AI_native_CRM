const { checkTenantFeature } = require('../controllers/featureController');

/**
 * Middleware to check if tenant has a specific feature enabled
 * Usage: router.post('/tickets', authMiddleware, requireFeature('ticketing'), ...)
 */
const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        try {
            const tenantId = req.user.tenantId;
            
            if (!tenantId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasFeature = await checkTenantFeature(tenantId, featureKey);

            if (!hasFeature) {
                return res.status(403).json({ 
                    error: 'Feature not enabled',
                    feature: featureKey,
                    message: `The ${featureKey} feature is not enabled for your account. Enable it in Settings → Integrations.`
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
