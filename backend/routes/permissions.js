const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    listAllPermissions,
    getCurrentUserPermissions
} = require('../controllers/permissionController');

// All routes require authentication
router.use(authMiddleware);

// List all available permissions (system-wide)
router.get('/', listAllPermissions);

// Get current user's effective permissions
router.get('/me', getCurrentUserPermissions);

// Alias for frontend compatibility
router.get('/check', getCurrentUserPermissions);

module.exports = router;

