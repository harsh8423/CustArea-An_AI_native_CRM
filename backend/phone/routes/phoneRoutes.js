/**
 * Phone Routes
 * API endpoints for phone call management
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
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
// Public endpoints (Twilio webhooks - NO AUTH)
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
// Protected endpoints (require auth + permissions)
// ============================================

// Access token for browser SDK (requires phone.access)
router.get('/token', authMiddleware, requirePermission('phone.access'), getAccessToken);

// Call management
router.post('/call', authMiddleware, requirePermission('phone.make_calls'), initiateCall);
router.get('/calls', authMiddleware, requirePermission('phone.access'), getCallHistory);
router.get('/calls/active', authMiddleware, requirePermission('phone.access'), getActiveCalls);
router.get('/calls/:callSid', authMiddleware, requirePermission('phone.access'), getCallDetails);
router.post('/calls/:callSid/end', authMiddleware, requirePermission('phone.make_calls'), endCall);

module.exports = router;
