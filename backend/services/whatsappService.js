const twilio = require('twilio');
const { pool } = require('../config/db');
const { queueIncomingMessage } = require('../config/redis');

/**
 * Get WhatsApp account by phone number (for webhook resolution)
 */
async function getAccountByPhoneNumber(phoneNumber) {
    
    const result = await pool.query(
        `SELECT * FROM tenant_whatsapp_accounts WHERE phone_number = $1 AND is_active = true`,
        [phoneNumber]
    );
    return result.rows[0] || null;
}

/**
 * Get WhatsApp account by tenant ID
 */
async function getAccountByTenantId(tenantId) {
    const result = await pool.query(
        `SELECT * FROM tenant_whatsapp_accounts WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
    );
    return result.rows[0] || null;
}

/**
 * Create or update WhatsApp account for tenant
 */
async function upsertAccount(tenantId, data) {
    const { twilioAccountSid, twilioAuthToken, phoneNumber } = data;
    
    const result = await pool.query(
        `INSERT INTO tenant_whatsapp_accounts (tenant_id, twilio_account_sid, twilio_auth_token, phone_number)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_number) DO UPDATE SET
            twilio_account_sid = EXCLUDED.twilio_account_sid,
            twilio_auth_token = EXCLUDED.twilio_auth_token,
            updated_at = now()
         RETURNING *`,
        [tenantId, twilioAccountSid, twilioAuthToken, phoneNumber]
    );
    return result.rows[0];
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendMessage(tenantId, to, body) {
    const account = await getAccountByTenantId(tenantId);
    if (!account) {
        throw new Error('No WhatsApp account configured for tenant');
    }

    const client = twilio(account.twilio_account_sid, account.twilio_auth_token);
    
    const message = await client.messages.create({
        from: account.phone_number,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body
    });

    return {
        twilioMessageSid: message.sid,
        status: message.status
    };
}

/**
 * Handle incoming WhatsApp message webhook
 */
async function handleIncomingWebhook(webhookData) {
    const { From, To, Body, MessageSid } = webhookData;

    // 1. Resolve tenant by phone number
    const account = await getAccountByPhoneNumber(To);
    if (!account) {
        console.warn(`Unknown WhatsApp number: ${To}`);
        return null;
    }

    const tenantId = account.tenant_id;

    // 2. Find or create contact
    let contactResult = await pool.query(
        `SELECT * FROM contacts WHERE tenant_id = $1 AND phone = $2`,
        [tenantId, From.replace('whatsapp:', '')]
    );

    let contact;
    if (contactResult.rows.length === 0) {
        contactResult = await pool.query(
            `INSERT INTO contacts (tenant_id, phone, source) VALUES ($1, $2, 'whatsapp') RETURNING *`,
            [tenantId, From.replace('whatsapp:', '')]
        );
    }
    contact = contactResult.rows[0];

    // 3. Find or create conversation
    let convResult = await pool.query(
        `SELECT * FROM conversations 
         WHERE tenant_id = $1 AND channel = 'whatsapp' AND channel_contact_id = $2 AND status != 'closed'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, From]
    );

    let conversation;
    if (convResult.rows.length === 0) {
        convResult = await pool.query(
            `INSERT INTO conversations (tenant_id, contact_id, channel, channel_contact_id, status)
             VALUES ($1, $2, 'whatsapp', $3, 'open') RETURNING *`,
            [tenantId, contact.id, From]
        );
    }
    conversation = convResult.rows[0];

    // 4. Create message
    const msgResult = await pool.query(
        `INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel,
            content_text, provider, provider_message_id, status
        ) VALUES ($1, $2, 'inbound', 'user', 'whatsapp', $3, 'twilio', $4, 'received')
        RETURNING *`,
        [tenantId, conversation.id, Body, MessageSid]
    );

    const message = msgResult.rows[0];

    // 5. Insert WhatsApp metadata
    await pool.query(
        `INSERT INTO message_whatsapp_metadata (message_id, wa_number, twilio_message_sid, raw_payload)
         VALUES ($1, $2, $3, $4)`,
        [message.id, From, MessageSid, JSON.stringify(webhookData)]
    );

    // 6. Queue for AI processing
    try {
        await queueIncomingMessage(message.id, tenantId, conversation.id, 'whatsapp');
    } catch (err) {
        console.error('Failed to queue WhatsApp message:', err);
    }

    return { message, conversation, contact };
}

/**
 * Handle Twilio status callback
 */
async function handleStatusCallback(statusData) {
    const { MessageSid, MessageStatus } = statusData;

    const statusMap = {
        queued: 'pending',
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
        undelivered: 'failed'
    };

    const newStatus = statusMap[MessageStatus];
    if (!newStatus) return null;

    // Find message by Twilio SID
    const result = await pool.query(
        `SELECT m.id FROM messages m
         JOIN message_whatsapp_metadata wm ON wm.message_id = m.id
         WHERE wm.twilio_message_sid = $1`,
        [MessageSid]
    );

    if (result.rows.length === 0) return null;

    const messageId = result.rows[0].id;

    // Update status
    const updates = [`status = $2`];
    if (newStatus === 'sent') updates.push(`sent_at = now()`);
    if (newStatus === 'delivered') updates.push(`delivered_at = now()`);
    if (newStatus === 'read') updates.push(`read_at = now()`);

    await pool.query(
        `UPDATE messages SET ${updates.join(', ')} WHERE id = $1`,
        [messageId, newStatus]
    );

    // Update metadata
    await pool.query(
        `UPDATE message_whatsapp_metadata SET status_callback_data = $2 WHERE message_id = $1`,
        [messageId, JSON.stringify(statusData)]
    );

    return { messageId, newStatus };
}

module.exports = {
    getAccountByPhoneNumber,
    getAccountByTenantId,
    upsertAccount,
    sendMessage,
    handleIncomingWebhook,
    handleStatusCallback
};
