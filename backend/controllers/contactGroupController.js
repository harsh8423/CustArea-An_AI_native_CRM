const { pool } = require('../config/db');

// =====================================================
// CREATE GROUP
// =====================================================
exports.createGroup = async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const result = await pool.query(
            `INSERT INTO contact_groups (tenant_id, name, description, color, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [tenantId, name.trim(), description, color, userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating contact group:', err);
        if (err.constraint === 'unique_group_name_per_tenant') {
            return res.status(409).json({ error: 'A group with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to create contact group' });
    }
};

// =====================================================
// LIST GROUPS
// =====================================================
exports.listGroups = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { page = 1, limit = 50, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                cg.*,
                COUNT(cgm.id) as contact_count,
                u.name as created_by_name
            FROM contact_groups cg
            LEFT JOIN contact_group_memberships cgm ON cg.id = cgm.group_id
            LEFT JOIN users u ON cg.created_by = u.id
            WHERE cg.tenant_id = $1
        `;
        
        const params = [tenantId];

        if (search) {
            query += ` AND cg.name ILIKE $${params.length + 1}`;
            params.push(`%${search}%`);
        }

        query += ` GROUP BY cg.id, u.name ORDER BY cg.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM contact_groups WHERE tenant_id = $1`;
        const countParams = [tenantId];
        if (search) {
            countQuery += ` AND name ILIKE $2`;
            countParams.push(`%${search}%`);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            groups: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Error listing contact groups:', err);
        res.status(500).json({ error: 'Failed to list contact groups' });
    }
};

// =====================================================
// GET GROUP BY ID
// =====================================================
exports.getGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const result = await pool.query(
            `SELECT 
                cg.*,
                COUNT(cgm.id) as contact_count,
                u.name as created_by_name
             FROM contact_groups cg
             LEFT JOIN contact_group_memberships cgm ON cg.id = cgm.group_id
             LEFT JOIN users u ON cg.created_by = u.id
             WHERE cg.id = $1 AND cg.tenant_id = $2
             GROUP BY cg.id, u.name`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error getting contact group:', err);
        res.status(500).json({ error: 'Failed to get contact group' });
    }
};

// =====================================================
// UPDATE GROUP
// =====================================================
exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color } = req.body;
        const tenantId = req.user.tenantId;

        const updates = [];
        const params = [id, tenantId];
        let paramCount = 3;

        if (name !== undefined && name.trim().length > 0) {
            updates.push(`name = $${paramCount++}`);
            params.push(name.trim());
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            params.push(description);
        }
        if (color !== undefined) {
            updates.push(`color = $${paramCount++}`);
            params.push(color);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const query = `
            UPDATE contact_groups
            SET ${updates.join(', ')}
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating contact group:', err);
        if (err.constraint === 'unique_group_name_per_tenant') {
            return res.status(409).json({ error: 'A group with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to update contact group' });
    }
};

// =====================================================
// DELETE GROUP
// =====================================================
exports.deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const result = await pool.query(
            `DELETE FROM contact_groups WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        res.json({ message: 'Contact group deleted successfully', id: result.rows[0].id });
    } catch (err) {
        console.error('Error deleting contact group:', err);
        res.status(500).json({ error: 'Failed to delete contact group' });
    }
};

// =====================================================
// ADD CONTACTS TO GROUP
// =====================================================
exports.addContactsToGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { contactIds } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ error: 'contactIds array is required' });
        }

        // Verify group exists and belongs to tenant
        const groupCheck = await pool.query(
            `SELECT id FROM contact_groups WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (groupCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        // Verify all contacts exist and belong to tenant
        const contactCheck = await pool.query(
            `SELECT id FROM contacts WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
            [contactIds, tenantId]
        );

        if (contactCheck.rows.length !== contactIds.length) {
            return res.status(400).json({ error: 'Some contacts not found or do not belong to your organization' });
        }

        // Insert memberships (ON CONFLICT DO NOTHING to handle duplicates gracefully)
        const values = contactIds.map((contactId, idx) => 
            `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
        ).join(', ');
        
        const params = [];
        contactIds.forEach(contactId => {
            params.push(contactId, id, userId);
        });

        const insertQuery = `
            INSERT INTO contact_group_memberships (contact_id, group_id, added_by)
            VALUES ${values}
            ON CONFLICT (contact_id, group_id) DO NOTHING
            RETURNING *
        `;

        const result = await pool.query(insertQuery, params);

        res.json({
            message: `Added ${result.rows.length} contacts to group`,
            added: result.rows.length,
            skipped: contactIds.length - result.rows.length
        });
    } catch (err) {
        console.error('Error adding contacts to group:', err);
        res.status(500).json({ error: 'Failed to add contacts to group' });
    }
};

// =====================================================
// REMOVE CONTACTS FROM GROUP
// =====================================================
exports.removeContactsFromGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { contactIds } = req.body;
        const tenantId = req.user.tenantId;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ error: 'contactIds array is required' });
        }

        // Verify group exists and belongs to tenant
        const groupCheck = await pool.query(
            `SELECT id FROM contact_groups WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (groupCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        const result = await pool.query(
            `DELETE FROM contact_group_memberships
             WHERE group_id = $1 AND contact_id = ANY($2::uuid[])
             RETURNING id`,
            [id, contactIds]
        );

        res.json({
            message: `Removed ${result.rows.length} contacts from group`,
            removed: result.rows.length
        });
    } catch (err) {
        console.error('Error removing contacts from group:', err);
        res.status(500).json({ error: 'Failed to remove contacts from group' });
    }
};

// =====================================================
// GET CONTACTS IN GROUP
// =====================================================
exports.getGroupContacts = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Verify group exists and belongs to tenant
        const groupCheck = await pool.query(
            `SELECT id FROM contact_groups WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (groupCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Contact group not found' });
        }

        const result = await pool.query(
            `SELECT 
                c.*,
                cgm.added_at,
                u.name as added_by_name
             FROM contacts c
             INNER JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
             LEFT JOIN users u ON cgm.added_by = u.id
             WHERE cgm.group_id = $1 AND c.tenant_id = $2
             ORDER BY cgm.added_at DESC
             LIMIT $3 OFFSET $4`,
            [id, tenantId, limit, offset]
        );

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM contact_group_memberships WHERE group_id = $1`,
            [id]
        );
        const total = parseInt(countResult.rows[0].count);

        res.json({
            contacts: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Error getting group contacts:', err);
        res.status(500).json({ error: 'Failed to get group contacts' });
    }
};

// =====================================================
// GET CONTACT'S GROUPS
// =====================================================
exports.getContactGroups = async (req, res) => {
    try {
        const { contactId } = req.params;
        const tenantId = req.user.tenantId;

        // Verify contact exists and belongs to tenant
        const contactCheck = await pool.query(
            `SELECT id FROM contacts WHERE id = $1 AND tenant_id = $2`,
            [contactId, tenantId]
        );

        if (contactCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        const result = await pool.query(
            `SELECT cg.*, cgm.added_at
             FROM contact_groups cg
             INNER JOIN contact_group_memberships cgm ON cg.id = cgm.group_id
             WHERE cgm.contact_id = $1 AND cg.tenant_id = $2
             ORDER BY cg.name ASC`,
            [contactId, tenantId]
        );

        res.json({ groups: result.rows });
    } catch (err) {
        console.error('Error getting contact groups:', err);
        res.status(500).json({ error: 'Failed to get contact groups' });
    }
};
