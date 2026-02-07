const { pool } = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * GET /api/users - List all users in tenant
 */
exports.listUsers = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            SELECT 
                u.id,
                u.email,
                u.name,
                u.role as legacy_role,
                u.status,
                u.created_at,
                (u.id = $2) as is_current_user,
                ARRAY_AGG(DISTINCT r.display_name) FILTER (WHERE r.id IS NOT NULL) as roles,
                COUNT(DISTINCT ula.lead_id) as assigned_leads_count,
                COUNT(DISTINCT uca.contact_id) as assigned_contacts_count
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            LEFT JOIN user_lead_assignments ula ON ula.user_id = u.id
            LEFT JOIN user_contact_assignments uca ON uca.user_id = u.id
            WHERE u.tenant_id = $1
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, [tenantId]);

        res.json({ users: result.rows });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to list users', details: err.message });
    }
};

/**
 * GET /api/users/:id - Get user details with permissions
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Get user basic info
        const userResult = await pool.query(`
            SELECT id, email, name, role, status, created_at
            FROM users
            WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get roles
        const rolesResult = await pool.query(`
            SELECT r.id, r.role_name, r.display_name, r.description
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1
        `, [id]);

        // Get direct permissions
        const permsResult = await pool.query(`
            SELECT p.id, p.permission_key, p.display_name, up.granted
            FROM user_permissions up
            JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = $1
        `, [id]);

        // Get assigned leads
        const leadsResult = await pool.query(`
            SELECT l.id, c.name as contact_name, l.status
            FROM user_lead_assignments ula
            JOIN leads l ON l.id = ula.lead_id
            JOIN contacts c ON c.id = l.contact_id
            WHERE ula.user_id = $1
            LIMIT 50
        `, [id]);

        // Get assigned contacts
        const contactsResult = await pool.query(`
            SELECT c.id, c.name, c.email
            FROM user_contact_assignments uca
            JOIN contacts c ON c.id = uca.contact_id
            WHERE uca.user_id = $1
            LIMIT 50
        `, [id]);

        // Get inbound email access
        const inboundEmailsResult = await pool.query(`
            SELECT aie.id, aie.email_address
            FROM user_inbound_email_access uiea
            JOIN allowed_inbound_emails aie ON aie.id = uiea.allowed_inbound_email_id
            WHERE uiea.user_id = $1
        `, [id]);

        // Get outbound email access
        const outboundEmailsResult = await pool.query(`
            SELECT 
                COALESCE(uoea.email_connection_id, uoea.allowed_from_email_id) as id,
                uoea.email_type,
                COALESCE(tec.email_address, tafe.email_address) as email_address,
                tec.display_name,
                uoea.email_connection_id,
                uoea.allowed_from_email_id
            FROM user_outbound_email_access uoea
            LEFT JOIN tenant_email_connections tec ON tec.id = uoea.email_connection_id
            LEFT JOIN tenant_allowed_from_emails tafe ON tafe.id = uoea.allowed_from_email_id
            WHERE uoea.user_id = $1
        `, [id]);
        
        console.log('User outbound emails:', outboundEmailsResult.rows);

        // Get phone access
        const phoneResult = await pool.query(`
            SELECT tpc.id, tpc.phone_number
            FROM user_phone_access upa
            JOIN tenant_phone_config tpc ON tpc.id = upa.phone_config_id
            WHERE upa.user_id = $1
        `, [id]);

        res.json({
            user: {
                ...user,
                roles: rolesResult.rows,
                direct_permissions: permsResult.rows,
                assigned_leads: leadsResult.rows,
                assigned_contacts: contactsResult.rows,
                inbound_emails: inboundEmailsResult.rows,
                outbound_emails: outboundEmailsResult.rows,
                phone_numbers: phoneResult.rows
            }
        });
    } catch (err) {
        console.error('Get user details error:', err);
        res.status(500).json({ error: 'Failed to get user details', details: err.message });
    }
};

/**
 * POST /api/users/invite - Invite a new user
 */
