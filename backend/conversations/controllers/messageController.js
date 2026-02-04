const { pool } = require('../../config/db');
const { queueIncomingMessage, queueOutgoingMessage } = require('../../config/redis');
const { findContact } = require('../../services/contactResolver');

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
                a.size_bytes as attachment_size,
                mem.from_address,
                mem.to_addresses,
                mem.cc_addresses,
                mem.bcc_addresses,
                mem.subject as email_subject,
                pc.call_summary,
                pc.duration_seconds as call_duration,
                pc.call_sid
            FROM messages m
            LEFT JOIN attachments a ON a.message_id = m.id
            LEFT JOIN message_email_metadata mem ON mem.message_id = m.id
            LEFT JOIN message_phone_metadata mpm ON mpm.message_id = m.id
            LEFT JOIN phone_calls pc ON pc.call_sid = mpm.call_sid
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

        // Group attachments and merge metadata
        const messagesMap = new Map();
        let callSummary = null;
        
        for (const row of result.rows) {
            const msgId = row.id;
            
            // Capture call_summary from any message (same for all messages in a call)
            if (row.call_summary && !callSummary) {
                callSummary = row.call_summary;
            }
            
            if (!messagesMap.has(msgId)) {
                const { 
                    attachment_id, attachment_filename, attachment_content_type, attachment_size, 
                    from_address, to_addresses, cc_addresses, bcc_addresses, email_subject,
                    call_summary, call_duration, call_sid,
                    ...msg 
                } = row;
                
                // Merge email metadata into msg.metadata
                const metadata = msg.metadata || {};
                if (from_address) metadata.from_address = from_address;
                if (to_addresses) metadata.to_addresses = to_addresses;
                if (cc_addresses) metadata.cc_addresses = cc_addresses;
                if (bcc_addresses) metadata.bcc_addresses = bcc_addresses;
                if (email_subject) metadata.subject = email_subject;
                if (call_duration) metadata.call_duration_seconds = call_duration;
                if (call_sid) metadata.call_sid = call_sid;
                
                messagesMap.set(msgId, { ...msg, metadata, attachments: [] });
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

        res.json({ 
            messages: Array.from(messagesMap.values()),
            callSummary: callSummary  // Include call summary if this is a phone conversation
        });
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

        // === CONTACT RESOLUTION (Lookup Only - No Auto-Create) ===
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

        // LOOKUP ONLY - don't create
        const contact = await findContact(tenantId, identifiers);

        // Prepare sender information for unknown senders
        const senderDisplayName = channelMetadata.name || channelMetadata.senderName || channelContactId;
        let senderIdType, senderIdValue;
        if (channel === 'email') {
            senderIdType = 'email';
            senderIdValue = channelContactId;
        } else if (channel === 'whatsapp') {
            senderIdType = 'whatsapp';
            senderIdValue = channelContactId;
        } else if (channel === 'widget') {
            senderIdType = 'visitor_id';
            senderIdValue = channelContactId;
        }

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
            // Create new conversation (with or without contact)
            const newConv = await client.query(
                `INSERT INTO conversations (
                    tenant_id, contact_id, channel, channel_contact_id, subject, status,
                    sender_display_name, sender_identifier_type, sender_identifier_value
                ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)
                RETURNING *`,
                [
                    tenantId, 
                    contact?.id || null,  // NULL if contact not found
                    channel, 
                    channelContactId, 
                    subject,
                    contact ? null : senderDisplayName, // Only set if no contact
                    contact ? null : senderIdType,
                    contact ? null : senderIdValue
                ]
            );
            conversation = newConv.rows[0];
            isNewConversation = true;
        } else {
            conversation = convResult.rows[0];
            
            // Link contact if found and not already linked
            if (contact && !conversation.contact_id) {
                await client.query(
                    `UPDATE conversations 
                     SET contact_id = $1, 
                         sender_display_name = NULL, 
                         sender_identifier_type = NULL, 
                         sender_identifier_value = NULL,
                         updated_at = now()
                     WHERE id = $2`,
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
                JSON.stringify({ ...metadata, subject }) // Save subject in metadata
            ]
        );

        const message = msgResult.rows[0];

        // === CAMPAIGN REPLY HANDLING ===
        // Check if this conversation is linked to a campaign
        if (conversation.is_campaign && conversation.campaign_id) {
            // Get campaign details
            const campaignResult = await client.query(
                `SELECT id, reply_handling FROM outreach_campaigns WHERE id = $1`,
                [conversation.campaign_id]
            );

            if (campaignResult.rows.length > 0) {
                const campaign = campaignResult.rows[0];

                // Mark conversation as having a reply
                await client.query(
                    `UPDATE conversations SET has_reply = true WHERE id = $1`,
                    [conversation.id]
                );

                // Update campaign contact status to 'replied'
                await client.query(
                    `UPDATE campaign_contacts 
                     SET status = 'replied', replied_at = now(), updated_at = now()
                     WHERE campaign_id = $1 AND contact_id = $2`,
                    [campaign.id, conversation.contact_id]
                );

                console.log(`Campaign reply detected for campaign ${campaign.id}, reply_handling: ${campaign.reply_handling}`);

                // Route based on reply handling preference
                if (campaign.reply_handling === 'ai') {
                    // Queue for campaign AI agent
                    try {
                        await queueIncomingMessage(
                            message.id, 
                            tenantId, 
                            conversation.id, 
                            channel, 
                            false, // Not workflow
                            null,  // No trigger data
                            'campaign', // agentType
                            campaign.id // campaignId
                        );
                        console.log(`Queued campaign reply for AI handling (campaign ${campaign.id})`);
                    } catch (redisErr) {
                        console.error('Failed to queue campaign reply for AI:', redisErr);
                    }
                    
                    await client.query('COMMIT');
                    
                    return res.status(201).json({
                        message,
                        conversation,
                        contact,
                        isNewConversation,
                        campaignHandling: 'ai'
                    });
                } 
                // If 'human', conversation will show in inbox (has_reply = true)
                // Continue with normal flow below
            }
        }

        // Insert channel-specific metadata
        if (channel === 'email' && Object.keys(channelMetadata).length > 0) {
            await client.query(
                `INSERT INTO message_email_metadata (message_id, from_address, to_addresses, cc_addresses, ses_message_id, ses_metadata, subject)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    message.id,
                    channelMetadata.fromAddress,
                    JSON.stringify(channelMetadata.toAddresses || []),
                    JSON.stringify(channelMetadata.ccAddresses || []),
                    channelMetadata.sesMessageId,
                    JSON.stringify(channelMetadata),
                    subject
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

        // Queue for Workflow or AI processing
        try {
            const { hasTriggerWorkflow, getTriggerType } = require('../../services/workflowCheckService');
            
            // Check if tenant has an active workflow with this channel's trigger
            const triggerType = getTriggerType(channel, 'message');
            const hasWorkflow = await hasTriggerWorkflow(tenantId, triggerType);
            
            if (hasWorkflow) {
                // Build trigger data with channel-specific info
                const triggerData = {
                    trigger_type: triggerType,
                    sender: channel === 'email' ? {
                        email: channelContactId,
                        name: channelMetadata.senderName || null
                    } : channel === 'whatsapp' ? {
                        phone: channelContactId,
                        wa_number: channelContactId.replace('whatsapp:', '')
                    } : {
                        id: channelContactId
                    },
                    message: {
                        id: message.id,
                        body: contentText,
                        subject: subject || null
                    },
                    contact_id: contact?.id || null,
                    conversation_id: conversation.id,
                    timestamp: new Date().toISOString()
                };
                
                await queueIncomingMessage(message.id, tenantId, conversation.id, channel, true, triggerData);
                console.log(`[${channel}] Queued message ${message.id} for WORKFLOW processing`);
            } else if (conversation.ai_enabled && conversation.ai_mode !== 'off') {
                await queueIncomingMessage(message.id, tenantId, conversation.id, channel, false);
                console.log(`[${channel}] Queued message ${message.id} for AI processing`);
            }
        } catch (redisErr) {
            console.error("Failed to queue message:", redisErr);
        }

        res.status(201).json({ 
            message, 
            conversation,
            contact: contact ? {
                id: contact.id,
                exists: true,
                name: contact.name,
                email: contact.email,
                phone: contact.phone
            } : {
                id: null,
                exists: false,
                display_name: senderDisplayName,
                identifier: {
                    type: senderIdType,
                    value: senderIdValue
                }
            },
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
