/**
 * Bulk Phone Call Queue
 * 
 * Bull queue for managing bulk phone call jobs.
 * Each job represents calling one contact group.
 */

const Queue = require('bull');

// Use same Redis URL pattern as bulk email queue
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const phoneCallQueue = new Queue('bulk-phone-calls', REDIS_URL, {
    settings: {
        stalledInterval: 60000,
        maxStalledCount: 2
    },
    defaultJobOptions: {
        attempts: 1, // Don't retry expensive phone calls
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 500, // Keep last 500 failed
        timeout: 24 * 60 * 60 * 1000, // 24 hour timeout (for very large groups)
    }
});

// Event listeners for monitoring
phoneCallQueue.on('error', (error) => {
    console.error('[BulkPhoneQueue] Queue error:', error);
});

phoneCallQueue.on('waiting', (jobId) => {
    console.log(`[BulkPhoneQueue] Job ${jobId} is waiting`);
});

phoneCallQueue.on('active', (job) => {
    console.log(`[BulkPhoneQueue] Job ${job.id} started processing (Group: ${job.data.groupName})`);
});

phoneCallQueue.on('completed', (job, result) => {
    console.log(`[BulkPhoneQueue] Job ${job.id} completed:`, {
        groupName: job.data.groupName,
        completed: result.callsCompleted,
        failed: result.callsFailed
    });
});

phoneCallQueue.on('failed', (job, err) => {
    console.error(`[BulkPhoneQueue] Job ${job.id} failed:`, {
        groupName: job.data.groupName,
        error: err.message
    });
});

phoneCallQueue.on('stalled', (job) => {
    console.warn(`[BulkPhoneQueue] Job ${job.id} stalled`);
});

module.exports = phoneCallQueue;
