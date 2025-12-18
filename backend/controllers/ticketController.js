const { pool } = require('../config/db');

// ===== TICKETS =====

// GET /api/tickets - List tickets with filters
exports.listTickets = async (req, res) => {
    const tenantId = req.user.tenantId;
    const {
        status,
        priority,
        assignedTo,
        tagId,
        search,
        limit = 50,
        offset = 0
    } = req.query;

    try {
        let query = `
            SELECT 
                t.*,
                c.name as contact_name,
                c.email as contact_email,
                c.phone as contact_phone,
                u.name as assigned_to_name,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', tt.id, 'name', tt.name, 'color', tt.color))
                     FROM ticket_tag_assignments tta
                     JOIN ticket_tags tt ON tta.tag_id = tt.id
                     WHERE tta.ticket_id = t.id), '[]'
                ) as tags
            FROM tickets t
            LEFT JOIN contacts c ON t.contact_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.tenant_id = $1 AND t.is_deleted = false
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }

        if (priority) {
            query += ` AND t.priority = $${paramIndex++}`;
            params.push(priority);
        }

        if (assignedTo) {
            query += ` AND t.assigned_to = $${paramIndex++}`;
            params.push(assignedTo);
        }

        if (tagId) {
            query += ` AND EXISTS (
                SELECT 1 FROM ticket_tag_assignments tta 
                WHERE tta.ticket_id = t.id AND tta.tag_id = $${paramIndex++}
            )`;
            params.push(tagId);
        }

        if (search) {
            query += ` AND (
                t.subject ILIKE $${paramIndex} OR
                t.description ILIKE $${paramIndex} OR
                c.name ILIKE $${paramIndex} OR
                c.email ILIKE $${paramIndex} OR
                CAST(t.ticket_number AS TEXT) = $${paramIndex + 1}
            )`;
            params.push(`%${search}%`, search);
            paramIndex += 2;
        }

        query += ` ORDER BY t.updated_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) FROM tickets t
            LEFT JOIN contacts c ON t.contact_id = c.id
            WHERE t.tenant_id = $1 AND t.is_deleted = false
        `;
        const countParams = [tenantId];
        let countParamIndex = 2;

        if (status) {
            countQuery += ` AND t.status = $${countParamIndex++}`;
            countParams.push(status);
        }
        if (priority) {
            countQuery += ` AND t.priority = $${countParamIndex++}`;
            countParams.push(priority);
        }
        if (assignedTo) {
            countQuery += ` AND t.assigned_to = $${countParamIndex++}`;
            countParams.push(assignedTo);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            tickets: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error("Error listing tickets:", err);
        res.status(500).json({ error: "Failed to list tickets" });
    }
};

// GET /api/tickets/stats - Get ticket statistics
exports.getTicketStats = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'new') as new_count,
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_count,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
                COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
                COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
                COUNT(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('resolved', 'closed')) as unassigned_count,
                COUNT(*) as total_count
            FROM tickets
            WHERE tenant_id = $1 AND is_deleted = false
        `, [tenantId]);

        res.json({ stats: result.rows[0] });
    } catch (err) {
        console.error("Error getting ticket stats:", err);
        res.status(500).json({ error: "Failed to get stats" });
    }
};

// GET /api/tickets/:id - Get single ticket with all details
exports.getTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        // Get ticket with contact and assignee info
        const ticketResult = await pool.query(`
            SELECT 
                t.*,
                c.name as contact_name,
                c.email as contact_email,
                c.phone as contact_phone,
                c.company_name as contact_company,
                u.name as assigned_to_name,
                conv.id as conversation_id,
                conv.channel as conversation_channel
            FROM tickets t
            LEFT JOIN contacts c ON t.contact_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN conversations conv ON t.source_conversation_id = conv.id
            WHERE t.id = $1 AND t.tenant_id = $2 AND t.is_deleted = false
        `, [id, tenantId]);

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const ticket = ticketResult.rows[0];

        // Get tags
        const tagsResult = await pool.query(`
            SELECT tt.id, tt.name, tt.color
            FROM ticket_tag_assignments tta
            JOIN ticket_tags tt ON tta.tag_id = tt.id
            WHERE tta.ticket_id = $1
        `, [id]);

        // Get linked conversations
        const conversationsResult = await pool.query(`
            SELECT id, channel, channel_contact_id, status, last_message_at, created_at
            FROM conversations
            WHERE ticket_id = $1 OR id = $2
            ORDER BY created_at DESC
        `, [id, ticket.source_conversation_id]);

        res.json({
            ticket: {
                ...ticket,
                tags: tagsResult.rows,
                conversations: conversationsResult.rows
            }
        });
    } catch (err) {
        console.error("Error getting ticket:", err);
        res.status(500).json({ error: "Failed to get ticket" });
    }
};

