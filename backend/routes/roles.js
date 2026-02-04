const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
    listRoles,
    getRoleDetails,
    createRole,
    updateRole,
    deleteRole,
    assignPermissions
} = require('../controllers/roleController');

// All routes require authentication
router.use(authMiddleware);

// List roles (any authenticated user can view)
router.get('/', requirePermission('roles.view'), listRoles);

// Get role details
router.get('/:id', requirePermission('roles.view'), getRoleDetails);

// Create role (requires roles.manage permission)
router.post('/', requirePermission('roles.manage'), createRole);

// Update role (requires roles.manage permission)
router.put('/:id', requirePermission('roles.manage'), updateRole);

// Delete role (requires roles.manage permission)
router.delete('/:id', requirePermission('roles.manage'), deleteRole);

// Assign permissions to role (requires roles.manage permission)
router.post('/:id/permissions', requirePermission('roles.manage'), assignPermissions);

module.exports = router;
