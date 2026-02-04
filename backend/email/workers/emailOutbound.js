const { redis, STREAMS, CONSUMER_GROUPS } = require('../../config/redis');
const { pool } = require('../../config/db');
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

    // 2. Fetch conversation to get recipient AND campaign info
    const convResult = await pool.query(
        `SELECT c.*, cc.sender_email_address as campaign_contact_sender
         FROM conversations c
         LEFT JOIN campaign_contacts cc ON cc.conversation_id = c.id
         WHERE c.id = $1`,
        [message.conversation_id]
    );
    
    if (convResult.rows.length === 0) {
        console.error(`Conversation ${message.conversation_id} not found for message ${message_id}`);
        return;
    }
    const conversation = convResult.rows[0];
    const to = conversation.channel_contact_id; // This should be the email address

    // *** CAMPAIGN EMAIL HANDLING ***
    // Force FROM address to be the original campaign sender for proper threading
    let forcedFromEmail = null;
    if (conversation.is_campaign) {
        // Priority: campaign_sender_email from conversation, fallback to campaign_contacts
        forcedFromEmail = conversation.campaign_sender_email || conversation.campaign_contact_sender;
        if (forcedFromEmail) {
            console.log(`📧 Campaign Reply: Forcing FROM to original sender: ${forcedFromEmail}`);
        } else {
            console.warn(`⚠️ Campaign conversation ${message.conversation_id} missing sender email info`);
        }
    }

    // 2.5 Fetch threading headers for proper reply threading
    // For AI/human replies, we need to reference the LAST MESSAGE in the thread
    // Check both inbound and outbound to get the most recent message
    const lastMessageRes = await pool.query(
        `SELECT m.provider_message_id, mem.message_id_header, m.direction
         FROM messages m
         LEFT JOIN message_email_metadata mem ON m.id = mem.message_id
         WHERE m.conversation_id = $1 
         AND (m.provider_message_id IS NOT NULL OR mem.message_id_header IS NOT NULL)
         ORDER BY m.created_at DESC 
         LIMIT 1`,
        [message.conversation_id]
    );

    let inReplyTo = null;
    let references = null;
    if (lastMessageRes.rows.length > 0) {
        const lastMsg = lastMessageRes.rows[0];
        // Prefer message_id_header from metadata (more reliable), fallback to provider_message_id
        inReplyTo = lastMsg.message_id_header || lastMsg.provider_message_id;
        references = inReplyTo; // For now, simple reference to last message
        console.log(`Threading: In-Reply-To = ${inReplyTo}`);
    }

    // 3. Prepare email input with campaign-aware FROM address
    const emailInput = {
        tenantId: tenant_id,
        fromEmail: forcedFromEmail, // Force campaign sender if applicable
        to: to,
        subject: conversation.subject || 'Re: Conversation', // Fallback subject
        html: message.content_html,
        text: message.content_text,
        inReplyTo: inReplyTo,
        references: references
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