// POST /api/tickets - Create a new ticket
exports.createTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const {
        subject,
        description,
        contactId,
        sourceConversationId,
        priority = 'normal',
        status = 'new',
        assignedTo,
        assignedTeam,
        sentiment,
        intent,
        summary,
        dueAt,
        tagIds = [],
        metadata = {}
    } = req.body;

    if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create ticket
        const ticketResult = await client.query(`
            INSERT INTO tickets (
                tenant_id, contact_id, subject, description,
                source_conversation_id, priority, status,
                assigned_to, assigned_team, sentiment, intent, summary,
                due_at, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            tenantId, contactId || null, subject, description || null,
            sourceConversationId || null, priority, status,
            assignedTo || null, assignedTeam || null, sentiment || null,
            intent || null, summary || null, dueAt || null, JSON.stringify(metadata)
        ]);

        const ticket = ticketResult.rows[0];

        // Add tags if provided
        if (tagIds.length > 0) {
            const tagValues = tagIds.map((tagId, i) => 
                `($1, $${i + 2}, $${tagIds.length + 2})`
            ).join(', ');
            
            await client.query(`
                INSERT INTO ticket_tag_assignments (ticket_id, tag_id, assigned_by)
                VALUES ${tagValues}
                ON CONFLICT DO NOTHING
            `, [ticket.id, ...tagIds, userId]);
        }

        // Link conversation to ticket if source conversation provided
        if (sourceConversationId) {
            await client.query(`
                UPDATE conversations SET ticket_id = $1 WHERE id = $2 AND tenant_id = $3
            `, [ticket.id, sourceConversationId, tenantId]);
        }

        await client.query('COMMIT');

        res.status(201).json({ ticket });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error creating ticket:", err);
        res.status(500).json({ error: "Failed to create ticket" });
    } finally {
        client.release();
    }
};

// PATCH /api/tickets/:id - Update ticket
exports.updateTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;
    const {
        subject,
        description,
        status,
        priority,
        assignedTo,
        assignedTeam,
        sentiment,
        intent,
        summary,
        dueAt
    } = req.body;

    try {
        const updates = [];
        const params = [tenantId, id];
        let paramIndex = 3;

        if (subject !== undefined) {
            updates.push(`subject = $${paramIndex++}`);
            params.push(subject);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(description);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
            
            // Set closed_at if closing
            if (status === 'closed' || status === 'resolved') {
                updates.push(`closed_at = COALESCE(closed_at, now())`);
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
        if (assignedTeam !== undefined) {
            updates.push(`assigned_team = $${paramIndex++}`);
            params.push(assignedTeam || null);
        }
        if (sentiment !== undefined) {
            updates.push(`sentiment = $${paramIndex++}`);
            params.push(sentiment);
        }
        if (intent !== undefined) {
            updates.push(`intent = $${paramIndex++}`);
            params.push(intent);
        }
        if (summary !== undefined) {
            updates.push(`summary = $${paramIndex++}`);
            params.push(summary);
        }
        if (dueAt !== undefined) {
            updates.push(`due_at = $${paramIndex++}`);
            params.push(dueAt || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const result = await pool.query(`
            UPDATE tickets 
            SET ${updates.join(', ')}
            WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json({ ticket: result.rows[0] });
    } catch (err) {
        console.error("Error updating ticket:", err);
        res.status(500).json({ error: "Failed to update ticket" });
    }
};

// DELETE /api/tickets/:id - Soft delete ticket
exports.deleteTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE tickets 
            SET is_deleted = true, updated_at = now()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json({ success: true, message: "Ticket deleted" });
    } catch (err) {
        console.error("Error deleting ticket:", err);
        res.status(500).json({ error: "Failed to delete ticket" });
    }
};

