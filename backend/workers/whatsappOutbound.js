const { redis, STREAMS, CONSUMER_GROUPS } = require('../config/redis');
const { pool } = require('../config/db');
const whatsappService = require('../services/whatsappService');

async function runWhatsappOutboundWorker() {
    console.log('🚀 Starting WhatsApp Outbound Worker...');
    const consumerName = `worker-${Math.random().toString(36).substring(7)}`;
    console.log(`   Consumer name: ${consumerName}`);
    console.log(`   Listening on stream: ${STREAMS.OUTGOING_WHATSAPP}`);
    console.log(`   Consumer group: ${CONSUMER_GROUPS.OUTGOING_WHATSAPP_GROUP}`);

    while (true) {
        try {
            const streams = await redis.xreadgroup(
                'GROUP', CONSUMER_GROUPS.OUTGOING_WHATSAPP_GROUP, consumerName,
                'BLOCK', 5000,
                'COUNT', 10,
                'STREAMS', STREAMS.OUTGOING_WHATSAPP,
                '>'
            );

            if (!streams) {
                // No messages, continue polling
                continue;
            }

            console.log(`📨 WhatsApp worker received ${streams.length} stream(s) with messages`);

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    try {
                        await handleWhatsappJob(id, payload);
                        await redis.xack(STREAMS.OUTGOING_WHATSAPP, CONSUMER_GROUPS.OUTGOING_WHATSAPP_GROUP, id);
                    } catch (err) {
                        console.error(`Error processing WhatsApp message ${id}:`, err);
                        // Optionally handle retry logic or dead letter queue here
                    }
                }
            }
        } catch (error) {
            console.error('Error in WhatsApp outbound worker loop:', error);
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

async function handleWhatsappJob(entryId, payload) {
    const { message_id, tenant_id } = payload;
    console.log(`📤 Processing WhatsApp job: message_id=${message_id}, tenant_id=${tenant_id}`);

    // 1. Fetch message details
    const msgResult = await pool.query(
        `SELECT * FROM messages WHERE id = $1 AND tenant_id = $2`,
        [message_id, tenant_id]
    );

    if (msgResult.rows.length === 0) {
        console.warn(`⚠️ Message ${message_id} not found in database`);
        return;
    }

    const message = msgResult.rows[0];
    console.log(`   Message status: ${message.status}, content: "${message.content_text?.substring(0, 50)}..."`);
    
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
    const to = conversation.channel_contact_id; // This should be the phone number

    // 3. Send via WhatsApp Service
    try {
        const result = await whatsappService.sendMessage(tenant_id, to, message.content_text);

        // 4. Update message status
        await pool.query(
            `UPDATE messages 
             SET status = 'sent', provider_message_id = $1, sent_at = now() 
             WHERE id = $2`,
            [result.twilioMessageSid, message_id]
        );

        // 5. Update metadata
        await pool.query(
            `INSERT INTO message_whatsapp_metadata (message_id, twilio_message_sid, wa_number)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_id) DO UPDATE SET
                twilio_message_sid = EXCLUDED.twilio_message_sid,
                wa_number = EXCLUDED.wa_number`,
            [message_id, result.twilioMessageSid, to]
        );

        console.log(`WhatsApp message ${message_id} sent successfully. SID: ${result.twilioMessageSid}`);

    } catch (err) {
        console.error(`Failed to send WhatsApp message ${message_id}:`, err);
        
        await pool.query(
            `UPDATE messages 
             SET status = 'failed', error_message = $1 
             WHERE id = $2`,
            [err.message, message_id]
        );
    }
}

module.exports = { runWhatsappOutboundWorker };