exports.inviteUser = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            email, 
            roleIds = [], 
            permissionOverrides = {}, 
            assignedLeadIds = [],
            assignedContactIds = [],
            inboundEmailIds = [],
            outboundEmailConfigs = [],
            phoneConfigIds = []
        } = req.body;
        
        const tenantId = req.user.tenantId;
        const invitedBy = req.user.id;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await client.query('BEGIN');

        // Check if user already exists
        const existingUser = await client.query(
            `SELECT id FROM users WHERE email = $1 AND tenant_id = $2`,
            [email.toLowerCase(), tenantId]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'User already exists in this tenant' });
        }

        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString('hex');

        // Create invitation
        const invitationResult = await client.query(`
            INSERT INTO user_invitations (
                tenant_id, email, invited_by, invitation_token,
                role_ids, permission_overrides, assigned_lead_ids, assigned_contact_ids,
                status, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now() + interval '7 days')
            RETURNING id, invitation_token, expires_at
        `, [
            tenantId,
            email.toLowerCase(),
            invitedBy,
            invitationToken,
            roleIds,
            JSON.stringify(permissionOverrides),
            assignedLeadIds,
            assignedContactIds
        ]);

        const invitation = invitationResult.rows[0];

        // TODO: Send invitation email
        // await sendInvitationEmail(email, invitationToken, req.user.tenant_name);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'User invitation sent successfully',
            invitation: {
                id: invitation.id,
                email: email,
                invitation_link: `${process.env.FRONTEND_URL}/accept-invitation/${invitation.invitation_token}`,
                expires_at: invitation.expires_at
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Invite user error:', err);
        res.status(500).json({ error: 'Failed to invite user', details: err.message });
    } finally {
        client.release();
    }
};

/**
 * GET /api/users/invitations/:token/validate - Validate invitation token
 */