// ===== TICKET NOTES =====

// GET /api/tickets/:id/notes - List notes for a ticket
exports.listNotes = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [id, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const result = await pool.query(`
            SELECT n.*, u.name as created_by_name
            FROM ticket_notes n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.ticket_id = $1
            ORDER BY n.is_pinned DESC, n.created_at DESC
        `, [id]);

        res.json({ notes: result.rows });
    } catch (err) {
        console.error("Error listing notes:", err);
        res.status(500).json({ error: "Failed to list notes" });
    }
};

// POST /api/tickets/:id/notes - Add a note
exports.addNote = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;
    const { content, isPinned = false } = req.body;

    if (!content) {
        return res.status(400).json({ error: "Content is required" });
    }

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [id, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const result = await pool.query(`
            INSERT INTO ticket_notes (ticket_id, content, is_pinned, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [id, content, isPinned, userId]);

        // Log activity
        await pool.query(`
            INSERT INTO ticket_activities (ticket_id, activity_type, performed_by, description)
            VALUES ($1, 'note_added', $2, 'Note added to ticket')
        `, [id, userId]);

        res.status(201).json({ note: result.rows[0] });
    } catch (err) {
        console.error("Error adding note:", err);
        res.status(500).json({ error: "Failed to add note" });
    }
};

// PATCH /api/tickets/:ticketId/notes/:noteId - Update a note
exports.updateNote = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { ticketId, noteId } = req.params;
    const { content, isPinned } = req.body;

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [ticketId, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const updates = [];
        const params = [noteId, ticketId];
        let paramIndex = 3;

        if (content !== undefined) {
            updates.push(`content = $${paramIndex++}`);
            params.push(content);
        }
        if (isPinned !== undefined) {
            updates.push(`is_pinned = $${paramIndex++}`);
            params.push(isPinned);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updates.push('updated_at = now()');

        const result = await pool.query(`
            UPDATE ticket_notes
            SET ${updates.join(', ')}
            WHERE id = $1 AND ticket_id = $2
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Note not found" });
        }

        res.json({ note: result.rows[0] });
    } catch (err) {
        console.error("Error updating note:", err);
        res.status(500).json({ error: "Failed to update note" });
    }
};

// DELETE /api/tickets/:ticketId/notes/:noteId - Delete a note
exports.deleteNote = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { ticketId, noteId } = req.params;

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [ticketId, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const result = await pool.query(`
            DELETE FROM ticket_notes WHERE id = $1 AND ticket_id = $2 RETURNING id
        `, [noteId, ticketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Note not found" });
        }

        res.json({ success: true, message: "Note deleted" });
    } catch (err) {
        console.error("Error deleting note:", err);
        res.status(500).json({ error: "Failed to delete note" });
    }
};

// ===== TICKET ACTIVITIES =====

// GET /api/tickets/:id/activities - Get activity log
exports.getActivities = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { limit = 50 } = req.query;

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const result = await pool.query(`
            SELECT a.*, u.name as performed_by_name
            FROM ticket_activities a
            LEFT JOIN users u ON a.performed_by = u.id
            WHERE a.ticket_id = $1
            ORDER BY a.created_at DESC
            LIMIT $2
        `, [id, parseInt(limit)]);

        res.json({ activities: result.rows });
    } catch (err) {
        console.error("Error getting activities:", err);
        res.status(500).json({ error: "Failed to get activities" });
    }
};

// ===== TICKET TAGS =====

// GET /api/ticket-tags - List all tags for tenant
exports.listTags = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT t.*, 
                (SELECT COUNT(*) FROM ticket_tag_assignments WHERE tag_id = t.id) as ticket_count
            FROM ticket_tags t
            WHERE t.tenant_id = $1
            ORDER BY t.name ASC
        `, [tenantId]);

        res.json({ tags: result.rows });
    } catch (err) {
        console.error("Error listing tags:", err);
        res.status(500).json({ error: "Failed to list tags" });
    }
};

// POST /api/ticket-tags - Create a tag
exports.createTag = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, color = '#6B7280', description } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Name is required" });
    }

    try {
        const result = await pool.query(`
            INSERT INTO ticket_tags (tenant_id, name, color, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [tenantId, name, color, description || null]);

        res.status(201).json({ tag: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: "Tag with this name already exists" });
        }
        console.error("Error creating tag:", err);
        res.status(500).json({ error: "Failed to create tag" });
    }
};

