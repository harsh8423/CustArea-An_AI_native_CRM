const { pool } = require('../config/db');

/**
 * POST /api/contacts/bulk-assign - Assign multiple contacts to a user
 */
exports.bulkAssignContacts = async (req, res) => {
    try {
        const { contactIds, toUserId } = req.body;
        const fromUserId = req.user.id;
        const tenantId = req.user.tenantId;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ error: 'contactIds array is required' });
        }

        if (!toUserId) {
            return res.status(400).json({ error: 'toUserId is required' });
        }

        // Verify target user exists and is in same tenant
        const userCheck = await pool.query(`
            SELECT id, name FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Verify all contacts exist and belong to tenant
        const contactCheck = await pool.query(`
            SELECT id FROM contacts 
            WHERE id = ANY($1::uuid[]) AND tenant_id = $2
        `, [contactIds, tenantId]);

        if (contactCheck.rows.length !== contactIds.length) {
            return res.status(400).json({ 
                error: 'Some contacts not found or do not belong to your tenant' 
            });
        }

        // Remove existing assignments for these contacts from the current user (if any)
        await pool.query(`
            DELETE FROM user_contact_assignments 
            WHERE contact_id = ANY($1::uuid[]) AND user_id = $2
        `, [contactIds, fromUserId]);

        // Assign to new user
        const values = contactIds.map((id, idx) => 
            `($1, $${idx + 2}::uuid, $${contactIds.length + 2})`
        ).join(',');

        await pool.query(`
            INSERT INTO user_contact_assignments (user_id, contact_id, assigned_by)
            VALUES ${values}
            ON CONFLICT (user_id, contact_id) DO UPDATE
            SET assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
        `, [toUserId, ...contactIds, fromUserId]);

        res.json({ 
            message: `Successfully assigned ${contactIds.length} contact(s) to ${userCheck.rows[0].name}`,
            assigned_count: contactIds.length,
            assigned_to: userCheck.rows[0].name
        });
    } catch (err) {
        console.error('Bulk assign contacts error:', err);
        res.status(500).json({ error: 'Failed to assign contacts', details: err.message });
    }
};

/**
 * POST /api/contact-groups/bulk-assign - Assign multiple contact groups to a user
 */
exports.bulkAssignContactGroups = async (req, res) => {
    try {
        const { groupIds, toUserId } = req.body;
        const tenantId = req.user.tenantId;

        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ error: 'groupIds array is required' });
        }

        if (!toUserId) {
            return res.status(400).json({ error: 'toUserId is required' });
        }

        // Verify target user exists and is in same tenant
        const userCheck = await pool.query(`
            SELECT id, name FROM users WHERE id = $1 AND tenant_id = $2
        `, [toUserId, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Verify all contact groups exist and belong to tenant
        const groupCheck = await pool.query(`
            SELECT id FROM contact_groups 
            WHERE id = ANY($1::uuid[]) AND tenant_id = $2
        `, [groupIds, tenantId]);

        if (groupCheck.rows.length !== groupIds.length) {
            return res.status(400).json({ 
                error: 'Some contact groups not found or do not belong to your tenant' 
            });
        }

        // Assign contact groups to user
        const values = groupIds.map((id, idx) =>
            `($1, $${idx + 2}::uuid)`
        ).join(',');

        await pool.query(`
            INSERT INTO user_contact_group_assignments (user_id, contact_group_id)
            VALUES ${values}
            ON CONFLICT (user_id, contact_group_id) DO NOTHING
        `, [toUserId, ...groupIds]);

        res.json({
            message: `Successfully assigned ${groupIds.length} contact group(s) to ${userCheck.rows[0].name}`,
            assigned_count: groupIds.length,
            assigned_to: userCheck.rows[0].name
        });
    } catch (err) {
        console.error('Bulk assign contact groups error:', err);
        res.status(500).json({ error: 'Failed to assign contact groups', details: err.message });
    }
};
