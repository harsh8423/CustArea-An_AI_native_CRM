const express = require('express');
const router = express.Router();
const { receiveInboundMessage } = require('../conversations/controllers/messageController');
const whatsappService = require('../whatsapp/services/whatsappService');
const widgetService = require('../chat_widget/services/widgetService');

// Webhook routes - no auth required (use signature verification per channel)
// These are called by external services (Twilio, SES, Widget)

// Unified inbound message webhook
router.post('/inbound', receiveInboundMessage);

// WhatsApp/Twilio incoming webhook
router.post('/whatsapp', async (req, res) => {
    try {
        await whatsappService.handleIncomingWebhook(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error('WhatsApp webhook error:', err);
        res.status(500).send('Error');
    }
});

// WhatsApp/Twilio status callback
router.post('/whatsapp/status', async (req, res) => {
    try {
        await whatsappService.handleStatusCallback(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error('WhatsApp status callback error:', err);
        res.status(200).send('OK'); // Always return 200 for Twilio
    }
});

// Widget initialization
router.post('/widget/init', async (req, res) => {
    try {
        const { publicKey, visitorToken, userData } = req.body;
        const domain = req.get('origin') || req.get('referer') || '';
        const hostname = domain.replace(/^https?:\/\//, '').split('/')[0];

        const result = await widgetService.handleWidgetInit(publicKey, visitorToken, hostname, userData);
        res.json(result);
    } catch (err) {
        console.error('Widget init error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Widget chat message
router.post('/widget/chat', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token required' });
        }

        const token = authHeader.slice(7);
        const payload = widgetService.verifyWidgetToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { message, metadata } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'message required' });
        }

        const result = await widgetService.handleChatMessage(payload, message, metadata);
        res.json({ 
            conversationId: result.conversation.id,
            messageId: result.message.id
        });
    } catch (err) {
        console.error('Widget chat error:', err);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

module.exports = router;
