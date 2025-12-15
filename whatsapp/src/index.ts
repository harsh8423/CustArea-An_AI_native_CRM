import { config } from './config/env';
import { createServer } from './http/server';
import { initRedisStreams } from './redis/client';
import { runIncomingProcessor } from './workers/incomingProcessor';
import { runOutgoingSender } from './workers/outgoingSender';
import { db } from './db/client';

async function main() {
    console.log('Starting WhatsApp Multi-tenant Backend...');

    // 1. Initialize Redis Streams
    await initRedisStreams();

    // 2. Start Workers
    // We can start multiple consumers if we want, for now just one of each
    runIncomingProcessor('worker-1').catch(err => console.error('Incoming Worker crashed:', err));
    runOutgoingSender('worker-1').catch(err => console.error('Outgoing Worker crashed:', err));

    // 3. Start HTTP Server
    const app = createServer();
    app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down...');
        await db.end();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch(err => {
    console.error('Fatal error during startup:', err);
    process.exit(1);
});
