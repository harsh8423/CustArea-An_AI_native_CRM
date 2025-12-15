const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
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
