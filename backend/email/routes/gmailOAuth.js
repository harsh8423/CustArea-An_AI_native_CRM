const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailOAuthController');
const authMiddleware = require('../../middleware/authMiddleware');

// OAuth flow
router.get('/authorize', authMiddleware, gmailController.startGmailAuthorization);
router.get('/callback', gmailController.handleGmailCallback); // Public - receives callback from Google

// Gmail management (protected)
router.get('/status', authMiddleware, gmailController.getGmailStatus);
router.delete('/disconnect/:connectionId', authMiddleware, gmailController.disconnectGmail);
router.post('/set-default/:connectionId', authMiddleware, gmailController.setGmailAsDefault);

module.exports = router;