exports.validateInvitation = async (req, res) => {
    try {
        const { token } = req.params;

        const result = await pool.query(`
            SELECT 
                ui.id,
                ui.email,
                ui.status,
                ui.expires_at,
                ui.role_ids,
                t.name as tenant_name
            FROM user_invitations ui
            JOIN tenants t ON t.id = ui.tenant_id
            WHERE ui.invitation_token = $1
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid invitation token' });
        }

        const invitation = result.rows[0];

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already accepted
        if (invitation.status !== 'pending') {
            return res.status(409).json({ error: 'Invitation has already been accepted' });
        }

        res.json({ 
            invitation: {
                email: invitation.email,
                tenant_name: invitation.tenant_name,
                role_ids: invitation.role_ids
            }
        });
    } catch (err) {
        console.error('Validate invitation error:', err);
        res.status(500).json({ error: 'Failed to validate invitation', details: err.message });
    }
};

/**
 * POST /api/users/invitations/:token/accept - Accept invitation and create account
 */
exports.acceptInvitation = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { token } = req.params;
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({ error: 'Name and password are required' });
        }

        await client.query('BEGIN');

        // Get invitation
        const invResult = await client.query(`
            SELECT *
            FROM user_invitations
            WHERE invitation_token = $1
            FOR UPDATE
        `, [token]);

        if (invResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Invalid invitation token' });
        }

        const invitation = invResult.rows[0];

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already accepted
        if (invitation.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Invitation has already been accepted' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userResult = await client.query(`
            INSERT INTO users (
                tenant_id, email, name, password_hash, 
                role, status, created_at
            ) VALUES ($1, $2, $3, $4, 'agent', 'active', now())
            RETURNING id, email, name, status
        `, [invitation.tenant_id, invitation.email, name, hashedPassword]);

        const user = userResult.rows[0];

        // Assign roles
        for (const roleId of invitation.role_ids || []) {
            await client.query(`
                INSERT INTO user_roles (user_id, role_id, assigned_by)
                VALUES ($1, $2, $3)
            `, [user.id, roleId, invitation.invited_by]);
        }

        // Grant permission overrides
        const permissionOverrides = JSON.parse(invitation.permission_overrides || '{}');
        for (const [permissionId, granted] of Object.entries(permissionOverrides)) {
            await client.query(`
                INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
                VALUES ($1, $2, $3, $4)
            `, [user.id, permissionId, granted, invitation.invited_by]);
        }

        // Assign leads
        for (const leadId of invitation.assigned_lead_ids || []) {
            await client.query(`
                INSERT INTO user_lead_assignments (user_id, lead_id, assigned_by)
                VALUES ($1, $2, $3)
            `, [user.id, leadId, invitation.invited_by]);
        }

        // Assign contacts
        for (const contactId of invitation.assigned_contact_ids || []) {
            await client.query(`
                INSERT INTO user_contact_assignments (user_id, contact_id, assigned_by)
                VALUES ($1, $2, $3)
            `, [user.id, contactId, invitation.invited_by]);
        }

        // Mark invitation as accepted
        await client.query(`
            UPDATE user_invitations
            SET status = 'accepted', accepted_at = now()
            WHERE id = $1
        `, [invitation.id]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Accept invitation error:', err);
        res.status(500).json({ error: 'Failed to accept invitation', details: err.message });
    } finally {
        client.release();
    }
};

/**
 * POST /api/users/:id/assign-roles - Assign roles to user
 */
exports.assignRoles = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(roleIds)) {
            return res.status(400).json({ error: 'roleIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Clear existing roles
        await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);

        // Assign new roles
        for (const roleId of roleIds) {
            await pool.query(`
                INSERT INTO user_roles (user_id, role_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, role_id) DO NOTHING
            `, [id, roleId, assignedBy]);
        }

        res.json({ message: 'Roles assigned successfully' });
    } catch (err) {
        console.error('Assign roles error:', err);
        res.status(500).json({ error: 'Failed to assign roles', details: err.message });
    }
};

/**
 * POST /api/users/:id/grant-permissions - Grant/revoke direct permissions
 */
exports.grantPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body; // { permissionId: granted (boolean) }
        const tenantId = req.user.tenantId;
        const grantedBy = req.user.id;

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Grant/revoke permissions
        for (const [permissionId, granted] of Object.entries(permissions)) {
            await pool.query(`
                INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, permission_id) 
                DO UPDATE SET granted = $3, granted_by = $4, granted_at = now()
            `, [id, permissionId, granted, grantedBy]);
        }

        res.json({ message: 'Permissions updated successfully' });
    } catch (err) {
        console.error('Grant permissions error:', err);
        res.status(500).json({ error: 'Failed to grant permissions', details: err.message });
    }
};

/**
 * POST /api/users/:id/assign-leads - Assign leads to user
 */
exports.assignLeads = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'leadIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Assign leads
        for (const leadId of leadIds) {
            await pool.query(`
                INSERT INTO user_lead_assignments (user_id, lead_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, lead_id) DO NOTHING
            `, [id, leadId, assignedBy]);

            // Also update lead owner_id for backward compatibility
            // FIXED: Set updated_by to track who assigned
            await pool.query(`
                UPDATE leads SET owner_id = $1, updated_by = $3 WHERE id = $2
            `, [id, leadId, assignedBy]);
        }

        res.json({ message: 'Leads assigned successfully', count: leadIds.length });
    } catch (err) {
        console.error('Assign leads error:', err);
        res.status(500).json({ error: 'Failed to assign leads', details: err.message });
    }
};

/**
 * POST /api/users/:id/grant-channel-access - Grant/Revoke channel access
 * This endpoint now supports both granting and revoking access.
 * It deletes all existing access and re-inserts only the selected items.
 */
exports.grantChannelAccess = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { id } = req.params;
        const { 
            inboundEmailIds = [],
            outboundEmailConfigs = [], // [{ email_type, email_connection_id OR ses_identity_id + allowed_from_email_id }]
            phoneConfigIds = [],
            whatsappAccountIds = []
        } = req.body;
        
        const tenantId = req.user.tenantId;
        const grantedBy = req.user.id;

        await client.query('BEGIN');

        // Verify user belongs to tenant
        const userCheck = await client.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        // STEP 1: Delete all existing channel access for this user
        // This ensures we only have the selected items after this operation
        await client.query(`DELETE FROM user_inbound_email_access WHERE user_id = $1`, [id]);
        await client.query(`DELETE FROM user_outbound_email_access WHERE user_id = $1`, [id]);
        await client.query(`DELETE FROM user_phone_access WHERE user_id = $1`, [id]);
        await client.query(`DELETE FROM user_whatsapp_access WHERE user_id = $1`, [id]);

        // STEP 2: Insert selected inbound email access
        for (const inboundEmailId of inboundEmailIds) {
            await client.query(`
                INSERT INTO user_inbound_email_access (user_id, allowed_inbound_email_id, granted_by)
                VALUES ($1, $2, $3)
            `, [id, inboundEmailId, grantedBy]);
        }

        // STEP 3: Insert selected outbound email access
        // Deduplicate configs to avoid unique constraint violations
        const seenConfigs = new Set();
        const uniqueOutboundConfigs = outboundEmailConfigs.filter(config => {
            // Create a unique key based on the actual database unique constraints
            const keyConnection = config.email_connection_id ? `conn_${config.email_connection_id}` : null;
            const keyAllowedEmail = config.allowed_from_email_id ? `email_${config.allowed_from_email_id}` : null;
            const uniqueKey = keyConnection || keyAllowedEmail;
            
            if (!uniqueKey || seenConfigs.has(uniqueKey)) {
                return false; // Skip duplicates
            }
            seenConfigs.add(uniqueKey);
            return true;
        });

        for (const config of uniqueOutboundConfigs) {
            await client.query(`
                INSERT INTO user_outbound_email_access (
                    user_id, email_type, email_connection_id, 
                    ses_identity_id, allowed_from_email_id, granted_by
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                id,
                config.email_type,
                config.email_connection_id || null,
                config.ses_identity_id || null,
                config.allowed_from_email_id || null,
                grantedBy
            ]);
        }

        // STEP 4: Insert selected phone access
        for (const phoneConfigId of phoneConfigIds) {
            await client.query(`
                INSERT INTO user_phone_access (user_id, phone_config_id, granted_by)
                VALUES ($1, $2, $3)
            `, [id, phoneConfigId, grantedBy]);
        }

        // STEP 5: Insert selected WhatsApp access
        for (const whatsappAccountId of whatsappAccountIds) {
            await client.query(`
                INSERT INTO user_whatsapp_access (user_id, whatsapp_account_id, granted_by)
                VALUES ($1, $2, $3)
            `, [id, whatsappAccountId, grantedBy]);
        }

        await client.query('COMMIT');

        // Log deduplication info
        if (outboundEmailConfigs.length !== uniqueOutboundConfigs.length) {
            console.log(`Deduplicated outbound emails: ${outboundEmailConfigs.length} -> ${uniqueOutboundConfigs.length}`);
        }

        res.json({ 
            message: 'Channel access updated successfully',
            granted: {
                inbound_emails: inboundEmailIds.length,
                outbound_emails: uniqueOutboundConfigs.length,
                phones: phoneConfigIds.length,
                whatsapp: whatsappAccountIds.length
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Grant channel access error:', err);
        res.status(500).json({ error: 'Failed to update channel access', details: err.message });
    } finally {
        client.release();
    }
};


/**
 * PUT /api/users/:id - Update user details
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            UPDATE users
            SET name = COALESCE($1, name),
                status = COALESCE($2, status)
            WHERE id = $3 AND tenant_id = $4
            RETURNING id, email, name, status
        `, [name, status, id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Failed to update user', details: err.message });
    }
};

/**
 * DELETE /api/users/:id - Deactivate user
 */
exports.deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const currentUserId = req.user.id;

        // Prevent users from deactivating themselves
        if (id === currentUserId) {
            return res.status(403).json({ error: 'You cannot deactivate yourself' });
        }

        // Check if target user is a super admin
        const userCheck = await pool.query(`
            SELECT u.id, u.email, r.role_name
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE u.id = $1 AND u.tenant_id = $2
        `, [id, tenantId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if any of the user's roles is super_admin
        const isSuperAdmin = userCheck.rows.some(row => row.role_name === 'super_admin');
        if (isSuperAdmin) {
            return res.status(403).json({ error: 'Cannot deactivate a super admin user' });
        }

        const result = await pool.query(`
            UPDATE users
            SET status = 'disabled'
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, email
        `, [id, tenantId]);

        res.json({ message: 'User deactivated successfully' });
    } catch (err) {
        console.error('Deactivate user error:', err);
        res.status(500).json({ error: 'Failed to deactivate user', details: err.message });
    }
};


/**
 * GET /api/users - List all users in tenant
 */
exports.listUsers = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            SELECT 
                u.id,
                u.email,
                u.name,
                u.role as legacy_role,
                u.status,
                u.created_at,
                ARRAY_AGG(DISTINCT r.display_name) FILTER (WHERE r.id IS NOT NULL) as roles,
                COUNT(DISTINCT ula.lead_id) as assigned_leads_count,
                COUNT(DISTINCT uca.contact_id) as assigned_contacts_count
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            LEFT JOIN user_lead_assignments ula ON ula.user_id = u.id
            LEFT JOIN user_contact_assignments uca ON uca.user_id = u.id
            WHERE u.tenant_id = $1
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, [tenantId]);

        res.json({ users: result.rows });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to list users', details: err.message });
    }
};

