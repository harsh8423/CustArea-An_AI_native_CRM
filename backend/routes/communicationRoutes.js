const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    forwardEmail,
    shareCall,
    reassignLead,
    reassignContact,
    getMyForwards,
    getMySharedCalls
} = require('../controllers/communicationController');

// All routes require authentication
router.use(authMiddleware);

// Forward and share
router.post('/forward-email', forwardEmail);
router.post('/share-call', shareCall);
router.post('/reassign-lead', reassignLead);
router.post('/reassign-contact', reassignContact);

// Get shared items
router.get('/my-forwards', getMyForwards);
router.get('/my-shared-calls', getMySharedCalls);

module.exports = router;
