const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authMiddleware');
const {
    listConversations,
    getConversation,
    createConversation,
    updateConversation,
    assignConversation,
    getConversationStats,
    linkContactToConversation
} = require('../controllers/conversationController');
const {
    listMessages,
    getMessage,
    createMessage,
    updateMessageStatus
} = require('../controllers/messageController');

// All routes require authentication
router.use(authenticateToken);

// Conversation routes
router.get('/', listConversations);
router.get('/stats', getConversationStats);
router.get('/:id', getConversation);
router.post('/', createConversation);
router.patch('/:id', updateConversation);
router.post('/:id/assign', assignConversation);
router.patch('/:id/link-contact', linkContactToConversation);

// Message routes (nested under conversations)
router.get('/:conversationId/messages', listMessages);
router.post('/:conversationId/messages', createMessage);

module.exports = router;
