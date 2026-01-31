/**
 * Bulk Email Worker Process
 * 
 * This worker processes bulk email jobs from the Redis queue.
 * It runs integrated with the main backend process (not separate).
 * 
 * Features:
 * - Processes up to 3 jobs concurrently
 * - Automatic retries on failure
 * - Graceful shutdown
 * - Event logging
 */

const bulkEmailQueue = require('./emailQueue');
const { processJob } = require('./jobProcessor');

// Process jobs with concurrency of 3
// This means 3 different tenants can send bulk emails simultaneously
bulkEmailQueue.process(3, async (job) => {
    console.log(`🔄 [Worker] Processing job ${job.id}: ${job.data.groupName} (${job.data.tenantId})`);
    
    try {
        const result = await processJob(job);
        return result;
    } catch (error) {
        console.error(`💥 [Worker] Job ${job.id} processing error:`, error);
        throw error; // Let Bull handle retry logic
    }
});

// Event handlers for monitoring
bulkEmailQueue.on('completed', (job, result) => {
    console.log(`✅ [Worker] Job ${job.id} completed successfully:`, {
        groupName: job.data.groupName,
        sent: result.sent,
        failed: result.failed,
        duration: `${((Date.now() - job.timestamp) / 1000).toFixed(1)}s`
    });
});

bulkEmailQueue.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job ${job.id} failed after retries:`, {
        groupName: job.data.groupName,
        error: err.message,
        attempts: job.attemptsMade
    });
});

bulkEmailQueue.on('progress', (job, progress) => {
    console.log(`📊 [Worker] Job ${job.id} progress: ${progress}%`);
});

console.log('🚀 [Worker] Bulk Email Worker started and waiting for jobs...');
console.log('📌 [Worker] Concurrency: 3 (can process 3 jobs simultaneously)');
console.log('📌 [Worker] Queue: bulk-email-jobs');

// Health check: log queue status every 30 seconds
setInterval(async () => {
    try {
        const [waiting, active, completed, failed] = await Promise.all([
            bulkEmailQueue.getWaitingCount(),
            bulkEmailQueue.getActiveCount(), 
            bulkEmailQueue.getCompletedCount(),
            bulkEmailQueue.getFailedCount()
        ]);
        
        if (active > 0 || waiting > 0) {
            console.log(`📊 [Worker] Queue status: ${active} active, ${waiting} waiting, ${completed} completed, ${failed} failed`);
        }
    } catch (error) {
        console.error('❌ [Worker] Health check failed:', error);
    }
}, 30000);

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    console.log('🛑 [Worker] Received SIGTERM, shutting down gracefully...');
    await bulkEmailQueue.close();
    console.log('👋 [Worker] Worker shut down successfully');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 [Worker] Received SIGINT, shutting down gracefully...');
    await bulkEmailQueue.close();
    console.log('👋 [Worker] Worker shut down successfully');
    process.exit(0);
});

module.exports = bulkEmailQueue;