/**
 * GET /api/users/:id - Get user details with permissions
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Get user basic info
        const userResult = await pool.query(`
            SELECT id, email, name, role, status, created_at
            FROM users
            WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get roles
        const rolesResult = await pool.query(`
            SELECT r.id, r.role_name, r.display_name, r.description
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1
        `, [id]);

        // Get direct permissions
        const permsResult = await pool.query(`
            SELECT p.id, p.permission_key, p.display_name, up.granted
            FROM user_permissions up
            JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = $1
        `, [id]);

        // Get assigned leads
        const leadsResult = await pool.query(`
            SELECT l.id, c.name as contact_name, l.status
            FROM user_lead_assignments ula
            JOIN leads l ON l.id = ula.lead_id
            JOIN contacts c ON c.id = l.contact_id
            WHERE ula.user_id = $1
            LIMIT 50
        `, [id]);

        // Get assigned contacts
        const contactsResult = await pool.query(`
            SELECT c.id, c.name, c.email
            FROM user_contact_assignments uca
            JOIN contacts c ON c.id = uca.contact_id
            WHERE uca.user_id = $1
            LIMIT 50
        `, [id]);

        // Get inbound email access
        const inboundEmailsResult = await pool.query(`
            SELECT aie.id, aie.email_address
            FROM user_inbound_email_access uiea
            JOIN allowed_inbound_emails aie ON aie.id = uiea.allowed_inbound_email_id
            WHERE uiea.user_id = $1
        `, [id]);

        // Get outbound email access
        const outboundEmailsResult = await pool.query(`
            SELECT 
                COALESCE(uoea.email_connection_id, uoea.allowed_from_email_id) as id,
                uoea.email_type,
                uoea.email_connection_id,
                uoea.ses_identity_id,
                uoea.allowed_from_email_id,
                COALESCE(tec.email_address, tafe.email_address) as email_address,
                COALESCE(tec.display_name, ep.provider_type) as provider
            FROM user_outbound_email_access uoea
            LEFT JOIN tenant_email_connections tec ON tec.id = uoea.email_connection_id
            LEFT JOIN tenant_allowed_from_emails tafe ON tafe.id = uoea.allowed_from_email_id
            LEFT JOIN email_providers ep ON ep.id = tec.provider_id
            WHERE uoea.user_id = $1
        `, [id]);

        // Get phone access
        const phoneResult = await pool.query(`
            SELECT tpc.id, tpc.phone_number
            FROM user_phone_access upa
            JOIN tenant_phone_config tpc ON tpc.id = upa.phone_config_id
            WHERE upa.user_id = $1
        `, [id]);

        res.json({
            user: {
                ...user,
                roles: rolesResult.rows,
                direct_permissions: permsResult.rows,
                assigned_leads: leadsResult.rows,
                assigned_contacts: contactsResult.rows,
                inbound_emails: inboundEmailsResult.rows,
                outbound_emails: outboundEmailsResult.rows,
                phone_numbers: phoneResult.rows
            }
        });
    } catch (err) {
        console.error('Get user details error:', err);
        res.status(500).json({ error: 'Failed to get user details', details: err.message });
    }
};

/**
 * POST /api/users/invite - Invite a new user
 */
