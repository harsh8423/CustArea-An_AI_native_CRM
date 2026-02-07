const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { requireDomainOwnership, checkDomainOwnershipIfExists } = require('../../middleware/domainOwnershipMiddleware');
const {
    // Multi-provider operations
    sendEmailMultiProvider,
    getInboundEmailsMulti,
    getEmailConnections,
    setDefaultConnection,
    // Domain ownership workflow (NEW)
    claimDomain,
    verifyDomainOwnership,
    // Legacy SES operations (now with ownership checks)
    createDomainIdentity,
    getIdentities,
    checkIdentityStatus,
    addAllowedFrom,
    getAllowedFrom,
    removeAllowedFrom,
    sendEmail,
    getOutboundEmails,
    getInboundEmails,
    addAllowedInbound,
    getAllowedInbound,
    removeAllowedInbound
} = require('../controllers/emailController');

// All routes require authentication
router.use(authenticateToken);

// ===== MULTI-PROVIDER ENDPOINTS =====
// These work with any email provider (Gmail, SES, Outlook, etc.)
router.post('/send-multi', requirePermission('email.send'), sendEmailMultiProvider);
router.get('/inbound-multi', requirePermission('email.access'), getInboundEmailsMulti);
router.get('/connections', requirePermission('settings.view'), getEmailConnections);
router.post('/connections/:id/set-default', requirePermission('settings.edit'), setDefaultConnection);

// ===== DOMAIN OWNERSHIP VERIFICATION WORKFLOW (Admin only) =====
// Step 1: Claim domain with DNS challenge
router.post('/identities/claim-domain', 
    requirePermission('settings.edit'),
    checkDomainOwnershipIfExists,  // Prevent claiming already-owned domains
    claimDomain
);

// Step 2: Verify DNS ownership
router.post('/identities/verify-ownership', 
    requirePermission('settings.edit'),
    verifyDomainOwnership
);

// Step 3: Complete SES configuration (requires verified ownership)
router.post('/identities/domain', 
    requirePermission('settings.edit'),
    requireDomainOwnership,  // ✅ NEW: Enforce ownership before SES creation
    createDomainIdentity
);

// ===== SES IDENTITY MANAGEMENT (Admin only) =====
router.get('/identities', requirePermission('settings.view'), getIdentities);
router.get('/identities/:id/status', 
    requirePermission('settings.view'),
    requireDomainOwnership,  // ✅ NEW: Prevent status checks on unowned domains
    checkIdentityStatus
);

// ===== ALLOWED FROM EMAILS - Outbound Senders (Admin only) =====
router.get('/allowed-from', requirePermission('settings.view'), getAllowedFrom);
router.post('/allowed-from', requirePermission('settings.edit'), addAllowedFrom);
router.delete('/allowed-from/:id', requirePermission('settings.edit'), removeAllowedFrom);

// ===== SEND EMAIL =====
router.post('/send', requirePermission('email.send'), sendEmail);

// ===== OUTBOUND EMAILS - History (View permission) =====
router.get('/outbound', requirePermission('email.access'), getOutboundEmails);

// ===== INBOUND EMAILS - Fetch (View permission) =====
router.get('/inbound', requirePermission('email.access'), getInboundEmails);

// ===== ALLOWED INBOUND ADDRESSES (Admin only) =====
router.get('/allowed-inbound', requirePermission('settings.view'), getAllowedInbound);
router.post('/allowed-inbound', requirePermission('settings.edit'), addAllowedInbound);
router.delete('/allowed-inbound/:id', requirePermission('settings.edit'), removeAllowedInbound);

module.exports = router;
