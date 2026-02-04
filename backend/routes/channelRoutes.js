const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
    getWhatsappConfig,
    upsertWhatsappConfig,
    deactivateWhatsapp,
    getWidgetConfig,
    upsertWidgetConfig,
    deactivateWidget,
    getPhoneConfig,
    upsertPhoneConfig,
    deactivatePhone,
    getEmailAddresses,
    getInboundEmails,
    getOutboundEmails,
    getPhones
} = require('../controllers/channelController');

// All routes require authentication
router.use(authenticateToken);

// WhatsApp Configuration (Admin only)
router.get('/whatsapp', requirePermission('settings.view'), getWhatsappConfig);
router.post('/whatsapp', requirePermission('settings.edit'), upsertWhatsappConfig);
router.delete('/whatsapp', requirePermission('settings.edit'), deactivateWhatsapp);

// Widget Configuration (Admin only)
router.get('/widget', requirePermission('settings.view'), getWidgetConfig);
router.post('/widget', requirePermission('settings.edit'), upsertWidgetConfig);
router.delete('/widget', requirePermission('settings.edit'), deactivateWidget);

// Phone Configuration (Admin only)
router.get('/phone', requirePermission('settings.view'), getPhoneConfig);
router.post('/phone', requirePermission('settings.edit'), upsertPhoneConfig);
router.delete('/phone', requirePermission('settings.edit'), deactivatePhone);

// Email Configuration (for getting list of emails)
router.get('/email', getEmailAddresses);

// RBAC Channel Lists (Read-only for authenticated users)
// These are used by dialogs to select available channels for user access grants
router.get('/inbound-emails', getInboundEmails);
router.get('/outbound-emails', getOutboundEmails);
router.get('/phones', getPhones);

module.exports = router;
