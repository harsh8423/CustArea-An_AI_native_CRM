const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissionMiddleware');
const {
    getAIDeployments,
    createAIDeployment,
    updateAIDeployment,
    deleteAIDeployment,
    enableAIDeployment,
    disableAIDeployment
} = require('../controllers/aiDeploymentController');
const { getAvailableResources } = require('../controllers/aiResourcesController');

// Middleware to prevent caching (force fresh data on every request)
const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};

// Get available resources to deploy AI on
router.get('/available-resources',
    authMiddleware,
    requirePermission('ai.configure'),
    getAvailableResources
);

// Get all AI deployments (filtered by user permissions)
router.get('/deployments', 
    authMiddleware, 
    requireAnyPermission(['ai.configure', 'ai.deploy']),
    noCacheMiddleware,
    getAIDeployments
);

// Create new AI deployment (requires configuration permission)
router.post('/deployments', 
    authMiddleware, 
    requirePermission('ai.configure'),
    createAIDeployment
);

// Update AI deployment (requires configure permission on resource)
router.patch('/deployments/:id', 
    authMiddleware,
    requireAnyPermission(['ai.configure', 'ai.deploy']),
    updateAIDeployment
);

// Delete AI deployment (requires configuration permission)
router.delete('/deployments/:id', 
    authMiddleware, 
    requirePermission('ai.configure'),
    deleteAIDeployment
);

// Enable AI on resource (requires enable_disable permission or ai.configure)
router.post('/deployments/:id/enable', 
    authMiddleware,
    requireAnyPermission(['ai.configure', 'ai.deploy']),
    enableAIDeployment
);

// Disable AI on resource (requires enable_disable permission or ai.configure)
router.post('/deployments/:id/disable', 
    authMiddleware,
    requireAnyPermission(['ai.configure', 'ai.deploy']),
    disableAIDeployment
);

module.exports = router;


