const Redis = require('ioredis');

// Create Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

redis.on('connect', () => {
    console.log('Redis connected');
});

// Stream names for message processing
const STREAMS = {
    INCOMING: 'stream:incoming_messages',
    OUTGOING_WHATSAPP: 'stream:outgoing:whatsapp',
    OUTGOING_EMAIL: 'stream:outgoing:email',
};

// Consumer groups for parallel processing
const CONSUMER_GROUPS = {
    INCOMING_PROCESSORS: 'incoming_processors',
    OUTGOING_WHATSAPP_GROUP: 'outgoing_whatsapp_group',
    OUTGOING_EMAIL_GROUP: 'outgoing_email_group',
};

/**
 * Initialize Redis streams and consumer groups
 */
async function initRedisStreams() {
    const groupsToCreate = [
        { stream: STREAMS.INCOMING, group: CONSUMER_GROUPS.INCOMING_PROCESSORS },
        { stream: STREAMS.OUTGOING_WHATSAPP, group: CONSUMER_GROUPS.OUTGOING_WHATSAPP_GROUP },
        { stream: STREAMS.OUTGOING_EMAIL, group: CONSUMER_GROUPS.OUTGOING_EMAIL_GROUP },
    ];

    for (const { stream, group } of groupsToCreate) {
        try {
            await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
            console.log(`Created consumer group: ${group} for stream: ${stream}`);
        } catch (err) {
            if (err.message && err.message.includes('BUSYGROUP')) {
                // Group already exists, ignore
            } else {
                console.error(`Error creating group ${group} for stream ${stream}:`, err);
            }
        }
    }
}

/**
 * Add message to incoming stream for processing
 */
async function queueIncomingMessage(messageId, tenantId, conversationId, channel) {
    return redis.xadd(
        STREAMS.INCOMING,
        '*',
        'message_id', messageId,
        'tenant_id', tenantId,
        'conversation_id', conversationId,
        'channel', channel
    );
}

/**
 * Add message to outgoing stream for sending
 */
async function queueOutgoingMessage(messageId, tenantId, channel) {
    let streamKey;
    if (channel === 'whatsapp') {
        streamKey = STREAMS.OUTGOING_WHATSAPP;
    } else if (channel === 'email') {
        streamKey = STREAMS.OUTGOING_EMAIL;
    } else {
        console.warn(`Unknown channel for outgoing message: ${channel}`);
        return null;
    }

    return redis.xadd(
        streamKey,
        '*',
        'message_id', messageId,
        'tenant_id', tenantId,
        'channel', channel
    );
}

module.exports = {
    redis,
    STREAMS,
    CONSUMER_GROUPS,
    initRedisStreams,
    queueIncomingMessage,
    queueOutgoingMessage
};