exports.inviteUser = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            email, 
            roleIds = [], 
            permissionOverrides = {}, 
            assignedLeadIds = [],
            assignedContactIds = [],
            inboundEmailIds = [],
            outboundEmailConfigs = [],
            phoneConfigIds = []
        } = req.body;
        
        const tenantId = req.user.tenantId;
        const invitedBy = req.user.id;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await client.query('BEGIN');

        // Check if user already exists
        const existingUser = await client.query(
            `SELECT id FROM users WHERE email = $1 AND tenant_id = $2`,
            [email.toLowerCase(), tenantId]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'User already exists in this tenant' });
        }

        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString('hex');

        // Create invitation
        const invitationResult = await client.query(`
            INSERT INTO user_invitations (
                tenant_id, email, invited_by, invitation_token,
                role_ids, permission_overrides, assigned_lead_ids, assigned_contact_ids,
                status, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now() + interval '7 days')
            RETURNING id, invitation_token, expires_at
        `, [
            tenantId,
            email.toLowerCase(),
            invitedBy,
            invitationToken,
            roleIds,
            JSON.stringify(permissionOverrides),
            assignedLeadIds,
            assignedContactIds
        ]);

        const invitation = invitationResult.rows[0];

        // TODO: Send invitation email
        // await sendInvitationEmail(email, invitationToken, req.user.tenant_name);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'User invitation sent successfully',
            invitation: {
                id: invitation.id,
                email: email,
                invitation_link: `${process.env.FRONTEND_URL}/accept-invitation/${invitation.invitation_token}`,
                expires_at: invitation.expires_at
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Invite user error:', err);
        res.status(500).json({ error: 'Failed to invite user', details: err.message });
    } finally {
        client.release();
    }
};

