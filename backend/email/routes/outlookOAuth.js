const express = require('express');
const router = express.Router();
const outlookController = require('../controllers/outlookOAuthController');
const authMiddleware = require('../../middleware/authMiddleware');

// OAuth flow
router.get('/authorize', authMiddleware, outlookController.startOutlookAuthorization);
router.get('/callback', outlookController.handleOutlookCallback); // Public - receives callback from Microsoft

// Outlook management (protected)
router.get('/status', authMiddleware, outlookController.getOutlookStatus);
router.delete('/disconnect/:connectionId', authMiddleware, outlookController.disconnectOutlook);
router.post('/set-default/:connectionId', authMiddleware, outlookController.setOutlookAsDefault);

module.exports = router;
