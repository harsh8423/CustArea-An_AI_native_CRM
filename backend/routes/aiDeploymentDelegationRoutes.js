const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissionMiddleware');
const {
    grantAIDeploymentPermission,
    revokeAIDeploymentPermission,
    getUserAIDeploymentPermissions,
    getMyAIDeployments
} = require('../controllers/aiDeploymentDelegationController');

// Admin routes - manage AI deployment permissions for users
router.post('/admin/users/:userId/ai-deployments', 
    authMiddleware, 
    requirePermission('ai.deploy_all'),
    grantAIDeploymentPermission
);

router.delete('/admin/users/:userId/ai-deployments/:resourceId', 
    authMiddleware, 
    requirePermission('ai.deploy_all'),
    revokeAIDeploymentPermission
);

router.get('/admin/users/:userId/ai-deployments', 
    authMiddleware, 
    requirePermission('ai.deploy_all'),
    getUserAIDeploymentPermissions
);

// User routes - get own AI deployment permissions
router.get('/users/me/ai-deployments', 
    authMiddleware,
    requireAnyPermission(['ai.deploy', 'ai.deploy_all']),
    getMyAIDeployments
);

module.exports = router;
