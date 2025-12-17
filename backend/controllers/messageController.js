const { pool } = require('../config/db');
const { queueIncomingMessage, queueOutgoingMessage } = require('../config/redis');
const { findOrCreateContact } = require('../services/contactResolver');

// ===== MESSAGES =====

// GET /api/conversations/:conversationId/messages - List messages in conversation
exports.listMessages = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { conversationId } = req.params;
    const { limit = 50, before, after } = req.query;

    try {
        // Verify conversation belongs to tenant
        const convCheck = await pool.query(
            `SELECT id FROM conversations WHERE id = $1 AND tenant_id = $2`,
            [conversationId, tenantId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        let query = `
            SELECT 
                m.*,
                a.id as attachment_id,
                a.filename as attachment_filename,
                a.content_type as attachment_content_type,
                a.size_bytes as attachment_size
            FROM messages m
            LEFT JOIN attachments a ON a.message_id = m.id
            WHERE m.conversation_id = $1 AND m.tenant_id = $2
        `;
        const params = [conversationId, tenantId];
        let paramIndex = 3;

        if (before) {
            query += ` AND m.created_at < $${paramIndex++}`;
            params.push(before);
        }

        if (after) {
            query += ` AND m.created_at > $${paramIndex++}`;
            params.push(after);
        }

        query += ` ORDER BY m.created_at ASC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        // Group attachments with messages
        const messagesMap = new Map();
        for (const row of result.rows) {
            const msgId = row.id;
            if (!messagesMap.has(msgId)) {
                const { attachment_id, attachment_filename, attachment_content_type, attachment_size, ...msg } = row;
                messagesMap.set(msgId, { ...msg, attachments: [] });
            }
            if (row.attachment_id) {
                messagesMap.get(msgId).attachments.push({
                    id: row.attachment_id,
                    filename: row.attachment_filename,
                    content_type: row.attachment_content_type,
                    size_bytes: row.attachment_size
                });
            }
        }

        res.json({ messages: Array.from(messagesMap.values()) });
    } catch (err) {
        console.error("Error listing messages:", err);
        res.status(500).json({ error: "Failed to list messages" });
    }
};

// GET /api/messages/:id - Get single message with metadata
exports.getMessage = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT m.* FROM messages m WHERE m.id = $1 AND m.tenant_id = $2`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Message not found" });
        }

        const message = result.rows[0];

        // Get channel-specific metadata
        let metadata = null;
        if (message.channel === 'email') {
            const metaResult = await pool.query(
                `SELECT * FROM message_email_metadata WHERE message_id = $1`,
                [id]
            );
            metadata = metaResult.rows[0] || null;
        } else if (message.channel === 'whatsapp') {
            const metaResult = await pool.query(
                `SELECT * FROM message_whatsapp_metadata WHERE message_id = $1`,
                [id]
            );
            metadata = metaResult.rows[0] || null;
        } else if (message.channel === 'widget') {
            const metaResult = await pool.query(
                `SELECT * FROM message_widget_metadata WHERE message_id = $1`,
                [id]
            );
            metadata = metaResult.rows[0] || null;
        } else if (message.channel === 'phone') {
            const metaResult = await pool.query(
                `SELECT * FROM message_phone_metadata WHERE message_id = $1`,
                [id]
            );
            metadata = metaResult.rows[0] || null;
        }

        // Get attachments
        const attachments = await pool.query(
            `SELECT * FROM attachments WHERE message_id = $1`,
            [id]
        );

        res.json({ 
            message, 
            channelMetadata: metadata,
            attachments: attachments.rows
        });
    } catch (err) {
        console.error("Error getting message:", err);
        res.status(500).json({ error: "Failed to get message" });
    }
};

