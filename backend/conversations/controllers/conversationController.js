const { pool } = require('../../config/db');


// ===== CONVERSATIONS =====

// GET /api/conversations - List conversations
exports.listConversations = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { 
        status, 
        channel, 
        assignedTo, 
        limit = 50, 
        offset = 0,
        search,
        contactId,
        campaignRepliesOnly 
    } = req.query;

    try {
        // Check if user is super admin
        const roleCheck = await pool.query(`
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND (r.role_name = 'super_admin' OR r.role_name = 'super admin')
        `, [userId]);
        
        const isSuperAdmin = roleCheck.rows.length > 0;

        let query = `
            SELECT 
                c.*,
                co.name as contact_name,
                co.email as contact_email,
                u.name as assigned_to_name,
                oc.name as campaign_name,
                oc.reply_handling as campaign_reply_handling,
                -- Read/Unread status
                COALESCE(crs.is_read, false) as is_read,
                crs.read_at,
                -- Star status
                CASE WHEN cs.conversation_id IS NOT NULL THEN true ELSE false END as is_starred,
                cs.starred_at,
                -- Forward detection
                CASE WHEN ca.id IS NOT NULL THEN true ELSE false END as is_forwarded,
                fu.name as forwarded_by_name
            FROM conversations c
            LEFT JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN users u ON c.assigned_to = u.id
            LEFT JOIN outreach_campaigns oc ON c.campaign_id = oc.id
            LEFT JOIN conversation_read_status crs ON crs.conversation_id = c.id AND crs.user_id = $2
            LEFT JOIN conversation_stars cs ON cs.conversation_id = c.id AND cs.user_id = $2
            LEFT JOIN conversation_activities ca ON ca.conversation_id = c.id 
                AND ca.activity_type = 'forwarded' 
                AND ca.metadata->>'to_user_id' = $2::text
            LEFT JOIN users fu ON fu.id = (ca.metadata->>'from_user_id')::uuid
            WHERE c.tenant_id = $1
        `;
        const params = [tenantId, userId];
        let paramIndex = 3;

        // RBAC Filter: Non-super admin users can only see:
        // 1. Conversations assigned to them
        // 2. Conversations for email addresses they have access to (inbound OR outbound)
        // 3. Conversations forwarded to them
        if (!isSuperAdmin) {
            query += ` AND (
                c.assigned_to = $${paramIndex}
                OR (
                    c.channel = 'email' 
                    AND (
                        EXISTS (
                            SELECT 1 FROM user_inbound_email_access uiea
                            JOIN allowed_inbound_emails aie ON aie.id = uiea.allowed_inbound_email_id
                            WHERE uiea.user_id = $${paramIndex}
                            AND aie.email_address = c.mailbox_email
                        )
                        OR EXISTS (
                            SELECT 1 FROM user_outbound_email_access uoea
                            LEFT JOIN tenant_email_connections tec ON tec.id = uoea.email_connection_id
                            LEFT JOIN tenant_allowed_from_emails tafe ON tafe.id = uoea.allowed_from_email_id
                            WHERE uoea.user_id = $${paramIndex}
                            AND (
                                tec.email_address = c.mailbox_email 
                                OR tafe.email_address = c.mailbox_email
                            )
                        )
                    )
                )
                OR EXISTS (
                    SELECT 1 FROM conversation_activities ca_filter
                    WHERE ca_filter.conversation_id = c.id
                    AND ca_filter.activity_type = 'forwarded'
                    AND ca_filter.metadata->>'to_user_id' = $${paramIndex}::text
                )
            )`;
            params.push(userId);
            paramIndex++;
        }

        // DEFAULT FILTER: Exclude campaign conversations that don't have a reply yet
        // User wants to see only engaged prospects in the main list
        // Allow overriding this with explicit includeAllCampaigns flag if needed in future, check definition
        // For now, hard requirement: "display only the campaign conversation that have the contact/prospect reply"
        if (!campaignRepliesOnly) {
           query += ` AND (c.is_campaign = false OR c.has_reply = true)`;
        }

        if (status) {
            query += ` AND c.status = $${paramIndex++}`;
            params.push(status);
        }

        if (channel) {
            query += ` AND c.channel = $${paramIndex++}`;
            params.push(channel);
        }

        if (assignedTo) {
            query += ` AND c.assigned_to = $${paramIndex++}`;
            params.push(assignedTo);
        }

        if (search) {
            query += ` AND (
                c.subject ILIKE $${paramIndex} OR
                co.name ILIKE $${paramIndex} OR
                co.email ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (contactId) {
            query += ` AND c.contact_id = $${paramIndex++}`;
            params.push(contactId);
        }

        if (campaignRepliesOnly === 'true') {
            query += ` AND c.is_campaign = true AND c.has_reply = true`;
        }

        // Unread filter
        const { unreadOnly, starredOnly } = req.query;
        if (unreadOnly === 'true') {
            query += ` AND COALESCE(crs.is_read, false) = false`;
        }

        // Starred filter
        if (starredOnly === 'true') {
            query += ` AND cs.conversation_id IS NOT NULL`;
        }

        query += ` ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count with same RBAC filter
        let countQuery = `
            SELECT COUNT(*) FROM conversations c
            LEFT JOIN contacts co ON c.contact_id = co.id
            WHERE c.tenant_id = $1
        `;
        const countParams = [tenantId];
        let countParamIndex =2;

        if (!isSuperAdmin) {
            countQuery += ` AND (
                c.assigned_to = $${countParamIndex}
                OR (
                    c.channel = 'email' 
                    AND (
                        EXISTS (
                            SELECT 1 FROM user_inbound_email_access uiea
                            JOIN allowed_inbound_emails aie ON aie.id = uiea.allowed_inbound_email_id
                            WHERE uiea.user_id = $${countParamIndex}
                            AND aie.email_address = c.channel_contact_id
                        )
                        OR EXISTS (
                            SELECT 1 FROM user_outbound_email_access uoea
                            LEFT JOIN tenant_email_connections tec ON tec.id = uoea.email_connection_id
                            LEFT JOIN tenant_allowed_from_emails tafe ON tafe.id = uoea.allowed_from_email_id
                            WHERE uoea.user_id = $${countParamIndex}
                            AND (
                                tec.email_address = c.channel_contact_id 
                                OR tafe.email_address = c.channel_contact_id
                            )
                        )
                    )
                )
                OR EXISTS (
                    SELECT 1 FROM conversation_activities ca_count
                    WHERE ca_count.conversation_id = c.id
                    AND ca_count.activity_type = 'forwarded'
                    AND ca_count.metadata->>'to_user_id' = $${countParamIndex}::text
                )
            )`;
            countParams.push(userId);
            countParamIndex++;
        }

        // DEFAULT FILTER: Exclude campaign conversations that don't have a reply yet (Consistent with main query)
        if (!campaignRepliesOnly) {
           countQuery += ` AND (c.is_campaign = false OR c.has_reply = true)`;
        }

        if (status) {
            countQuery += ` AND c.status = $${countParamIndex++}`;
            countParams.push(status);
        }
        if (channel) {
            countQuery += ` AND c.channel = $${countParamIndex++}`;
            countParams.push(channel);
        }
        if (assignedTo) {
            countQuery += ` AND c.assigned_to = $${countParamIndex++}`;
            countParams.push(assignedTo);
        }
        if (contactId) {
            countQuery += ` AND c.contact_id = $${countParamIndex++}`;
            countParams.push(contactId);
        }

        if (campaignRepliesOnly === 'true') {
            countQuery += ` AND c.is_campaign = true AND c.has_reply = true`;
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({ 
            conversations: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error("Error listing conversations:", err);
        res.status(500).json({ error: "Failed to list conversations" });
    }
};

// GET /api/conversations/:id - Get single conversation with messages
exports.getConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        // Get conversation
        const convResult = await pool.query(
            `SELECT 
                c.*,
                co.name as contact_name,
                co.email as contact_email,
                co.phone as contact_phone,
                u.name as assigned_to_name
            FROM conversations c
            LEFT JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE c.id = $1 AND c.tenant_id = $2`,
            [id, tenantId]
        );

        if (convResult.rows.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        res.json({ conversation: convResult.rows[0] });
    } catch (err) {
        console.error("Error getting conversation:", err);
        res.status(500).json({ error: "Failed to get conversation" });
    }
};

// POST /api/conversations - Create conversation
exports.createConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { 
        contactId, 
        channel, 
        channelContactId,
        subject,
        status = 'open',
        aiEnabled = true,
        aiMode = 'auto',
        metadata = {}
    } = req.body;

    if (!channel) {
        return res.status(400).json({ error: "channel is required" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO conversations (
                tenant_id, contact_id, channel, channel_contact_id,
                subject, status, ai_enabled, ai_mode, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [tenantId, contactId, channel, channelContactId, subject, status, aiEnabled, aiMode, JSON.stringify(metadata)]
        );

        res.status(201).json({ conversation: result.rows[0] });
    } catch (err) {
        console.error("Error creating conversation:", err);
        res.status(500).json({ error: "Failed to create conversation" });
    }
};

// PATCH /api/conversations/:id - Update conversation
exports.updateConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { status, priority, assignedTo, aiEnabled, aiMode, subject } = req.body;

    try {
        const updates = [];
        const params = [tenantId, id];
        let paramIndex = 3;

        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
            if (status === 'resolved') {
                updates.push(`resolved_at = now()`);
            }
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            params.push(priority);
        }
        if (assignedTo !== undefined) {
            updates.push(`assigned_to = $${paramIndex++}`);
            params.push(assignedTo || null);
        }
        if (aiEnabled !== undefined) {
            updates.push(`ai_enabled = $${paramIndex++}`);
            params.push(aiEnabled);
        }
        if (aiMode !== undefined) {
            updates.push(`ai_mode = $${paramIndex++}`);
            params.push(aiMode);
        }
        if (subject !== undefined) {
            updates.push(`subject = $${paramIndex++}`);
            params.push(subject);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updates.push('updated_at = now()');

        const result = await pool.query(
            `UPDATE conversations 
             SET ${updates.join(', ')}
             WHERE tenant_id = $1 AND id = $2
             RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        res.json({ conversation: result.rows[0] });
    } catch (err) {
        console.error("Error updating conversation:", err);
        res.status(500).json({ error: "Failed to update conversation" });
    }
};

// POST /api/conversations/:id/assign - Assign conversation
exports.assignConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const result = await pool.query(
            `UPDATE conversations 
             SET assigned_to = $1, updated_at = now()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [userId || null, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        res.json({ conversation: result.rows[0] });
    } catch (err) {
        console.error("Error assigning conversation:", err);
        res.status(500).json({ error: "Failed to assign conversation" });
    }
};

// GET /api/conversations/stats - Get conversation stats
exports.getConversationStats = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
                COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
                COUNT(*) FILTER (WHERE channel = 'email') as email_count,
                COUNT(*) FILTER (WHERE channel = 'whatsapp') as whatsapp_count,
                COUNT(*) FILTER (WHERE channel = 'widget') as widget_count,
                COUNT(*) FILTER (WHERE channel = 'phone') as phone_count,
                COUNT(*) FILTER (WHERE assigned_to IS NULL AND status = 'open') as unassigned_count,
                COUNT(*) as total_count
            FROM conversations
            WHERE tenant_id = $1
        `, [tenantId]);

        res.json({ stats: result.rows[0] });
    } catch (err) {
        console.error("Error getting conversation stats:", err);
        res.status(500).json({ error: "Failed to get stats" });
    }
};

// PATCH /api/conversations/:id/link-contact - Link conversation to contact
exports.linkContactToConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { contactId } = req.body;

    if (!contactId) {
        return res.status(400).json({ error: "contactId is required" });
    }

    try {
        // Verify contact belongs to tenant
        const contactCheck = await pool.query(
            `SELECT id FROM contacts WHERE id = $1 AND tenant_id = $2`,
            [contactId, tenantId]
        );

        if (contactCheck.rows.length === 0) {
            return res.status(404).json({ error: "Contact not found" });
        }

        // Update conversation - link contact and clear sender fields
        const result = await pool.query(
            `UPDATE conversations 
             SET contact_id = $1,
                 sender_display_name = NULL,
                 sender_identifier_type = NULL,
                 sender_identifier_value = NULL,
                 updated_at = now()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [contactId, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        res.json({ 
            success: true,
            conversation: result.rows[0] 
        });
    } catch (err) {
        console.error("Error linking contact:", err);
        res.status(500).json({ error: "Failed to link contact" });
    }
};
// DELETE /api/conversations/:id - Delete conversation
exports.deleteConversation = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    console.log('[DELETE] Attempting to delete conversation:', id, 'for tenant:', tenantId);

    try {
        // 1. Delete related phone calls first (since schema is SET NULL)
        const phoneCallsResult = await pool.query(
            `DELETE FROM phone_calls WHERE conversation_id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );
        console.log('[DELETE] Deleted', phoneCallsResult.rowCount, 'phone_calls records');

        // 2. Delete conversation (Cascades to messages, attachments, etc.)
        const result = await pool.query(
            `DELETE FROM conversations 
             WHERE id = $1 AND tenant_id = $2
             RETURNING id`,
            [id, tenantId]
        );

        console.log('[DELETE] Conversation delete result:', result.rowCount, 'rows affected');

        if (result.rows.length === 0) {
            console.log('[DELETE] Conversation not found:', id);
            return res.status(404).json({ error: "Conversation not found" });
        }

        console.log('[DELETE] Successfully deleted conversation:', id);
        res.json({ success: true, message: "Conversation deleted successfully" });
    } catch (err) {
        console.error("Error deleting conversation:", err);
        res.status(500).json({ error: "Failed to delete conversation" });
    }
};

// PATCH /api/conversations/:id/mark-read - Mark conversation as read
exports.markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        // Upsert read status
        await pool.query(
            `INSERT INTO conversation_read_status (user_id, conversation_id, is_read, read_at)
             VALUES ($1, $2, true, NOW())
             ON CONFLICT (user_id, conversation_id)
             DO UPDATE SET is_read = true, read_at = NOW()`,
            [userId, id]
        );

        res.json({ success: true, message: "Conversation marked as read" });
    } catch (err) {
        console.error("Error marking conversation as read:", err);
        res.status(500).json({ error: "Failed to mark as read" });
    }
};

// PATCH /api/conversations/:id/mark-unread - Mark conversation as unread
exports.markAsUnread = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        // Upsert read status
        await pool.query(
            `INSERT INTO conversation_read_status (user_id, conversation_id, is_read, read_at)
             VALUES ($1, $2, false, NULL)
             ON CONFLICT (user_id, conversation_id)
             DO UPDATE SET is_read = false, read_at = NULL`,
            [userId, id]
        );

        res.json({ success: true, message: "Conversation marked as unread" });
    } catch (err) {
        console.error("Error marking conversation as unread:", err);
        res.status(500).json({ error: "Failed to mark as unread" });
    }
};

// POST /api/conversations/:id/star - Toggle star status
exports.toggleStar = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        // Check if already starred
        const checkResult = await pool.query(
            `SELECT 1 FROM conversation_stars WHERE user_id = $1 AND conversation_id = $2`,
            [userId, id]
        );

        if (checkResult.rows.length > 0) {
            // Unstar
            await pool.query(
                `DELETE FROM conversation_stars WHERE user_id = $1 AND conversation_id = $2`,
                [userId, id]
            );
            res.json({ success: true, is_starred: false, message: "Conversation unstarred" });
        } else {
            // Star
            await pool.query(
                `INSERT INTO conversation_stars (user_id, conversation_id, starred_at)
                 VALUES ($1, $2, NOW())`,
                [userId, id]
            );
            res.json({ success: true, is_starred: true, message: "Conversation starred" });
        }
    } catch (err) {
        console.error("Error toggling star:", err);
        res.status(500).json({ error: "Failed to toggle star" });
    }
};

// GET /api/conversations/starred - Get all starred conversations
exports.getStarredConversations = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    try {
        const result = await pool.query(
            `SELECT 
                c.*,
                co.name as contact_name,
                co.email as contact_email,
                u.name as assigned_to_name,
                oc.name as campaign_name,
                oc.reply_handling as campaign_reply_handling,
                COALESCE(crs.is_read, false) as is_read,
                crs.read_at,
                true as is_starred,
                cs.starred_at,
                CASE WHEN ca.id IS NOT NULL THEN true ELSE false END as is_forwarded,
                fu.name as forwarded_by_name
            FROM conversations c
            INNER JOIN conversation_stars cs ON cs.conversation_id = c.id AND cs.user_id = $2
            LEFT JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN users u ON c.assigned_to = u.id
            LEFT JOIN outreach_campaigns oc ON c.campaign_id = oc.id
            LEFT JOIN conversation_read_status crs ON crs.conversation_id = c.id AND crs.user_id = $2
            LEFT JOIN conversation_activities ca ON ca.conversation_id = c.id 
                AND ca.activity_type = 'forwarded' 
                AND ca.metadata->>'to_user_id' = $2::text
            LEFT JOIN users fu ON fu.id = (ca.metadata->>'from_user_id')::uuid
            WHERE c.tenant_id = $1
            ORDER BY cs.starred_at DESC
            LIMIT $3 OFFSET $4`,
            [tenantId, userId, parseInt(limit), parseInt(offset)]
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM conversation_stars cs
             INNER JOIN conversations c ON c.id = cs.conversation_id
             WHERE cs.user_id = $1 AND c.tenant_id = $2`,
            [userId, tenantId]
        );

        res.json({
            conversations: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error("Error getting starred conversations:", err);
        res.status(500).json({ error: "Failed to get starred conversations" });
    }
};

