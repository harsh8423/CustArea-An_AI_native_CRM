/**
 * Executor Pool - Manages concurrent workflow executions
 */

const { executeRun } = require('./executor');
const logger = require('../utils/logger');

class ExecutorPool {
    constructor() {
        this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_RUNS) || 50;
        this.activeRuns = new Map();
        this.queue = [];
    }

    /**
     * Submit a run for execution
     */
    async submit(runId) {
        if (this.activeRuns.size >= this.maxConcurrent) {
            logger.info(`[Pool] Queue full, adding run ${runId} to queue`);
            return new Promise((resolve, reject) => {
                this.queue.push({ runId, resolve, reject });
            });
        }

        return this.executeNow(runId);
    }

    /**
     * Execute a run immediately
     */
    async executeNow(runId) {
        logger.info(`[Pool] Starting run ${runId} (${this.activeRuns.size + 1}/${this.maxConcurrent} active)`);
        
        const execution = executeRun(runId);
        this.activeRuns.set(runId, execution);

        try {
            const result = await execution;
            return result;
        } finally {
            this.activeRuns.delete(runId);
            this.processQueue();
        }
    }

    /**
     * Process queued runs
     */
    processQueue() {
        while (this.queue.length > 0 && this.activeRuns.size < this.maxConcurrent) {
            const { runId, resolve, reject } = this.queue.shift();
            this.executeNow(runId).then(resolve).catch(reject);
        }
    }

    /**
     * Get pool status
     */
    getStatus() {
        return {
            active: this.activeRuns.size,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent
        };
    }
}

// Singleton instance
const pool = new ExecutorPool();

module.exports = pool;
