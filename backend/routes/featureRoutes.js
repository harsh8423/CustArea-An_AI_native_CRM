const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Get all features (with tenant-specific enabled status)
router.get('/', authMiddleware, featureController.getAllFeatures);

// Get tenant's enabled features (authenticated users)
router.get('/tenant', authMiddleware, featureController.getTenantFeatures);

// Enable a feature (admin only)
router.post('/:featureKey/enable', authMiddleware, requirePermission('settings.edit'), featureController.enableFeature);

// Disable a feature (admin only)
router.post('/:featureKey/disable', authMiddleware, requirePermission('settings.edit'), featureController.disableFeature);

module.exports = router;
