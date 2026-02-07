const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const {
    listConversations,
    getConversation,
    createConversation,
    updateConversation,
    assignConversation,
    getConversationStats,
    linkContactToConversation,
    deleteConversation,
    markAsRead,
    markAsUnread,
    toggleStar,
    getStarredConversations
} = require('../controllers/conversationController');
const {
    listMessages,
    getMessage,
    createMessage,
    updateMessageStatus
} = require('../controllers/messageController');
const { forwardConversation } = require('../../controllers/communicationController');

// All routes require authentication
router.use(authenticateToken);

// Conversation routes - use conversations.view for viewing, conversations.reply for sending
router.get('/', requirePermission('conversations.view'), listConversations);
router.get('/stats', requirePermission('conversations.view'), getConversationStats);
router.get('/:id', requirePermission('conversations.view'), getConversation);
router.post('/', requirePermission('conversations.reply'), createConversation);
router.patch('/:id', requirePermission('conversations.view'), updateConversation);
router.post('/:id/assign', requirePermission('conversations.assign'), assignConversation);
router.post('/:id/forward', requirePermission('conversations.forward'), forwardConversation);
router.patch('/:id/link-contact', requirePermission('conversations.view'), linkContactToConversation);
router.patch('/:id/mark-read', requirePermission('conversations.view'), markAsRead);
router.patch('/:id/mark-unread', requirePermission('conversations.view'), markAsUnread);
router.post('/:id/star', requirePermission('conversations.view'), toggleStar);
router.get('/starred', requirePermission('conversations.view'), getStarredConversations);
router.delete('/:id', requirePermission('conversations.view'), deleteConversation);

// Message routes (nested under conversations)
router.get('/:conversationId/messages', requirePermission('conversations.view'), listMessages);
router.post('/:conversationId/messages', requirePermission('conversations.reply'), createMessage);

module.exports = router;
