const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
    grantFeatureAccess,
    revokeFeatureAccess,
    getUserFeatureOverrides,
    getMyFeatures
} = require('../controllers/userFeatureAccessController');

// Admin routes - require users.manage permission
router.post('/admin/users/:userId/features', 
    authMiddleware, 
    requirePermission('users.manage'),
    grantFeatureAccess
);

router.delete('/admin/users/:userId/features/:featureId', 
    authMiddleware, 
    requirePermission('users.manage'),
    revokeFeatureAccess
);

router.get('/admin/users/:userId/features', 
    authMiddleware, 
    requirePermission('users.manage'),
    getUserFeatureOverrides
);

// User routes - authenticated users can see their own features
router.get('/users/me/features', 
    authMiddleware,
    getMyFeatures
);

module.exports = router;
