/**
 * Scheduler - Polls for scheduled jobs and resumes delayed workflows
 */

const { pool } = require('../config/db');
const executorPool = require('./executorPool');
const logger = require('../utils/logger');

class Scheduler {
    constructor() {
        this.pollInterval = parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS) || 5000;
        this.running = false;
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.poll();
        logger.info('[Scheduler] Started');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        this.running = false;
        logger.info('[Scheduler] Stopped');
    }

    /**
     * Poll for due jobs
     */
    async poll() {
        while (this.running) {
            try {
                await this.processJobs();
            } catch (error) {
                logger.error('[Scheduler] Error processing jobs:', error);
            }
            await this.sleep(this.pollInterval);
        }
    }

    /**
     * Process all due jobs
     */
    async processJobs() {
        // Find jobs that are due
        const result = await pool.query(`
            UPDATE workflow_scheduled_jobs
            SET status = 'processing'
            WHERE id IN (
                SELECT id FROM workflow_scheduled_jobs
                WHERE status = 'pending' AND resume_at <= now()
                ORDER BY resume_at
                LIMIT 10
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `);

        for (const job of result.rows) {
            try {
                await this.processJob(job);
                await pool.query(`
                    UPDATE workflow_scheduled_jobs
                    SET status = 'processed', processed_at = now()
                    WHERE id = $1
                `, [job.id]);
            } catch (error) {
                logger.error(`[Scheduler] Failed to process job ${job.id}:`, error);
                await pool.query(`
                    UPDATE workflow_scheduled_jobs
                    SET status = 'failed', error_message = $1
                    WHERE id = $2
                `, [error.message, job.id]);
            }
        }
    }

    /**
     * Process a single job
     */
    async processJob(job) {
        logger.info(`[Scheduler] Processing job ${job.id} (type: ${job.job_type})`);

        switch (job.job_type) {
            case 'delay_resume':
                // Resume a paused workflow
                await this.resumeWorkflow(job);
                break;

            case 'scheduled_trigger':
                // Create a new run for scheduled workflow
                await this.triggerScheduledWorkflow(job);
                break;

            default:
                throw new Error(`Unknown job type: ${job.job_type}`);
        }
    }

    /**
     * Resume a paused workflow
     */
    async resumeWorkflow(job) {
        // Update the run to set current_node_id and status
        await pool.query(`
            UPDATE workflow_runs
            SET current_node_id = $1, status = 'pending'
            WHERE id = $2
        `, [job.resume_node_id, job.run_id]);

        // Submit to executor pool
        executorPool.submit(job.run_id);
    }

    /**
     * Trigger a scheduled workflow
     */
    async triggerScheduledWorkflow(job) {
        // Get the workflow and its published version
        const wfResult = await pool.query(`
            SELECT w.*, v.id as version_id
            FROM workflows w
            JOIN workflow_versions v ON v.workflow_id = w.id AND v.is_published = true
            WHERE w.id = $1 AND w.status = 'active'
            ORDER BY v.version_number DESC
            LIMIT 1
        `, [job.workflow_id]);

        if (wfResult.rows.length === 0) {
            throw new Error(`No active published workflow found: ${job.workflow_id}`);
        }

        const workflow = wfResult.rows[0];

        // Create a new run
        const runResult = await pool.query(`
            INSERT INTO workflow_runs (workflow_id, version_id, tenant_id, trigger_data)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [workflow.id, workflow.version_id, workflow.tenant_id, { triggered_at: new Date().toISOString() }]);

        // Submit to executor pool
        executorPool.submit(runResult.rows[0].id);

        // Schedule next run based on cron expression
        // TODO: Parse cron and schedule next
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
const scheduler = new Scheduler();

module.exports = scheduler;
