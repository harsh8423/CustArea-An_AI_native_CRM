const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authMiddleware');
const {
    // Multi-provider operations
    sendEmailMultiProvider,
    getInboundEmailsMulti,
    getEmailConnections,
    setDefaultConnection,
    // Legacy SES operations
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
router.post('/send-multi', sendEmailMultiProvider); // New unified send endpoint
router.get('/inbound-multi', getInboundEmailsMulti); // Fetch emails from all providers
router.get('/connections', getEmailConnections); // List all email connections
router.post('/connections/:id/set-default', setDefaultConnection); // Set default connection


// SES Identities
router.get('/identities', getIdentities);
router.post('/identities/domain', createDomainIdentity);
router.get('/identities/:id/status', checkIdentityStatus);

// Allowed From Emails (outbound senders)
router.get('/allowed-from', getAllowedFrom);
router.post('/allowed-from', addAllowedFrom);
router.delete('/allowed-from/:id', removeAllowedFrom);

// Send Email
router.post('/send', sendEmail);

// Outbound Emails (history)
router.get('/outbound', getOutboundEmails);

// Inbound Emails
router.get('/inbound', getInboundEmails);

// Allowed Inbound Addresses
router.get('/allowed-inbound', getAllowedInbound);
router.post('/allowed-inbound', addAllowedInbound);
router.delete('/allowed-inbound/:id', removeAllowedInbound);

module.exports = router;
