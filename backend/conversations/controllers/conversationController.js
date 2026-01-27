const { pool } = require('../../config/db');


// ===== CONVERSATIONS =====

// GET /api/conversations - List conversations
exports.listConversations = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { 
        status, 
        channel, 
        assignedTo, 
        limit = 50, 
        offset = 0,
        search 
    } = req.query;

    try {
        let query = `
            SELECT 
                c.*,
                co.name as contact_name,
                co.email as contact_email,
                u.name as assigned_to_name
            FROM conversations c
            LEFT JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE c.tenant_id = $1
        `;
        const params = [tenantId];
        let paramIndex = 2;

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

        query += ` ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) FROM conversations c
            LEFT JOIN contacts co ON c.contact_id = co.id
            WHERE c.tenant_id = $1
        `;
        const countParams = [tenantId];
        let countParamIndex = 2;

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
