const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    getWhatsappConfig,
    upsertWhatsappConfig,
    deactivateWhatsapp,
    getWidgetConfig,
    upsertWidgetConfig,
    deactivateWidget,
    getPhoneConfig,
    upsertPhoneConfig,
    deactivatePhone
} = require('../controllers/channelController');

// All routes require authentication
router.use(authenticateToken);

// WhatsApp
router.get('/whatsapp', getWhatsappConfig);
router.post('/whatsapp', upsertWhatsappConfig);
router.delete('/whatsapp', deactivateWhatsapp);

// Widget
router.get('/widget', getWidgetConfig);
router.post('/widget', upsertWidgetConfig);
router.delete('/widget', deactivateWidget);

// Phone
router.get('/phone', getPhoneConfig);
router.post('/phone', upsertPhoneConfig);
router.delete('/phone', deactivatePhone);

module.exports = router;
