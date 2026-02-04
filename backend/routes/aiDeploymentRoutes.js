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

// Get all AI deployments (filtered by user permissions)
router.get('/deployments', 
    authMiddleware, 
    requireAnyPermission(['ai.deploy', 'ai.deploy_all']),
    getAIDeployments
);

// Create new AI deployment (admin only)
router.post('/deployments', 
    authMiddleware, 
    requirePermission('ai.deploy_all'),
    createAIDeployment
);

// Update AI deployment (requires configure permission on resource)
router.patch('/deployments/:id', 
    authMiddleware,
    requireAnyPermission(['ai.deploy', 'ai.deploy_all']),
    updateAIDeployment
);

// Delete AI deployment (admin only)
router.delete('/deployments/:id', 
    authMiddleware, 
    requirePermission('ai.deploy_all'),
    deleteAIDeployment
);

// Enable AI on resource (requires enable_disable permission)
router.post('/deployments/:id/enable', 
    authMiddleware,
    requireAnyPermission(['ai.deploy', 'ai.deploy_all']),
    enableAIDeployment
);

// Disable AI on resource (requires enable_disable permission)
router.post('/deployments/:id/disable', 
    authMiddleware,
    requireAnyPermission(['ai.deploy', 'ai.deploy_all']),
    disableAIDeployment
);

module.exports = router;