// POST /api/conversations/:conversationId/messages - Create/send message
exports.createMessage = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { 
        contentText, 
        contentHtml,
        contentBlocks,
        channel,
        metadata = {}
    } = req.body;

    if (!contentText && !contentHtml) {
        return res.status(400).json({ error: "contentText or contentHtml required" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify conversation
        const convResult = await client.query(
            `SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2`,
            [conversationId, tenantId]
        );

        if (convResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Conversation not found" });
        }

        const conversation = convResult.rows[0];
        const messageChannel = channel || conversation.channel;

        // Create message
        const msgResult = await client.query(
            `INSERT INTO messages (
                tenant_id, conversation_id, direction, role, channel,
                content_text, content_html, content_blocks, status, metadata
            ) VALUES ($1, $2, 'outbound', 'agent', $3, $4, $5, $6, 'pending', $7)
            RETURNING *`,
            [
                tenantId, 
                conversationId, 
                messageChannel,
                contentText,
                contentHtml,
                contentBlocks ? JSON.stringify(contentBlocks) : null,
                JSON.stringify(metadata)
            ]
        );

        const message = msgResult.rows[0];

        // Update first_response_at if this is the first agent response
        if (!conversation.first_response_at) {
            await client.query(
                `UPDATE conversations SET first_response_at = now() WHERE id = $1`,
                [conversationId]
            );
        }

        await client.query('COMMIT');

        // Queue for sending via channel adapter
        try {
            await queueOutgoingMessage(message.id, tenantId, messageChannel);
        } catch (redisErr) {
            console.error("Failed to queue message for sending:", redisErr);
            // Message is created, just not queued - can be retried
        }

        res.status(201).json({ message });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error creating message:", err);
        res.status(500).json({ error: "Failed to create message" });
    } finally {
        client.release();
    }
};

// POST /api/messages/inbound - Receive inbound message (webhook)
exports.receiveInboundMessage = async (req, res) => {
    const { 
        tenantId,
        channel,
        channelContactId,  // email address, wa_number, visitor_id
        contentText,
        contentHtml,
        subject,
        providerMessageId,
        metadata = {},
        channelMetadata = {}
    } = req.body;

    if (!tenantId || !channel || !channelContactId) {
        return res.status(400).json({ error: "tenantId, channel, and channelContactId required" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // === CONTACT RESOLUTION (Cross-channel deduplication) ===
        // Extract identifiers based on channel
        const identifiers = {};
        if (channel === 'email') {
            identifiers.email = channelContactId;
        } else if (channel === 'whatsapp') {
            identifiers.phone = channelContactId.replace('whatsapp:', '');
        } else if (channel === 'widget') {
            identifiers.visitorId = channelContactId;
            // Also check for email if provided in metadata
            if (channelMetadata.email) {
                identifiers.email = channelMetadata.email;
            }
        }

        // Find or create contact using ContactResolver
        const { contact, isNew } = await findOrCreateContact(
            tenantId,
            identifiers,
            { 
                name: channelMetadata.name || channelMetadata.senderName,
                source: channel 
            }
        );

        // Find or create conversation
        let convResult = await client.query(
            `SELECT * FROM conversations 
             WHERE tenant_id = $1 AND channel = $2 AND channel_contact_id = $3 AND status != 'closed'
             ORDER BY created_at DESC LIMIT 1`,
            [tenantId, channel, channelContactId]
        );

        let conversation;
        let isNewConversation = false;

        if (convResult.rows.length === 0) {
            // Create new conversation with contact linked
            const newConv = await client.query(
                `INSERT INTO conversations (
                    tenant_id, contact_id, channel, channel_contact_id, subject, status
                ) VALUES ($1, $2, $3, $4, $5, 'open')
                RETURNING *`,
                [tenantId, contact.id, channel, channelContactId, subject]
            );
            conversation = newConv.rows[0];
            isNewConversation = true;
        } else {
            conversation = convResult.rows[0];
            
            // Link contact to conversation if not already linked
            if (!conversation.contact_id && contact) {
                await client.query(
                    `UPDATE conversations SET contact_id = $1 WHERE id = $2`,
                    [contact.id, conversation.id]
                );
                conversation.contact_id = contact.id;
            }
            
            // Reopen if pending/resolved
            if (conversation.status === 'pending' || conversation.status === 'resolved') {
                await client.query(
                    `UPDATE conversations SET status = 'open', updated_at = now() WHERE id = $1`,
                    [conversation.id]
                );
            }
        }

        // Create message
        const msgResult = await client.query(
            `INSERT INTO messages (
                tenant_id, conversation_id, direction, role, channel,
                content_text, content_html, provider, provider_message_id, status, metadata
            ) VALUES ($1, $2, 'inbound', 'user', $3, $4, $5, $6, $7, 'received', $8)
            RETURNING *`,
            [
                tenantId, 
                conversation.id, 
                channel,
                contentText,
                contentHtml,
                channel,  // provider same as channel for now
                providerMessageId,
                JSON.stringify(metadata)
            ]
        );

        const message = msgResult.rows[0];

        // Insert channel-specific metadata
        if (channel === 'email' && Object.keys(channelMetadata).length > 0) {
            await client.query(
                `INSERT INTO message_email_metadata (message_id, from_address, to_addresses, cc_addresses, ses_message_id, ses_metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    message.id,
                    channelMetadata.fromAddress,
                    JSON.stringify(channelMetadata.toAddresses || []),
                    JSON.stringify(channelMetadata.ccAddresses || []),
                    channelMetadata.sesMessageId,
                    JSON.stringify(channelMetadata)
                ]
            );
        } else if (channel === 'whatsapp' && Object.keys(channelMetadata).length > 0) {
            await client.query(
                `INSERT INTO message_whatsapp_metadata (message_id, wa_message_id, wa_number, twilio_message_sid, raw_payload)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    message.id,
                    channelMetadata.waMessageId,
                    channelMetadata.waNumber,
                    channelMetadata.twilioMessageSid,
                    JSON.stringify(channelMetadata)
                ]
            );
        } else if (channel === 'widget' && Object.keys(channelMetadata).length > 0) {
            await client.query(
                `INSERT INTO message_widget_metadata (message_id, widget_session_id, visitor_id, page_url, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    message.id,
                    channelMetadata.sessionId,
                    channelMetadata.visitorId,
                    channelMetadata.pageUrl,
                    channelMetadata.userAgent
                ]
            );
        }

        await client.query('COMMIT');

        // Queue for AI processing if enabled
        if (conversation.ai_enabled && conversation.ai_mode !== 'off') {
            try {
                await queueIncomingMessage(message.id, tenantId, conversation.id, channel);
            } catch (redisErr) {
                console.error("Failed to queue message for AI:", redisErr);
            }
        }

        res.status(201).json({ 
            message, 
            conversation,
            contact,
            isNewConversation
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error receiving inbound message:", err);
        res.status(500).json({ error: "Failed to receive message" });
    } finally {
        client.release();
    }
};

// PATCH /api/messages/:id/status - Update message status
exports.updateMessageStatus = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { status, providerMessageId, errorMessage } = req.body;

    if (!status) {
        return res.status(400).json({ error: "status required" });
    }

    try {
        const updates = ['status = $3'];
        const params = [tenantId, id, status];
        let paramIndex = 4;

        if (providerMessageId) {
            updates.push(`provider_message_id = $${paramIndex++}`);
            params.push(providerMessageId);
        }

        if (errorMessage) {
            updates.push(`error_message = $${paramIndex++}`);
            params.push(errorMessage);
        }

        if (status === 'sent') {
            updates.push(`sent_at = now()`);
        } else if (status === 'delivered') {
            updates.push(`delivered_at = now()`);
        } else if (status === 'read') {
            updates.push(`read_at = now()`);
        }

        const result = await pool.query(
            `UPDATE messages 
             SET ${updates.join(', ')}
             WHERE id = $2 AND tenant_id = $1
             RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Message not found" });
        }

        res.json({ message: result.rows[0] });
    } catch (err) {
        console.error("Error updating message status:", err);
        res.status(500).json({ error: "Failed to update message status" });
    }
};
