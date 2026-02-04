const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
    listUsers,
    getUserDetails,
    createUser,
    inviteUser,
    validateInvitation,
    acceptInvitation,
    assignRoles,
    grantPermissions,
    assignLeads,
    assignContacts,
    grantChannelAccess,
    updateUser,
    deactivateUser,
    assignContactGroups,
    getUserContactGroups
} = require('../controllers/userManagementController');

// Public routes (no auth required) - must come before authMiddleware
router.get('/invitations/:token/validate', validateInvitation);
router.post('/invitations/:token/accept', acceptInvitation);

// All routes below require authentication
router.use(authMiddleware);

// List users (requires users.view permission)
router.get('/', requirePermission('users.view'), listUsers);

// Get user details
router.get('/:id', requirePermission('users.view'), getUserDetails);

// Create user directly (requires users.invite permission - or create a new one, re-using invite for now)
router.post('/create', requirePermission('users.invite'), createUser);

// Invite user (requires users.invite permission)
router.post('/invite', requirePermission('users.invite'), inviteUser);

// Assign roles (requires users.manage permission)
router.post('/:id/assign-roles', requirePermission('users.manage'), assignRoles);

// Grant/revoke permissions (requires users.manage permission)
router.post('/:id/grant-permissions', requirePermission('users.manage'), grantPermissions);

// Assign leads (requires leads.assign permission)
router.post('/:id/assign-leads', requirePermission('leads.assign'), assignLeads);

// Assign contacts (requires leads.assign permission)
router.post('/:id/assign-contacts', requirePermission('leads.assign'), assignContacts);

// Assign contact groups (requires users.manage permission)
router.post('/:id/assign-contact-groups', requirePermission('users.manage'), assignContactGroups);

// Get user contact groups (requires users.view permission)
router.get('/:id/contact-groups', requirePermission('users.view'), getUserContactGroups);

// Grant channel access (requires users.manage permission)
router.post('/:id/grant-channel-access', requirePermission('users.manage'), grantChannelAccess);

// Update user (requires users.manage permission)
router.put('/:id', requirePermission('users.manage'), updateUser);

// Deactivate user (requires users.manage permission)
router.delete('/:id', requirePermission('users.manage'), deactivateUser);

module.exports = router;
