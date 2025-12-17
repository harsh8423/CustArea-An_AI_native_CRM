require('dotenv').config();
const { initRedisStreams } = require('../config/redis');
const { runWhatsappOutboundWorker } = require('./whatsappOutbound');
const { runEmailOutboundWorker } = require('./emailOutbound');
const { runAiIncomingWorker } = require('./aiIncomingWorker');

async function startWorkers() {
    console.log('Initializing Redis streams...');
    await initRedisStreams();
    console.log('✓ Redis streams initialized');

    console.log('Starting outbound workers...');
    
    // Run all workers in parallel
    Promise.all([
        runWhatsappOutboundWorker(),
        runEmailOutboundWorker(),
        runAiIncomingWorker()
    ]).catch(err => {
        console.error('Fatal error in workers:', err);
        process.exit(1);
    });

    console.log('✓ All workers started');
}

startWorkers();
