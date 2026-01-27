const express = require('express');
const router = express.Router();
const conversationEmailController = require('../controllers/conversationEmailController');
const authMiddleware = require('../../middleware/authMiddleware');

// Get available sender addresses
router.get('/sender-addresses', authMiddleware, conversationEmailController.getSenderAddresses);

// Send email from conversation
router.post('/send-conversation', authMiddleware, conversationEmailController.sendConversationEmail);

module.exports = router;
