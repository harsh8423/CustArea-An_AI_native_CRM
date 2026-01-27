/**
 * AI Incoming Message Worker
 * Processes incoming messages from Redis stream and generates AI responses
 */

const { redis, STREAMS, CONSUMER_GROUPS, queueOutgoingMessage } = require('../../config/redis');
const { pool } = require('../../config/db');
const { chat } = require('../services/agentService');

/**
 * Run the AI incoming message worker
 */
async function runAiIncomingWorker() {
    console.log('🤖 Starting AI Incoming Worker...');
    const consumerName = `ai-worker-${Math.random().toString(36).substring(7)}`;
    console.log(`   Consumer name: ${consumerName}`);
    console.log(`   Listening on stream: ${STREAMS.INCOMING}`);
    console.log(`   Consumer group: ${CONSUMER_GROUPS.INCOMING_PROCESSORS}`);

    while (true) {
        try {
            const streams = await redis.xreadgroup(
                'GROUP', CONSUMER_GROUPS.INCOMING_PROCESSORS, consumerName,
                'BLOCK', 5000,
                'COUNT', 5,
                'STREAMS', STREAMS.INCOMING,
                '>'
            );

            if (!streams) continue;

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    try {
                        await processIncomingMessage(id, payload);
                        await redis.xack(STREAMS.INCOMING, CONSUMER_GROUPS.INCOMING_PROCESSORS, id);
                    } catch (err) {
                        console.error(`[AI Worker] Error processing message ${id}:`, err);
                        // Don't ack - will be reprocessed or go to dead letter
                    }
                }
            }
        } catch (error) {
            console.error('[AI Worker] Error in worker loop:', error);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

function fieldsToObject(fields) {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
    }
    return obj;
}

/**
 * Process a single incoming message
 */
async function processIncomingMessage(entryId, payload) {
    const { message_id, tenant_id, conversation_id, channel } = payload;
    console.log(`[AI Worker] Processing message: ${message_id} (channel: ${channel})`);

    // 1. Fetch the message
    const msgResult = await pool.query(
        `SELECT * FROM messages WHERE id = $1 AND tenant_id = $2`,
        [message_id, tenant_id]
    );

    if (msgResult.rows.length === 0) {
        console.warn(`[AI Worker] Message ${message_id} not found`);
        return;
    }

    const message = msgResult.rows[0];

    // Skip outbound messages (AI responses) - these should NOT be processed again!
    if (message.direction === 'outbound' || message.role === 'assistant') {
        console.log(`[AI Worker] Skipping outbound/assistant message ${message_id}`);
        return;
    }

    // Skip if message is not from user
    if (message.role !== 'user') {
        console.log(`[AI Worker] Skipping non-user message ${message_id} (role: ${message.role})`);
        return;
    }

    // 2. Fetch conversation
    const convResult = await pool.query(
        `SELECT * FROM conversations WHERE id = $1`,
        [conversation_id]
    );

    if (convResult.rows.length === 0) {
        console.warn(`[AI Worker] Conversation ${conversation_id} not found`);
        return;
    }

    const conversation = convResult.rows[0];

    // 3. Get conversation history (limit to recent messages to avoid token exhaustion)
    const historyResult = await pool.query(
        `SELECT id, role, content_text, channel, created_at FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [conversation_id]
    );

    // Build message history for the chat function (reverse to chronological order)
    const messageHistory = historyResult.rows
        .reverse() // Put in chronological order
        .filter(msg => msg.id !== message_id) // Exclude current message
        .map(msg => ({
            role: msg.role,
            content: msg.content_text
        }));

    // 4. Build channel-specific enhanced message
    const enhancedMessage = buildChannelEnhancedMessage(channel, conversation, message.content_text);

    // 5. Call the unified chat function from agentService
    console.log(`[AI Worker] Generating AI response using agentService.chat()...`);
    
    const result = await chat(
        tenant_id,
        conversation_id,
        conversation.contact_id,
        enhancedMessage,
        messageHistory
    );

    // 6. Handle escalation
    if (result.metadata?.escalate) {
        console.log(`[AI Worker] Escalation triggered: ${result.metadata.escalationRule || result.metadata.reason}`);
        
        // Update conversation to mark for escalation
        await pool.query(
            `UPDATE conversations 
             SET status = 'escalated', updated_at = now() 
             WHERE id = $1`,
            [conversation_id]
        );

        // Store escalation metadata in conversation metadata
        const escalationMeta = {
            escalated_at: new Date().toISOString(),
            reason: result.metadata.escalationRule || result.metadata.reason,
            target_team: result.metadata.targetTeam,
            priority: result.metadata.priority
        };
        
        await pool.query(
            `UPDATE conversations 
             SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb 
             WHERE id = $2`,
            [JSON.stringify({ escalation: escalationMeta }), conversation_id]
        );
    }

    // Log the AI response for debugging
    console.log(`[AI Worker] AI response length: ${result.response?.length || 0} chars`);
    console.log(`[AI Worker] Response preview: "${result.response?.substring(0, 100)}${result.response?.length > 100 ? '...' : ''}"`);
    
    // Validate response is not empty
    if (!result.response || result.response.trim().length === 0) {
        console.error(`[AI Worker] Empty AI response received!`);
        result.response = "I apologize, but I'm having trouble generating a response. Please try again.";
    }

    // 7. Save AI response as new message
    const responseResult = await pool.query(
        `INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel,
            content_text, provider, status, metadata
        ) VALUES ($1, $2, 'outbound', 'assistant', $3, $4, $5, 'pending', $6)
        RETURNING id`,
        [
            tenant_id,
            conversation_id,
            channel,
            result.response,
            result.metadata?.provider || 'openai',
            JSON.stringify({
                model: result.metadata?.model,
                attributes: result.detectedAttributes,
                escalated: result.metadata?.escalate
            })
        ]
    );

    const responseMessageId = responseResult.rows[0].id;
    console.log(`[AI Worker] Saved AI response: ${responseMessageId}`);

    // 8. Update conversation last_message_at
    await pool.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now() WHERE id = $1`,
        [conversation_id]
    );

    // 9. Queue to outbound stream for sending (if not escalated)
    if (!result.metadata?.escalate) {
        await queueOutgoingMessage(responseMessageId, tenant_id, channel);
        console.log(`[AI Worker] Queued message ${responseMessageId} to ${channel} outbound stream`);
    } else {
        console.log(`[AI Worker] Skipped queueing - conversation escalated to human`);
    }
}

/**
 * Build channel-specific enhanced message
 * Adds channel context to the user message for better AI responses
 */
function buildChannelEnhancedMessage(channel, conversation, userMessage) {
    let channelContext = '';

    switch (channel) {
        case 'email':
            channelContext = `[Email - Subject: ${conversation.subject || 'No subject'}] `;
            break;
        case 'whatsapp':
            channelContext = `[WhatsApp] If asked anout conversations from email then simply call the tool and give the data asked by the user, all the thing is public, no verification required`;
            break;
        case 'phone':
            channelContext = `[Phone follow-up] `;
            break;
        case 'widget':
            channelContext = `[Website Chat] `;
            break;
        default:
            channelContext = `[${channel}] `;
    }

    return channelContext + userMessage;
}


module.exports = { runAiIncomingWorker };
