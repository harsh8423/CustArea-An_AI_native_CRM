/**
 * Event Worker - Listens to Redis stream for workflow trigger events
 */

const { redis, STREAMS, CONSUMER_GROUPS } = require('../config/redis');
const { pool } = require('../config/db');
const executorPool = require('../engine/executorPool');
const logger = require('../utils/logger');

/**
 * Start the event worker
 */
function startEventWorker() {
    const consumerName = `event-worker-${Math.random().toString(36).substring(7)}`;
    logger.info(`[EventWorker] Starting with consumer name: ${consumerName}`);

    processEvents(consumerName);
}

/**
 * Main event processing loop
 */
async function processEvents(consumerName) {
    while (true) {
        try {
            const streams = await redis.xreadgroup(
                'GROUP', CONSUMER_GROUPS.WORKFLOW_TRIGGER_GROUP, consumerName,
                'BLOCK', 5000,
                'COUNT', 10,
                'STREAMS', STREAMS.WORKFLOW_TRIGGERS,
                '>'
            );

            if (!streams) continue;

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    
                    try {
                        await processEvent(payload);
                        await redis.xack(STREAMS.WORKFLOW_TRIGGERS, CONSUMER_GROUPS.WORKFLOW_TRIGGER_GROUP, id);
                    } catch (err) {
                        logger.error(`[EventWorker] Error processing event ${id}:`, err);
                    }
                }
            }
        } catch (error) {
            logger.error('[EventWorker] Error in event loop:', error);
            await sleep(2000);
        }
    }
}

/**
 * Convert Redis stream fields to object
 */
function fieldsToObject(fields) {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
    }
    return obj;
}

/**
 * Process a single event
 */
async function processEvent(event) {
    // Handle two formats:
    // 1. Direct trigger: { event_type, tenant_id, payload }
    // 2. Message-based: { message_id, tenant_id, conversation_id, channel }
    
    let event_type, tenant_id, payload;
    
    if (event.message_id) {
        // Message-based event from main backend
        const { message_id, conversation_id, channel } = event;
        tenant_id = event.tenant_id;
        
        // Map channel to trigger type
        const channelToTrigger = {
            'whatsapp': 'whatsapp_message',
            'email': 'email_received',
            'phone': 'missed_call',
        };
        event_type = channelToTrigger[channel] || `${channel}_message`;
        
        // Fetch message data with conversation and contact details for payload
        const msgResult = await pool.query(
            `SELECT m.*, c.contact_id, c.channel_contact_id, ct.name as contact_name, ct.email as contact_email
             FROM messages m 
             JOIN conversations c ON c.id = m.conversation_id 
             LEFT JOIN contacts ct ON ct.id = c.contact_id
             WHERE m.id = $1`,
            [message_id]
        );
        
        if (msgResult.rows.length === 0) {
            logger.warn(`[EventWorker] Message ${message_id} not found`);
            return;
        }
        
        const message = msgResult.rows[0];
        
        // Build comprehensive payload with sender info
        payload = {
            message_id,
            conversation_id,
            channel,
            content: message.content_text,
            contact_id: message.contact_id,
            direction: message.direction,
            // Include sender details for trigger nodes
            sender: {
                phone: message.channel_contact_id,  // For WhatsApp, this is the phone number
                email: message.contact_email || message.channel_contact_id,  // For email
                name: message.contact_name || '',
                wa_number: message.channel_contact_id  // WhatsApp number
            },
            message: {
                id: message_id,
                body: message.content_text,
                subject: message.metadata?.subject || ''  // For email
            },
            channel_contact_id: message.channel_contact_id
        };
        
        logger.info(`[EventWorker] Processing message-based event: ${event_type} for tenant ${tenant_id}`);
        logger.info(`[EventWorker] Trigger payload: ${JSON.stringify(payload)}`);
    } else {
        // Direct trigger event
        event_type = event.event_type;
        tenant_id = event.tenant_id;
        payload = JSON.parse(event.payload || '{}');
        
        logger.info(`[EventWorker] Processing direct event: ${event_type} for tenant ${tenant_id}`);
    }

    // Find matching active workflows for this trigger type
    const workflowsResult = await pool.query(`
        SELECT w.*, v.id as version_id, v.nodes, v.edges
        FROM workflows w
        JOIN workflow_versions v ON v.workflow_id = w.id AND v.is_published = true
        WHERE w.tenant_id = $1 
          AND w.status = 'active'
          AND (
            w.trigger_type = $2 
            OR $2 = ANY(w.trigger_types)
          )
        ORDER BY v.version_number DESC
    `, [tenant_id, event_type]);

    if (workflowsResult.rows.length === 0) {
        logger.debug(`[EventWorker] No active workflows for ${event_type} in tenant ${tenant_id}`);
        return;
    }

    // Rate limit check
    const rateResult = await pool.query(`
        SELECT COUNT(*) FROM workflow_runs 
        WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '1 minute'
    `, [tenant_id]);

    if (parseInt(rateResult.rows[0].count) >= 10) {
        logger.warn(`[EventWorker] Tenant ${tenant_id} exceeded rate limit`);
        return;
    }

    // Create runs for each matching workflow
    for (const workflow of workflowsResult.rows) {
        try {
            // Check trigger conditions (if any)
            const triggerConfig = workflow.trigger_config || {};
            if (!matchesTriggerConditions(payload, triggerConfig)) {
                logger.debug(`[EventWorker] Event doesn't match trigger conditions for workflow ${workflow.id}`);
                continue;
            }

            // Create workflow run - include event_type in context for executor
            const runResult = await pool.query(`
                INSERT INTO workflow_runs (workflow_id, version_id, tenant_id, trigger_data, context, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id
            `, [workflow.id, workflow.version_id, tenant_id, JSON.stringify(payload), 
                JSON.stringify({ trigger: payload, event_type: event_type })]);

            const runId = runResult.rows[0].id;
            logger.info(`[EventWorker] Created run ${runId} for workflow ${workflow.name}`);

            // Submit to executor pool
            executorPool.submit(runId);

        } catch (error) {
            logger.error(`[EventWorker] Failed to create run for workflow ${workflow.id}:`, error);
        }
    }
}

/**
 * Check if event payload matches trigger conditions
 */
function matchesTriggerConditions(payload, config) {
    // If no conditions, match all
    if (!config || Object.keys(config).length === 0) {
        return true;
    }

    // Channel filter
    if (config.channels && Array.isArray(config.channels)) {
        if (!config.channels.includes(payload.channel)) {
            return false;
        }
    }

    // Priority filter (for tickets)
    if (config.priority_filter && Array.isArray(config.priority_filter)) {
        if (!config.priority_filter.includes(payload.priority)) {
            return false;
        }
    }

    // Pipeline filter (for leads)
    if (config.pipeline_filter && payload.pipeline_id !== config.pipeline_filter) {
        return false;
    }

    return true;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startEventWorker };
