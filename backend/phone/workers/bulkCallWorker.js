/**
 * Bulk Phone Call Worker
 * 
 * Consumes jobs from the bulk-phone-calls queue
 * and processes them using bulkCallJobProcessor
 */

const phoneCallQueue = require('./phoneCallQueue');
const { processJob } = require('./bulkCallJobProcessor');

console.log('🚀 [BulkCallWorker] Initializing...');

// Process up to 3 jobs concurrently (3 different tenants)
phoneCallQueue.process(3, async (job) => {
    console.log(`🎯 [BulkCallWorker] Processing job ${job.id}`);
    
    try {
        const result = await processJob(job);
        
        console.log(`✅ [BulkCallWorker] Job ${job.id} completed successfully`);
        return result;
        
    } catch (error) {
        console.error(`❌ [BulkCallWorker] Job ${job.id} failed:`, error.message);
        throw error; // Bull will mark job as failed
    }
});

// Global queue events
phoneCallQueue.on('completed', (job, result) => {
    console.log(`✅ [Worker] Job ${job.data.jobId} completed:`, {
        groupName: job.data.groupName,
        completed: result.callsCompleted,
        failed: result.callsFailed
    });
});

phoneCallQueue.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job ${job.data.jobId} failed:`, {
        groupName: job.data.groupName,
        error: err.message
    });
});

phoneCallQueue.on('error', (error) => {
    console.error('💥 [Worker] Queue error:', error);
});

console.log('🚀 [BulkCallWorker] Worker started and waiting for jobs...');
console.log('📌 [Worker] Concurrency: 3 (can process 3 jobs simultaneously)');
console.log('📌 [Worker] Queue: bulk-phone-calls');

module.exports = phoneCallQueue;