// PATCH /api/ticket-tags/:id - Update a tag
exports.updateTag = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, color, description } = req.body;

    try {
        const updates = [];
        const params = [id, tenantId];
        let paramIndex = 3;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (color !== undefined) {
            updates.push(`color = $${paramIndex++}`);
            params.push(color);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(description);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const result = await pool.query(`
            UPDATE ticket_tags
            SET ${updates.join(', ')}
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Tag not found" });
        }

        res.json({ tag: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "Tag with this name already exists" });
        }
        console.error("Error updating tag:", err);
        res.status(500).json({ error: "Failed to update tag" });
    }
};

// DELETE /api/ticket-tags/:id - Delete a tag
exports.deleteTag = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(`
            DELETE FROM ticket_tags WHERE id = $1 AND tenant_id = $2 RETURNING id
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Tag not found" });
        }

        res.json({ success: true, message: "Tag deleted" });
    } catch (err) {
        console.error("Error deleting tag:", err);
        res.status(500).json({ error: "Failed to delete tag" });
    }
};

// POST /api/tickets/:id/tags - Add tags to ticket
exports.addTagsToTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;
    const { tagIds } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({ error: "tagIds array is required" });
    }

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [id, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        // Insert tags
        for (const tagId of tagIds) {
            await pool.query(`
                INSERT INTO ticket_tag_assignments (ticket_id, tag_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [id, tagId, userId]);
        }

        // Log activity
        await pool.query(`
            INSERT INTO ticket_activities (ticket_id, activity_type, performed_by, new_value, description)
            VALUES ($1, 'tag_added', $2, $3, 'Tags added to ticket')
        `, [id, userId, JSON.stringify({ tagIds })]);

        res.json({ success: true, message: "Tags added" });
    } catch (err) {
        console.error("Error adding tags:", err);
        res.status(500).json({ error: "Failed to add tags" });
    }
};

// DELETE /api/tickets/:ticketId/tags/:tagId - Remove tag from ticket
exports.removeTagFromTicket = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { ticketId, tagId } = req.params;

    try {
        // Verify ticket belongs to tenant
        const ticketCheck = await pool.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [ticketId, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        await pool.query(`
            DELETE FROM ticket_tag_assignments WHERE ticket_id = $1 AND tag_id = $2
        `, [ticketId, tagId]);

        // Log activity
        await pool.query(`
            INSERT INTO ticket_activities (ticket_id, activity_type, performed_by, old_value, description)
            VALUES ($1, 'tag_removed', $2, $3, 'Tag removed from ticket')
        `, [ticketId, userId, JSON.stringify({ tagId })]);

        res.json({ success: true, message: "Tag removed" });
    } catch (err) {
        console.error("Error removing tag:", err);
        res.status(500).json({ error: "Failed to remove tag" });
    }
};

// ===== TICKET MACROS =====

// GET /api/macros - List all macros for tenant
exports.listMacros = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { activeOnly = 'true' } = req.query;

    try {
        let query = `
            SELECT m.*, u.name as created_by_name
            FROM ticket_macros m
            LEFT JOIN users u ON m.created_by = u.id
            WHERE m.tenant_id = $1
        `;
        const params = [tenantId];

        if (activeOnly === 'true') {
            query += ` AND m.is_active = true`;
        }

        query += ` ORDER BY m.name ASC`;

        const result = await pool.query(query, params);
        res.json({ macros: result.rows });
    } catch (err) {
        console.error("Error listing macros:", err);
        res.status(500).json({ error: "Failed to list macros" });
    }
};

// POST /api/macros - Create a macro
exports.createMacro = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const {
        name,
        description,
        macroType = 'custom',
        actions = [],
        scheduleDelayHours
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Name is required" });
    }

    try {
        const result = await pool.query(`
            INSERT INTO ticket_macros (
                tenant_id, name, description, macro_type, actions, schedule_delay_hours, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [tenantId, name, description || null, macroType, JSON.stringify(actions), scheduleDelayHours || null, userId]);

        res.status(201).json({ macro: result.rows[0] });
    } catch (err) {
        console.error("Error creating macro:", err);
        res.status(500).json({ error: "Failed to create macro" });
    }
};

// PATCH /api/macros/:id - Update a macro
exports.updateMacro = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, description, macroType, actions, scheduleDelayHours, isActive } = req.body;

    try {
        const updates = [];
        const params = [id, tenantId];
        let paramIndex = 3;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(description);
        }
        if (macroType !== undefined) {
            updates.push(`macro_type = $${paramIndex++}`);
            params.push(macroType);
        }
        if (actions !== undefined) {
            updates.push(`actions = $${paramIndex++}`);
            params.push(JSON.stringify(actions));
        }
        if (scheduleDelayHours !== undefined) {
            updates.push(`schedule_delay_hours = $${paramIndex++}`);
            params.push(scheduleDelayHours);
        }
        if (isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(isActive);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updates.push('updated_at = now()');

        const result = await pool.query(`
            UPDATE ticket_macros
            SET ${updates.join(', ')}
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Macro not found" });
        }

        res.json({ macro: result.rows[0] });
    } catch (err) {
        console.error("Error updating macro:", err);
        res.status(500).json({ error: "Failed to update macro" });
    }
};

// DELETE /api/macros/:id - Delete a macro
exports.deleteMacro = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(`
            DELETE FROM ticket_macros WHERE id = $1 AND tenant_id = $2 RETURNING id
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Macro not found" });
        }

        res.json({ success: true, message: "Macro deleted" });
    } catch (err) {
        console.error("Error deleting macro:", err);
        res.status(500).json({ error: "Failed to delete macro" });
    }
};

