/**
 * Scheduler Worker - Polls for and processes scheduled jobs
 */

const scheduler = require('../engine/scheduler');
const logger = require('../utils/logger');

/**
 * Start the scheduler worker
 */
function startSchedulerWorker() {
    logger.info('[SchedulerWorker] Starting...');
    scheduler.start();
}

/**
 * Stop the scheduler worker
 */
function stopSchedulerWorker() {
    scheduler.stop();
}

module.exports = { startSchedulerWorker, stopSchedulerWorker };
