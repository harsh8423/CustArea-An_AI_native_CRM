require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { pool, testConnection } = require('./config/db');
const { redis, initRedisStreams, STREAMS } = require('./config/redis');
const logger = require('./utils/logger');

// Routes
const workflowRoutes = require('./routes/workflowRoutes');
const runRoutes = require('./routes/runRoutes');
const triggerRoutes = require('./routes/triggerRoutes');
const nodeDefRoutes = require('./routes/nodeDefRoutes');
const nodeExecutionRoutes = require('./routes/nodeExecutionRoutes');

// Workers
const { startEventWorker } = require('./workers/eventWorker');
const { startSchedulerWorker } = require('./workers/schedulerWorker');

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'workflow-service',
        timestamp: new Date().toISOString()
    });
});

// API Routes - Order matters! More specific routes first
app.use('/api/workflows/runs', runRoutes);
app.use('/api/workflows/trigger', triggerRoutes);
app.use('/api/workflows/node-definitions', nodeDefRoutes);
app.use('/api/workflows', nodeExecutionRoutes);  // Node execution uses /:workflowId/execute-node
app.use('/api/workflows', workflowRoutes);

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 8001;

async function start() {
    try {
        // Test database connection
        logger.info('Testing database connection...');
        await testConnection();
        logger.info('✓ Database connected');

        // Initialize Redis streams
        logger.info('Initializing Redis streams...');
        await initRedisStreams();
        logger.info('✓ Redis streams initialized');

        // Start HTTP server
        app.listen(PORT, () => {
            logger.info(`✓ Workflow service listening on port ${PORT}`);
        });

        // Start workers
        logger.info('Starting workers...');
        startEventWorker();
        startSchedulerWorker();
        logger.info('✓ Workers started');

    } catch (error) {
        logger.error('Failed to start workflow service:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await redis.quit();
    await pool.end();
    process.exit(0);
});

start();
