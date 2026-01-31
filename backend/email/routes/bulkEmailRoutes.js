/**
 * Bulk Email Routes
 * 
 * API routes for bulk email operations
 */

const express = require('express');
const router = express.Router();
const bulkEmailController = require('../controllers/bulkEmailController');
const authenticateToken = require('../../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Create bulk email job
router.post('/send-bulk', bulkEmailController.sendBulk);

// Get job status
router.get('/bulk-jobs/:jobId', bulkEmailController.getJobStatus);

// List all jobs for user
router.get('/bulk-jobs', bulkEmailController.listJobs);

// Cancel job
router.delete('/bulk-jobs/:jobId', bulkEmailController.cancelJob);

module.exports = router;
