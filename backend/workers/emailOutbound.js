const { redis, STREAMS, CONSUMER_GROUPS } = require('../config/redis');
const { pool } = require('../config/db');
const sesSendService = require('../services/sesSendService');

async function runEmailOutboundWorker() {
    console.log('Starting Email Outbound Worker...');
    const consumerName = `worker-${Math.random().toString(36).substring(7)}`;

    while (true) {
        try {
            const streams = await redis.xreadgroup(
                'GROUP', CONSUMER_GROUPS.OUTGOING_EMAIL_GROUP, consumerName,
                'BLOCK', 5000,
                'COUNT', 10,
                'STREAMS', STREAMS.OUTGOING_EMAIL,
                '>'
            );

            if (!streams) continue;

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    try {
                        await handleEmailJob(id, payload);
                        await redis.xack(STREAMS.OUTGOING_EMAIL, CONSUMER_GROUPS.OUTGOING_EMAIL_GROUP, id);
                    } catch (err) {
                        console.error(`Error processing Email message ${id}:`, err);
                    }
                }
            }
        } catch (error) {
            console.error('Error in Email outbound worker loop:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
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

async function handleEmailJob(entryId, payload) {
    const { message_id, tenant_id } = payload;

    // 1. Fetch message details
    const msgResult = await pool.query(
        `SELECT * FROM messages WHERE id = $1 AND tenant_id = $2`,
        [message_id, tenant_id]
    );

    if (msgResult.rows.length === 0) {
        console.warn(`Message ${message_id} not found`);
        return;
    }

    const message = msgResult.rows[0];
    if (message.status !== 'pending') {
        console.log(`Message ${message_id} already processed (status: ${message.status})`);
        return;
    }

    // 2. Fetch conversation to get recipient
    const convResult = await pool.query(
        `SELECT * FROM conversations WHERE id = $1`,
        [message.conversation_id]
    );
    
    if (convResult.rows.length === 0) {
        console.error(`Conversation ${message.conversation_id} not found for message ${message_id}`);
        return;
    }
    const conversation = convResult.rows[0];
    const to = conversation.channel_contact_id; // This should be the email address

    // 3. Prepare email input
    // We might need to fetch metadata if there are specific headers or from address overrides
    // For now, we use the defaults handled by sesSendService or simple logic
    
    const emailInput = {
        tenantId: tenant_id,
        to: to,
        subject: conversation.subject || 'New Message', // Fallback subject
        html: message.content_html,
        text: message.content_text
    };

    // 4. Send via SES Service
    try {
        const result = await sesSendService.sendTenantEmail(emailInput);

        // 5. Update message status
        // Note: sesSendService already inserts into outbound_emails, but we also need to update the main messages table
        await pool.query(
            `UPDATE messages 
             SET status = 'sent', provider_message_id = $1, sent_at = now() 
             WHERE id = $2`,
            [result.sesMessageId, message_id]
        );

        // 6. Update metadata
        await pool.query(
            `INSERT INTO message_email_metadata (message_id, ses_message_id, to_addresses)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_id) DO UPDATE SET
                ses_message_id = EXCLUDED.ses_message_id`,
            [message_id, result.sesMessageId, JSON.stringify([{ email: to }])]
        );

        console.log(`Email message ${message_id} sent successfully. SES ID: ${result.sesMessageId}`);

    } catch (err) {
        console.error(`Failed to send Email message ${message_id}:`, err);
        
        await pool.query(
            `UPDATE messages 
             SET status = 'failed', error_message = $1 
             WHERE id = $2`,
            [err.message, message_id]
        );
    }
}

module.exports = { runEmailOutboundWorker };
