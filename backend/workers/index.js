require('dotenv').config();
const { initRedisStreams } = require('../config/redis');
const { runWhatsappOutboundWorker } = require('./whatsappOutbound');
const { runEmailOutboundWorker } = require('./emailOutbound');

async function startWorkers() {
    console.log('Initializing Redis streams...');
    await initRedisStreams();

    console.log('Starting workers...');
    
    // Run workers in parallel
    Promise.all([
        runWhatsappOutboundWorker(),
        runEmailOutboundWorker()
    ]).catch(err => {
        console.error('Fatal error in workers:', err);
        process.exit(1);
    });
}

startWorkers();
