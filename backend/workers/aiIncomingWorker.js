/**
 * AI Incoming Message Worker
 * Processes incoming messages from Redis stream and generates AI responses
 */

const { redis, STREAMS, CONSUMER_GROUPS, queueOutgoingMessage } = require('../config/redis');
const { pool } = require('../config/db');
const OpenAI = require('openai');
const {
    getAgentForTenant,
    buildSystemPrompt,
    buildConversationContext
} = require('../ai-agent/services/agentService');
const { getKnowledgeContext } = require('../ai-agent/services/vectorSearchService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // 3. Get AI agent for tenant
    const agent = await getAgentForTenant(tenant_id);
    if (!agent) {
        console.warn(`[AI Worker] No agent configured for tenant ${tenant_id}`);
        return;
    }

    // 4. Build system prompt
    const systemPrompt = await buildSystemPrompt(tenant_id, agent._id);

    // 5. Build conversation context with omnichannel history
    const context = await buildConversationContext(tenant_id, conversation_id, conversation.contact_id);

    // 6. Get conversation history for this conversation
    const historyResult = await pool.query(
        `SELECT role, content_text, channel, created_at FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC 
         LIMIT 20`,
        [conversation_id]
    );

    // 7. Build channel-specific prompt
    const channelPrompt = buildChannelPrompt(channel, conversation, context);

    // 8. Build messages for GPT
    const chatMessages = [
        { role: 'system', content: systemPrompt + '\n\n' + channelPrompt }
    ];

    // Add context about the contact if available
    if (context.contact) {
        chatMessages.push({
            role: 'system',
            content: `Current customer: ${context.contact.name || 'Unknown'}, Email: ${context.contact.email || 'N/A'}, Phone: ${context.contact.phone || 'N/A'}`
        });
    }

    // Add omnichannel history context
    if (context.recentConversations && context.recentConversations.length > 0) {
        const historyContext = context.recentConversations.map(conv => 
            `[${conv.channel}] ${conv.summary || conv.last_message}`
        ).join('\n');
        chatMessages.push({
            role: 'system',
            content: `Previous conversations across channels:\n${historyContext}`
        });
    }

    // Add current conversation history
    for (const msg of historyResult.rows) {
        chatMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content_text
        });
    }

    // 9. Get knowledge context if available
    try {
        const knowledgeContext = await getKnowledgeContext(tenant_id, agent._id, message.content_text);
        if (knowledgeContext) {
            chatMessages.splice(1, 0, {
                role: 'system',
                content: `Relevant knowledge:\n${knowledgeContext}`
            });
        }
    } catch (err) {
        console.log('[AI Worker] Knowledge context not available:', err.message);
    }

    // 10. Generate AI response
    console.log(`[AI Worker] Generating response for ${channel} message...`);
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1024
    });

    const aiResponse = response.choices[0].message.content;
    console.log(`[AI Worker] Generated response: "${aiResponse.substring(0, 100)}..."`);

    // 11. Save AI response as new message
    const responseResult = await pool.query(
        `INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel,
            content_text, provider, status
        ) VALUES ($1, $2, 'outbound', 'assistant', $3, $4, 'openai', 'pending')
        RETURNING id`,
        [tenant_id, conversation_id, channel, aiResponse]
    );

    const responseMessageId = responseResult.rows[0].id;
    console.log(`[AI Worker] Saved response message: ${responseMessageId}`);

    // 12. Update conversation last_message_at
    await pool.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now() WHERE id = $1`,
        [conversation_id]
    );

    // 13. Queue to outbound stream for sending
    await queueOutgoingMessage(responseMessageId, tenant_id, channel);
    console.log(`[AI Worker] Queued message ${responseMessageId} to ${channel} outbound stream`);
}

/**
 * Build channel-specific prompt additions
 */
function buildChannelPrompt(channel, conversation, context) {
    let prompt = '';

    switch (channel) {
        case 'email':
            prompt = `
## CURRENT CHANNEL: EMAIL
You are responding to an email. Keep these in mind:
- Use appropriate email formatting with greeting and sign-off
- Be professional yet friendly
- Can use longer, more detailed responses since it's async communication
- Reference the subject if relevant: "${conversation.subject || 'No subject'}"
- Sign off with your name or the company name

Format your response as plain text suitable for email (not markdown).`;
            break;

        case 'whatsapp':
            prompt = `
## CURRENT CHANNEL: WHATSAPP
You are responding via WhatsApp. Keep these in mind:
- Keep messages concise and conversational
- Use short paragraphs (1-2 sentences max per paragraph)
- Can use emojis sparingly if appropriate 😊
- Avoid formal email-style greetings/sign-offs
- Be quick and helpful - this is real-time messaging

Format your response as plain text suitable for WhatsApp.`;
            break;

        case 'phone':
            prompt = `
## CURRENT CHANNEL: PHONE (Text follow-up)
You are sending a text follow-up after a phone call. Keep these in mind:
- Reference the phone conversation if relevant
- Be concise - this is a follow-up, not a new conversation
- Include any action items or next steps discussed`;
            break;

        default:
            prompt = `
## CURRENT CHANNEL: ${channel.toUpperCase()}
Respond appropriately for this channel.`;
    }

    // Add omnichannel context awareness
    if (context.recentConversations && context.recentConversations.length > 0) {
        prompt += `

## OMNICHANNEL CONTEXT
This customer has contacted you through multiple channels. Be aware of their full history and don't ask for information they've already provided.`;
    }

    return prompt;
}

module.exports = { runAiIncomingWorker };
