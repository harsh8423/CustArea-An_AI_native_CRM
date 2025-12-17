/**
 * Phone Routes
 * API endpoints for phone call management
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const {
    initiateCall,
    handleInbound,
    handleStatusCallback,
    handleMissedCall,
    handleBrowserOutbound,
    getActiveCalls,
    getCallHistory,
    getCallDetails,
    endCall
} = require('../controllers/phoneController');
const { getAccessToken } = require('../controllers/tokenController');

// ============================================
// Public endpoints (Twilio webhooks)
// ============================================

// Root route - for when mounted at /twiml (e.g., Twilio hits /twiml)
router.get('/', handleInbound);
router.post('/', handleInbound);

// Explicit /inbound and /twiml routes for /api/phone/inbound
router.get('/inbound', handleInbound);
router.post('/inbound', handleInbound);
router.get('/twiml', handleInbound);
router.post('/twiml', handleInbound);

// Status callback from Twilio
router.post('/status', handleStatusCallback);

// Missed call callback (Dial action)
router.post('/missed', handleMissedCall);

// Browser outbound TwiML (TwiML App voice URL)
router.post('/browser-outbound', handleBrowserOutbound);

// ============================================
// Protected endpoints (require auth)
// ============================================

// Access token for browser SDK
router.get('/token', authMiddleware, getAccessToken);

// Call management
router.post('/call', authMiddleware, initiateCall);
router.get('/calls', authMiddleware, getCallHistory);
router.get('/calls/active', authMiddleware, getActiveCalls);
router.get('/calls/:callSid', authMiddleware, getCallDetails);
router.post('/calls/:callSid/end', authMiddleware, endCall);

module.exports = router;