// POST /api/tickets/:id/apply-macro - Apply macro to ticket
exports.applyMacro = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;
    const { macroId } = req.body;

    if (!macroId) {
        return res.status(400).json({ error: "macroId is required" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get ticket
        const ticketCheck = await client.query(
            `SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [id, tenantId]
        );

        if (ticketCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Ticket not found" });
        }

        // Get macro
        const macroResult = await client.query(
            `SELECT * FROM ticket_macros WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [macroId, tenantId]
        );

        if (macroResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Macro not found or inactive" });
        }

        const macro = macroResult.rows[0];
        const actions = macro.actions || [];

        // Apply each action
        for (const action of actions) {
            switch (action.type) {
                case 'set_status':
                    await client.query(
                        `UPDATE tickets SET status = $1 WHERE id = $2`,
                        [action.value, id]
                    );
                    break;
                case 'set_priority':
                    await client.query(
                        `UPDATE tickets SET priority = $1 WHERE id = $2`,
                        [action.value, id]
                    );
                    break;
                case 'set_team':
                    await client.query(
                        `UPDATE tickets SET assigned_team = $1 WHERE id = $2`,
                        [action.value, id]
                    );
                    break;
                case 'add_tag':
                    await client.query(`
                        INSERT INTO ticket_tag_assignments (ticket_id, tag_id, assigned_by)
                        VALUES ($1, $2, $3)
                        ON CONFLICT DO NOTHING
                    `, [id, action.tag_id, userId]);
                    break;
                // Add more action types as needed
            }
        }

        // Log activity
        await client.query(`
            INSERT INTO ticket_activities (ticket_id, activity_type, performed_by, new_value, description)
            VALUES ($1, 'macro_applied', $2, $3, $4)
        `, [id, userId, JSON.stringify({ macroId, macroName: macro.name }), `Macro "${macro.name}" applied`]);

        await client.query('COMMIT');

        // Get updated ticket
        const updatedTicket = await pool.query(
            `SELECT * FROM tickets WHERE id = $1`,
            [id]
        );

        res.json({ 
            success: true, 
            message: `Macro "${macro.name}" applied successfully`,
            ticket: updatedTicket.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error applying macro:", err);
        res.status(500).json({ error: "Failed to apply macro" });
    } finally {
        client.release();
    }
};
