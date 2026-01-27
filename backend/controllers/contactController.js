const { pool } = require('../config/db');

exports.getContacts = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { page = 1, limit = 50, search, sort = 'created_at', order = 'desc' } = req.query;
        const offset = (page - 1) * limit;

        const params = [tenantId];
        let query = `SELECT * FROM contacts WHERE tenant_id = $1`;
        let countQuery = `SELECT COUNT(*) FROM contacts WHERE tenant_id = $1`;

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)`;
            countQuery += ` AND (name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)`;
        }

        query += ` ORDER BY ${sort} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        
        const countResult = await pool.query(countQuery, params.slice(0, search ? 2 : 1));
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
