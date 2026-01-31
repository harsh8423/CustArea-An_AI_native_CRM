/**
 * Email History Routes
 * 
 * Routes for viewing email send history
 */

const express = require('express');
const router = express.Router();
const emailHistoryController = require('../controllers/emailHistoryController');
const authenticateToken = require('../../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Get outbound email history (single emails)
router.get('/history/outbound', emailHistoryController.getOutboundHistory);

// Get outbound email details
router.get('/history/outbound/:emailId', emailHistoryController.getOutboundEmailDetails);

// Get bulk job history
router.get('/history/bulk', emailHistoryController.getBulkJobHistory);

// Note: Bulk job details endpoint already exists in bulkEmailRoutes.js
// GET /api/email/bulk-jobs/:jobId

module.exports = router;
