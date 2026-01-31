/**
 * Bull Queue Configuration for Bulk Email Jobs
 * 
 * This queue manages bulk email sending jobs with:
 * - Multi-tenant isolation
 * - Retry logic for failed deliveries
 * - Job persistence in Redis
 * - Concurrent processing
 */

const Bull = require('bull');
const Redis = require('ioredis');

// Import existing Redis configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Bull queue with Redis connection
const bulkEmailQueue = new Bull('bulk-email-jobs', redisUrl, {
    defaultJobOptions: {
        attempts: 3,                    // Retry failed jobs up to 3 times
        backoff: {
            type: 'exponential',        // Exponential backoff: 2s, 4s, 8s
            delay: 2000                 // Initial delay of 2 seconds
        },
        removeOnComplete: 100,          // Keep last 100 completed jobs for history
        removeOnFail: 500,              // Keep last 500 failed jobs for debugging
        timeout: 3600000                // Job timeout: 1 hour (for large batches)
    },
    settings: {
        stalledInterval: 30000,         // Check for stalled jobs every 30 seconds
        maxStalledCount: 2              // Retry stalled jobs twice
    }
});

// Event logging
bulkEmailQueue.on('error', (error) => {
    console.error('❌ [BulkEmailQueue] Queue error:', error);
});

bulkEmailQueue.on('waiting', (jobId) => {
    console.log(`⏳ [BulkEmailQueue] Job ${jobId} is waiting`);
});

bulkEmailQueue.on('active', (job) => {
    console.log(`▶️  [BulkEmailQueue] Job ${job.id} started (Group: ${job.data.groupName})`);
});

bulkEmailQueue.on('completed', (job, result) => {
    console.log(`✅ [BulkEmailQueue] Job ${job.id} completed:`, {
        sent: result.sent,
        failed: result.failed,
        duration: `${((Date.now() - job.timestamp) / 1000).toFixed(1)}s`
    });
});

bulkEmailQueue.on('failed', (job, err) => {
    console.error(`❌ [BulkEmailQueue] Job ${job.id} failed:`, err.message);
});

bulkEmailQueue.on('stalled', (job) => {
    console.warn(`⚠️  [BulkEmailQueue] Job ${job.id} stalled (will retry)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 [BulkEmailQueue] Shutting down gracefully...');
    await bulkEmailQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 [BulkEmailQueue] Shutting down gracefully...');
    await bulkEmailQueue.close();
    process.exit(0);
});

module.exports = bulkEmailQueue;
