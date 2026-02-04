const { pool } = require('../config/db');

exports.getContacts = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { page = 1, limit = 50, search, sort = 'created_at', order = 'desc' } = req.query;
        const offset = (page - 1) * limit;

        // Check if user is super admin
        const roleCheck = await pool.query(`
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND (r.role_name = 'super_admin' OR r.role_name = 'super admin')
        `, [userId]);
        
        const isSuperAdmin = roleCheck.rows.length > 0;

        let params = [tenantId];
        let paramIndex = 2;
        
        // Base query with RBAC filter
        let query = `
            SELECT DISTINCT c.*
            FROM contacts c
            LEFT JOIN user_contact_assignments uca ON uca.contact_id = c.id
            WHERE c.tenant_id = $1
        `;
        
        let countQuery = `
            SELECT COUNT(DISTINCT c.id)
            FROM contacts c
            LEFT JOIN user_contact_assignments uca ON uca.contact_id = c.id
            WHERE c.tenant_id = $1
        `;

        // Add RBAC filter (unless super admin)
        if (!isSuperAdmin) {
            // Only show contacts that are assigned to this user
            query += ` AND uca.user_id = $${paramIndex}`;
            countQuery += ` AND uca.user_id = $${paramIndex}`;
            params.push(userId);
            paramIndex++;
        }

        // Add search filter
        if (search) {
            query += ` AND (c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
            countQuery += ` AND (c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY c.${sort} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(query, [...params, limit, offset]);

        res.json({
            contacts: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
};

exports.getContactById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
};

exports.exportContacts = async (req, res) => {
    try {
        const { search } = req.query;
        const tenantId = req.user.tenantId; // Keep original tenantId access

        let query = `SELECT * FROM contacts WHERE tenant_id = $1`;
        const params = [tenantId];

        if (search) {
            query += ` AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)`; // Added phone to search
            params.push(`%${search}%`);
        }

        const result = await pool.query(query, params);
        const contacts = result.rows;

        // Generate CSV
        const headers = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Created At'];
        const csvRows = [headers.join(',')];

        contacts.forEach(contact => {
            const row = [
                contact.name,
                contact.email,
                contact.phone,
                contact.company_name,
                contact.source,
                new Date(contact.created_at).toISOString()
            ].map(field => `"${String(field || '').replace(/"/g, '""')}"`); // Escape quotes
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
        res.status(200).send(csvString); // Changed to res.status(200).send

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' }); // Changed error message
    }
};

exports.createContact = async (req, res) => {
    try {
        const { name, email, phone, company_name, source } = req.body;
        const tenantId = req.user.tenantId;

        // Use contactResolver to ensure contact_identifiers are created
        const { createContact } = require('../services/contactResolver');
        
        const contact = await createContact(
            tenantId,
            { email, phone },  // identifiers
            { name, source: source || 'Manual', companyName: company_name }  // metadata
        );

        res.status(201).json({ contact });
    } catch (err) {
        console.error('Error creating contact:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteContacts = async (req, res) => {
    try {
        const { ids } = req.body; // Array of contact IDs
        const tenantId = req.user.tenantId;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No IDs provided' });
        }

        // Delete only contacts belonging to this tenant
        const result = await pool.query(
            `DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
            [ids, tenantId]
        );

        res.json({ deleted: result.rowCount, ids: result.rows.map(r => r.id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete contacts' });
    }
};

exports.updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const { name, email, phone, company_name, metadata } = req.body;

        // Build dynamic update query
        const updates = [];
        const params = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            params.push(email);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramCount++}`);
            params.push(phone);
        }
        if (company_name !== undefined) {
            updates.push(`company_name = $${paramCount++}`);
            params.push(company_name);
        }
        if (metadata !== undefined) {
            updates.push(`metadata = $${paramCount++}`);
            params.push(JSON.stringify(metadata));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);
        params.push(tenantId);

        const query = `
            UPDATE contacts 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
            RETURNING *
        `;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating contact:', err);
        res.status(500).json({ error: 'Failed to update contact' });
    }
};

exports.updateScore = async (req, res) => {
    try {
        const { id } = req.params;
        const { score } = req.body;
        const tenantId = req.user.tenantId;

        if (score === undefined || score < 0 || score > 5) {
            return res.status(400).json({ error: 'Score must be between 0 and 5' });
        }

        // Use the dedicated score column (added via ALTER TABLE)
        const result = await pool.query(
            `UPDATE contacts SET score = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [parseInt(score), id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update score' });
    }
};
