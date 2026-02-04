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
    WORKFLOW_TRIGGERS: 'stream:workflow_triggers',  // New: for workflow processing
    OUTGOING_WHATSAPP: 'stream:outgoing:whatsapp',
    OUTGOING_EMAIL: 'stream:outgoing:email',
};

// Consumer groups for parallel processing
const CONSUMER_GROUPS = {
    INCOMING_PROCESSORS: 'incoming_processors',
    WORKFLOW_PROCESSORS: 'workflow_processors',  // New: for workflow service
    OUTGOING_WHATSAPP_GROUP: 'outgoing_whatsapp_group',
    OUTGOING_EMAIL_GROUP: 'outgoing_email_group',
};

/**
 * Initialize Redis streams and consumer groups
 */
async function initRedisStreams() {
    const groupsToCreate = [
        { stream: STREAMS.INCOMING, group: CONSUMER_GROUPS.INCOMING_PROCESSORS },
        { stream: STREAMS.WORKFLOW_TRIGGERS, group: CONSUMER_GROUPS.WORKFLOW_PROCESSORS },
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
 * Add message to appropriate stream based on workflow existence
 * @param {string} messageId 
 * @param {string} tenantId 
 * @param {string} conversationId 
 * @param {string} channel 
 * @param {boolean} hasWorkflowTrigger - Whether tenant has active workflow for this trigger
 * @param {object} triggerData - Full trigger context (sender, message, etc.)
 * @param {string} agentType - Type of AI agent ('default' | 'campaign')
 * @param {string} campaignId - Campaign ID (if agentType is 'campaign')
 */
async function queueIncomingMessage(
    messageId, 
    tenantId, 
    conversationId, 
    channel, 
    hasWorkflowTrigger = false, 
    triggerData = null,
    agentType = 'default',
    campaignId = null
) {
    // Route to workflow stream if tenant has active workflow trigger
    const stream = hasWorkflowTrigger ? STREAMS.WORKFLOW_TRIGGERS : STREAMS.INCOMING;
    
    console.log(`[Redis] Routing message ${messageId} to ${stream} (hasWorkflow: ${hasWorkflowTrigger}, agentType: ${agentType})`);
    
    // Build base fields
    const fields = [
        'message_id', messageId,
        'tenant_id', tenantId,
        'conversation_id', conversationId,
        'channel', channel
    ];
    
    // Add agent type for campaign AI routing
    if (agentType) {
        fields.push('agent_type', agentType);
    }
    
    // Add campaign ID if this is a campaign reply
    if (campaignId) {
        fields.push('campaign_id', campaignId);
    }
    
    // Add trigger data for workflow processing
    if (hasWorkflowTrigger && triggerData) {
        fields.push('trigger_data', JSON.stringify(triggerData));
    }
    
    return redis.xadd(stream, '*', ...fields);
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
