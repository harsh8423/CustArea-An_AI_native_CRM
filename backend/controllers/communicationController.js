const { pool } = require('../config/db');

/**
 * POST /api/communications/forward-email - Forward email to another user
 */
exports.forwardEmail = async (req, res) => {
    try {
        const { messageId, toUserId, note } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!messageId || !toUserId) {
            return res.status(400).json({ error: 'messageId and toUserId are required' });
        }

        // Verify the message exists and belongs to tenant
        const messageCheck = await pool.query(`
            SELECT m.id, m.subject, c.email_address as from_email
            FROM messages m
            JOIN email_conversations c ON m.conversation_id = c.id
            WHERE m.id = $1 AND c.tenant_id = $2
        `, [messageId, tenantId]);

        if (messageCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Verify target user exists and belongs to tenant
        const userCheck = await pool.query(`
            SELECT id, name, email FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Create forwarding record
        await pool.query(`
            INSERT INTO email_forwards (message_id, from_user_id, to_user_id, note, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [messageId, fromUserId, toUserId, note || null]);

        // TODO: Create notification for target user
        // await createNotification(toUserId, 'email_forwarded', { messageId, fromUserId });

        res.json({ 
            message: 'Email forwarded successfully',
            forwarded_to: userCheck.rows[0].name
        });
    } catch (err) {
        console.error('Forward email error:', err);
        res.status(500).json({ error: 'Failed to forward email', details: err.message });
    }
};

/**
 * POST /api/communications/share-call - Share call log with another user
 */
exports.shareCall = async (req, res) => {
    try {
        const { callId, toUserId, note } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!callId || !toUserId) {
            return res.status(400).json({ error: 'callId and toUserId are required' });
        }

        // Verify the call exists and belongs to tenant
        const callCheck = await pool.query(`
            SELECT c.id, c.from_number, c.to_number, c.direction, c.duration
            FROM phone_calls c
            WHERE c.id = $1 AND c.tenant_id = $2
        `, [callId, tenantId]);

        if (callCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Verify target user
        const userCheck = await pool.query(`
            SELECT id, name FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Create sharing record
        await pool.query(`
            INSERT INTO call_shares (call_id, from_user_id, to_user_id, note, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [callId, fromUserId, toUserId, note || null]);

        // TODO: Create notification
        // await createNotification(toUserId, 'call_shared', { callId, fromUserId });

        res.json({ 
            message: 'Call log shared successfully',
            shared_with: userCheck.rows[0].name
        });
    } catch (err) {
        console.error('Share call error:', err);
        res.status(500).json({ error: 'Failed to share call log', details: err.message });
    }
};

/**
 * POST /api/communications/reassign-lead - Reassign lead to another user
 */
exports.reassignLead = async (req, res) => {
    try {
        const { leadId, toUserId, note } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!leadId || !toUserId) {
            return res.status(400).json({ error: 'leadId and toUserId are required' });
        }

        // Verify lead and current assignment
        const leadCheck = await pool.query(`
            SELECT l.id, l.contact_name, ula.user_id
            FROM leads l
            LEFT JOIN user_lead_assignments ula ON ula.lead_id = l.id AND ula.user_id = $2
            WHERE l.id = $1 AND l.tenant_id = $3
        `, [leadId, fromUserId, tenantId]);

        if (leadCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found or not assigned to you' });
        }

        // Verify target user
        const userCheck = await pool.query(`
            SELECT id, name FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Remove from current user, assign to new user
        await pool.query(`
            DELETE FROM user_lead_assignments WHERE lead_id = $1 AND user_id = $2
        `, [leadId, fromUserId]);

        await pool.query(`
            INSERT INTO user_lead_assignments (user_id, lead_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, lead_id) DO NOTHING
        `, [toUserId, leadId, fromUserId]);

        // Log the reassignment
        await pool.query(`
            INSERT INTO lead_reassignments (lead_id, from_user_id, to_user_id, note, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [leadId, fromUserId, toUserId, note || null]);

        // TODO: Create notification
        // await createNotification(toUserId, 'lead_reassigned', { leadId, fromUserId });

        res.json({ 
            message: 'Lead reassigned successfully',
            assigned_to: userCheck.rows[0].name,
            lead_name: leadCheck.rows[0].contact_name
        });
    } catch (err) {
        console.error('Reassign lead error:', err);
        res.status(500).json({ error: 'Failed to reassign lead', details: err.message });
    }
};

/**
 * POST /api/communications/reassign-contact - Reassign contact to another user
 */
exports.reassignContact = async (req, res) => {
    try {
        const { contactId, toUserId, note } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!contactId || !toUserId) {
            return res.status(400).json({ error: 'contactId and toUserId are required' });
        }

        // Verify contact and current assignment
        const contactCheck = await pool.query(`
            SELECT c.id, c.name, uca.user_id
            FROM contacts c
            LEFT JOIN user_contact_assignments uca ON uca.contact_id = c.id AND uca.user_id = $2
            WHERE c.id = $1 AND c.tenant_id = $3
        `, [contactId, fromUserId, tenantId]);

        if (contactCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found or not assigned to you' });
        }

        // Verify target user
        const userCheck = await pool.query(`
            SELECT id, name FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Remove from current user, assign to new user
        await pool.query(`
            DELETE FROM user_contact_assignments WHERE contact_id = $1 AND user_id = $2
        `, [contactId, fromUserId]);

        await pool.query(`
            INSERT INTO user_contact_assignments (user_id, contact_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, contact_id) DO NOTHING
        `, [toUserId, contactId, fromUserId]);

        // Log the reassignment
        await pool.query(`
            INSERT INTO contact_reassignments (contact_id, from_user_id, to_user_id, note, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [contactId, fromUserId, toUserId, note || null]);

        // TODO: Create notification
        // await createNotification(toUserId, 'contact_reassigned', { contactId, fromUserId });

        res.json({ 
            message: 'Contact reassigned successfully',
            assigned_to: userCheck.rows[0].name,
            contact_name: contactCheck.rows[0].name
        });
    } catch (err) {
        console.error('Reassign contact error:', err);
        res.status(500).json({ error: 'Failed to reassign contact', details: err.message });
    }
};

/**
 * GET /api/communications/my-forwards - Get emails forwarded to me
 */
exports.getMyForwards = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            SELECT 
                ef.id,
                ef.message_id,
                ef.note,
                ef.created_at,
                m.subject,
                m.sender_email,
                u.name as from_user_name,
                u.email as from_user_email
            FROM email_forwards ef
            JOIN messages m ON ef.message_id = m.id
            JOIN users u ON ef.from_user_id = u.id
            WHERE ef.to_user_id = $1
            AND u.tenant_id = $2
            ORDER BY ef.created_at DESC
            LIMIT 50
        `, [userId, tenantId]);

        res.json({ forwards: result.rows });
    } catch (err) {
        console.error('Get forwards error:', err);
        res.status(500).json({ error: 'Failed to fetch forwarded emails', details: err.message });
    }
};

/**
 * GET /api/communications/my-shared-calls - Get call logs shared with me
 */
exports.getMySharedCalls = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            SELECT 
                cs.id,
                cs.call_id,
                cs.note,
                cs.created_at,
                c.from_number,
                c.to_number,
                c.direction,
                c.duration,
                u.name as from_user_name,
                u.email as from_user_email
            FROM call_shares cs
            JOIN phone_calls c ON cs.call_id = c.id
            JOIN users u ON cs.from_user_id = u.id
            WHERE cs.to_user_id = $1
            AND u.tenant_id = $2
            ORDER BY cs.created_at DESC
            LIMIT 50
        `, [userId, tenantId]);

        res.json({ shared_calls: result.rows });
    } catch (err) {
        console.error('Get shared calls error:', err);
        res.status(500).json({ error: 'Failed to fetch shared call logs', details: err.message });
    }
};

