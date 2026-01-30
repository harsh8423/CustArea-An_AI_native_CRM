const { pool } = require('../../config/db');

/**
 * Log a sent email to the messages table and email metadata table.
 * Creates a conversation if one doesn't exist (assuming outbound context).
 */
async function logSentEmail({ tenantId, from, to, subject, html, text, provider, providerMessageId, connectionId }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Normalize recipients
        const toArray = Array.isArray(to) ? to : [to];
        const channelContactId = toArray[0]; // Primary recipient for conversation linking

        // 1. Create Conversation (or find one? For now, create new for outbound blasts, 
        // strictly speaking we should probably match existing if we have context, but sendEmail is generic)
        // We will create a new conversation for this email thread.
        const convRes = await client.query(
            `INSERT INTO conversations (
                tenant_id, channel, channel_contact_id, subject, status,
                sender_display_name, sender_identifier_type, sender_identifier_value
            ) VALUES ($1, 'email', $2, $3, 'open', NULL, 'email', $4)
            RETURNING id`,
            [tenantId, channelContactId, subject, from]
        );
        const conversationId = convRes.rows[0].id;

        // 2. Insert Message
        const msgRes = await client.query(
            `INSERT INTO messages (
                tenant_id, conversation_id, direction, role, channel,
                content_text, content_html, provider, provider_message_id, status,
                sent_at, metadata
            ) VALUES ($1, $2, 'outbound', 'agent', 'email', $3, $4, $5, $6, 'sent', now(), $7)
            RETURNING id`,
            [
                tenantId, 
                conversationId, 
                text, 
                html, 
                provider, 
                providerMessageId,
                JSON.stringify({ connectionId })
            ]
        );
        const messageId = msgRes.rows[0].id;

        // 3. Insert Metadata
        await client.query(
            `INSERT INTO message_email_metadata (
                message_id, from_address, to_addresses, subject, ses_message_id
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
                messageId,
                from,
                JSON.stringify(toArray.map(e => ({ email: e }))),
                subject,
                provider === 'ses' ? providerMessageId : null
            ]
        );

        await client.query('COMMIT');
        return messageId;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to log sent email:', err);
        // We don't want to fail the request if just logging failed, but maybe we should?
        // Let's log and rethrow to be safe so the caller knows something is inconsistent.
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { logSentEmail };