/**
 * POST /api/users/:id/assign-roles - Assign roles to user
 */
exports.assignRoles = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(roleIds)) {
            return res.status(400).json({ error: 'roleIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Clear existing roles
        await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);

        // Assign new roles
        for (const roleId of roleIds) {
            await pool.query(`
                INSERT INTO user_roles (user_id, role_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, role_id) DO NOTHING
            `, [id, roleId, assignedBy]);
        }

        res.json({ message: 'Roles assigned successfully' });
    } catch (err) {
        console.error('Assign roles error:', err);
        res.status(500).json({ error: 'Failed to assign roles', details: err.message });
    }
};

/**
 * POST /api/users/:id/grant-permissions - Grant/revoke direct permissions
 */
exports.grantPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body; // { permissionId: granted (boolean) }
        const tenantId = req.user.tenantId;
        const grantedBy = req.user.id;

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Grant/revoke permissions
        for (const [permissionId, granted] of Object.entries(permissions)) {
            await pool.query(`
                INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, permission_id) 
                DO UPDATE SET granted = $3, granted_by = $4, granted_at = now()
            `, [id, permissionId, granted, grantedBy]);
        }

        res.json({ message: 'Permissions updated successfully' });
    } catch (err) {
        console.error('Grant permissions error:', err);
        res.status(500).json({ error: 'Failed to grant permissions', details: err.message });
    }
};

/**
 * POST /api/users/:id/assign-leads - Assign leads to user
 */
exports.assignLeads = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'leadIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Assign leads
        for (const leadId of leadIds) {
            await pool.query(`
                INSERT INTO user_lead_assignments (user_id, lead_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, lead_id) DO NOTHING
            `, [id, leadId, assignedBy]);

            // Also update lead owner_id for backward compatibility
            // FIXED: Set updated_by to track who assigned
            await pool.query(`
                UPDATE leads SET owner_id = $1, updated_by = $3 WHERE id = $2
            `, [id, leadId, assignedBy]);
        }

        res.json({ message: 'Leads assigned successfully', count: leadIds.length });
    } catch (err) {
        console.error('Assign leads error:', err);
        res.status(500).json({ error: 'Failed to assign leads', details: err.message });
    }
};

/**
 * PUT /api/users/:id - Update user details
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            UPDATE users
            SET name = COALESCE($1, name),
                status = COALESCE($2, status)
            WHERE id = $3 AND tenant_id = $4
            RETURNING id, email, name, status
        `, [name, status, id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Failed to update user', details: err.message });
    }
};

/**
 * DELETE /api/users/:id - Deactivate user
 */
