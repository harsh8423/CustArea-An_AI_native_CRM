const { checkPermission, hasAnyPermission, hasAllPermissions } = require('../services/permissionService');

/**
 * Middleware to require a specific permission
 * Usage: router.post('/campaigns', authMiddleware, requirePermission('campaigns.create'), ...)
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasPermission = await checkPermission(req.user.id, permissionKey);

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Permission denied',
                    required_permission: permissionKey,
                    message: `You don't have permission to perform this action. Required: ${permissionKey}`
                });
            }

            next();
        } catch (err) {
            console.error('Permission check error:', err);
            return res.status(500).json({
                error: 'Failed to check permissions',
                details: err.message
            });
        }
    };
};

/**
 * Middleware to require ANY of the specified permissions
 * Usage: router.get('/data', authMiddleware, requireAnyPermission(['leads.view', 'contacts.view']), ...)
 */
const requireAnyPermission = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasPermission = await hasAnyPermission(req.user.id, permissionKeys);

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Permission denied',
                    required_permissions_any: permissionKeys,
                    message: `You need at least one of: ${permissionKeys.join(', ')}`
                });
            }

            next();
        } catch (err) {
            console.error('Permission check error:', err);
            return res.status(500).json({
                error: 'Failed to check permissions',
                details: err.message
            });
        }
    };
};

/**
 * Middleware to require ALL of the specified permissions
 * Usage: router.post('/advanced', authMiddleware, requireAllPermissions(['campaigns.create', 'workflows.create']), ...)
 */
const requireAllPermissions = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasPermissions = await hasAllPermissions(req.user.id, permissionKeys);

            if (!hasPermissions) {
                return res.status(403).json({
                    error: 'Permission denied',
                    required_permissions_all: permissionKeys,
                    message: `You need all of: ${permissionKeys.join(', ')}`
                });
            }

            next();
        } catch (err) {
            console.error('Permission check error:', err);
            return res.status(500).json({
                error: 'Failed to check permissions',
                details: err.message
            });
        }
    };
};

module.exports = {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions
};
