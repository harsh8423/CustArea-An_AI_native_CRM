const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const authMiddleware = require('../middleware/authMiddleware');

// Get all available features
router.get('/', featureController.getAllFeatures);

// Get tenant's enabled features
router.get('/tenant', authMiddleware, featureController.getTenantFeatures);

// Enable a feature
router.post('/:featureKey/enable', authMiddleware, featureController.enableFeature);

// Disable a feature
router.post('/:featureKey/disable', authMiddleware, featureController.disableFeature);

module.exports = router;