/**
 * POST /api/conversations/:id/forward - Forward conversation to another user
 */
exports.forwardConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const { toUserId, note } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!toUserId) {
            return res.status(400).json({ error: 'toUserId is required' });
        }

        // Verify the conversation exists and belongs to tenant
        const conversationCheck = await pool.query(`
            SELECT id, contact_id, channel, subject, assigned_to
            FROM conversations
            WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (conversationCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const conversation = conversationCheck.rows[0];

        // Verify target user exists and belongs to tenant
        const userCheck = await pool.query(`
            SELECT id, name, email FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        const targetUser = userCheck.rows[0];

        // Update conversation assignment
        await pool.query(`
            UPDATE conversations
            SET assigned_to = $1, updated_at = NOW()
            WHERE id = $2
        `, [toUserId, id]);

        // Create conversation activity log entry
        await pool.query(`
            INSERT INTO conversation_activities (
                conversation_id, 
                activity_type, 
                user_id, 
                metadata, 
                created_at
            )
            VALUES ($1, $2, $3, $4, NOW())
        `, [
            id,
            'forwarded',
            fromUserId,
            JSON.stringify({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                to_user_name: targetUser.name,
                note: note || null
            })
        ]);

        // TODO: Create notification for target user
        // await createNotification(toUserId, 'conversation_forwarded', { conversationId: id, fromUserId });

        res.json({ 
            message: 'Conversation forwarded successfully',
            forwarded_to: targetUser.name,
            conversation_id: id
        });
    } catch (err) {
        console.error('Forward conversation error:', err);
        res.status(500).json({ error: 'Failed to forward conversation', details: err.message });
    }
};
