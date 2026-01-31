/**
 * Bulk Phone Call Routes
 * 
 * Routes for managing bulk phone call jobs
 */

const express = require('express');
const router = express.Router();
const bulkPhoneCallController = require('../controllers/bulkPhoneCallController');
const authenticateToken = require('../../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Start bulk call job
router.post('/bulk-call', bulkPhoneCallController.startBulkCall);

// Get job status
router.get('/bulk-jobs/:jobId', bulkPhoneCallController.getJobStatus);

// List all jobs
router.get('/bulk-jobs', bulkPhoneCallController.listJobs);

// Pause job
router.post('/bulk-jobs/:jobId/pause', bulkPhoneCallController.pauseJob);

// Resume job
router.post('/bulk-jobs/:jobId/resume', bulkPhoneCallController.resumeJob);

// Cancel job
router.delete('/bulk-jobs/:jobId', bulkPhoneCallController.cancelJob);

module.exports = router;