exports.deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const result = await pool.query(`
            UPDATE users
            SET status = 'disabled'
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, email
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deactivated successfully' });
    } catch (err) {
        console.error('Deactivate user error:', err);
        res.status(500).json({ error: 'Failed to deactivate user', details: err.message });
    }
};

/**
 * POST /api/users/:id/assign-contacts - Assign contacts to a user
 */
exports.assignContacts = async (req, res) => {
    try {
        const { id } = req.params;
        const { contactIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(contactIds)) {
            return res.status(400).json({ error: 'contactIds must be an array' });
        }

        // Verify user exists
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Insert contact assignments
        for (const contactId of contactIds) {
            await pool.query(`
                INSERT INTO user_contact_assignments (user_id, contact_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, contact_id) DO NOTHING
            `, [id, contactId, assignedBy]);
        }

        res.json({ message: 'Contacts assigned successfully', count: contactIds.length });
    } catch (err) {
        console.error('Assign contacts error:', err);
        res.status(500).json({ error: 'Failed to assign contacts', details: err.message });
    }
};

/**
 * POST /api/users/create - Create a new user directly
 */
exports.createUser = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            email, 
            name,
            password,
            roleIds = [], 
            permissionOverrides = {}, 
            assignedLeadIds = [],
            assignedContactIds = [],
            phoneConfigIds = []
        } = req.body;
        
        const tenantId = req.user.tenantId;

        if (!email || !name || !password) {
            return res.status(400).json({ error: 'Email, name, and password are required' });
        }

        await client.query('BEGIN');

        // Check if user already exists
        const existingUser = await client.query(
            `SELECT id FROM users WHERE email = $1 AND tenant_id = $2`,
            [email.toLowerCase(), tenantId]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'User already exists in this tenant' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userResult = await client.query(`
            INSERT INTO users (
                tenant_id, email, name, password_hash, 
                role, status, created_at
            ) VALUES ($1, $2, $3, $4, 'agent', 'active', now())
            RETURNING id, email, name, status
        `, [tenantId, email.toLowerCase(), name, hashedPassword]);

        const user = userResult.rows[0];

        // Assign Roles
        if (roleIds.length > 0) {
            for (const roleId of roleIds) {
                await client.query(`
                    INSERT INTO user_roles (user_id, role_id, assigned_by)
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                `, [user.id, roleId, req.user.id]);
            }
        }


        await client.query('COMMIT');

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                status: user.status
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Failed to create user', details: err.message });
    } finally {
        client.release();
    }
};

/**
 * POST /api/users/:id/assign-contact-groups - Assign contact groups to user
 */
exports.assignContactGroups = async (req, res) => {
    try {
        const { id } = req.params;
        const { groupIds } = req.body;
        const tenantId = req.user.tenantId;
        const assignedBy = req.user.id;

        if (!Array.isArray(groupIds)) {
            return res.status(400).json({ error: 'groupIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Clear existing group assignments for this user
        await pool.query(
            `DELETE FROM user_contact_group_assignments WHERE user_id = $1`,
            [id]
        );

        // Assign new groups
        for (const groupId of groupIds) {
            await pool.query(`
                INSERT INTO user_contact_group_assignments (user_id, contact_group_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, contact_group_id) DO NOTHING
            `, [id, groupId, assignedBy]);
        }

        res.json({ message: 'Contact groups assigned successfully', count: groupIds.length });
    } catch (err) {
        console.error('Assign contact groups error:', err);
        res.status(500).json({ error: 'Failed to assign contact groups', details: err.message });
    }
};

/**
 * GET /api/users/:id/contact-groups - Get user's assigned contact groups
 */
exports.getUserContactGroups = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Verify user belongs to tenant
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await pool.query(`
            SELECT cg.id, cg.name, cg.description, ucga.assigned_at
            FROM user_contact_group_assignments ucga
            JOIN contact_groups cg ON cg.id = ucga.contact_group_id
            WHERE ucga.user_id = $1
            ORDER BY cg.name
        `, [id]);

        res.json({ contactGroups: result.rows });
    } catch (err) {
        console.error('Get user contact groups error:', err);
        res.status(500).json({ error: 'Failed to get user contact groups', details: err.message });
    }
};

