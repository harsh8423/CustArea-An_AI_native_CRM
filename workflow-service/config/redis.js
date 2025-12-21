const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

redis.on('connect', () => {
    console.log('Redis connected');
});

// Stream names
const STREAMS = {
    // Listen to these from main backend
    WORKFLOW_TRIGGERS: 'stream:workflow_triggers',
    
    // Push to these (existing backend workers consume)
    OUTGOING_WHATSAPP: 'stream:outgoing:whatsapp',
    OUTGOING_EMAIL: 'stream:outgoing:email',
};

// Consumer groups
const CONSUMER_GROUPS = {
    WORKFLOW_TRIGGER_GROUP: 'workflow_trigger_processors',
};

/**
 * Initialize Redis streams and consumer groups
 */
async function initRedisStreams() {
    const groupsToCreate = [
        { stream: STREAMS.WORKFLOW_TRIGGERS, group: CONSUMER_GROUPS.WORKFLOW_TRIGGER_GROUP },
    ];

    for (const { stream, group } of groupsToCreate) {
        try {
            await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
            console.log(`Created consumer group: ${group} for stream: ${stream}`);
        } catch (err) {
            if (err.message && err.message.includes('BUSYGROUP')) {
                // Group already exists, ignore
            } else {
                console.error(`Error creating group ${group}:`, err);
            }
        }
    }
}

/**
 * Emit a trigger event (called by main backend)
 */
async function emitTriggerEvent(eventType, tenantId, payload) {
    return redis.xadd(
        STREAMS.WORKFLOW_TRIGGERS,
        '*',
        'event_type', eventType,
        'tenant_id', tenantId,
        'payload', JSON.stringify(payload),
        'timestamp', new Date().toISOString()
    );
}

/**
 * Queue outgoing WhatsApp message (uses existing worker)
 */
async function queueWhatsAppMessage(messageId, tenantId) {
    return redis.xadd(
        STREAMS.OUTGOING_WHATSAPP,
        '*',
        'message_id', messageId,
        'tenant_id', tenantId,
        'channel', 'whatsapp'
    );
}

/**
 * Queue outgoing email (uses existing worker)
 */
async function queueEmailMessage(messageId, tenantId) {
    return redis.xadd(
        STREAMS.OUTGOING_EMAIL,
        '*',
        'message_id', messageId,
        'tenant_id', tenantId,
        'channel', 'email'
    );
}

module.exports = {
    redis,
    STREAMS,
    CONSUMER_GROUPS,
    initRedisStreams,
    emitTriggerEvent,
    queueWhatsAppMessage,
    queueEmailMessage,
};
