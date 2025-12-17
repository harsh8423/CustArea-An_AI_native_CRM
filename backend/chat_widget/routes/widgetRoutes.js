/**
 * Widget Routes
 * Public API routes for chat widget
 */

const express = require('express');
const router = express.Router();

const { widgetAuth } = require('../middleware/widgetAuth');
const { rateLimit } = require('../middleware/rateLimit');
const { initSession } = require('../controllers/widgetInitController');
const { chat, getHistory } = require('../controllers/widgetChatController');

// Initialize widget session (public, rate limited)
router.post('/init', rateLimit('init'), initSession);

// Chat message (authenticated, rate limited)
router.post('/chat', rateLimit('chat'), widgetAuth, chat);

// Get conversation history (authenticated)
router.get('/history', widgetAuth, getHistory);

module.exports = router;
