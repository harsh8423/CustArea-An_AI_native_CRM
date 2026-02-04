const { pool } = require('../config/db');

/**
 * GET /api/roles - List all roles for tenant
 */
exports.listRoles = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Get both system roles (tenant_id IS NULL) and tenant-specific custom roles
        const result = await pool.query(`
            SELECT 
                r.id,
                r.role_name,
                r.display_name,
                r.description,
                r.is_system_role,
                r.tenant_id,
                r.created_at,
                COUNT(DISTINCT ur.user_id) as user_count,
                COUNT(DISTINCT rp.permission_id) as permission_count
            FROM roles r
            LEFT JOIN user_roles ur ON ur.role_id = r.id AND ur.user_id IN (
                SELECT id FROM users WHERE tenant_id = $1
            )
            LEFT JOIN role_permissions rp ON rp.role_id = r.id
            WHERE r.tenant_id = $1 OR r.tenant_id IS NULL
            GROUP BY r.id
            ORDER BY r.is_system_role DESC, r.display_name
        `, [tenantId]);

        res.json({ roles: result.rows });
    } catch (err) {
        console.error('List roles error:', err);
        res.status(500).json({ error: 'Failed to list roles', details: err.message });
    }
};

/**
 * GET /api/roles/:id - Get role details with permissions
 */
exports.getRoleDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Get role basic info (allow system roles or tenant-specific roles)
        const roleResult = await pool.query(`
            SELECT id, role_name, display_name, description, is_system_role, tenant_id, created_at
            FROM roles
            WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
        `, [id, tenantId]);

        if (roleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const role = roleResult.rows[0];

        // Get assigned permissions
        const permsResult = await pool.query(`
            SELECT p.id, p.permission_key, p.display_name, p.category, p.description
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = $1
            ORDER BY p.category, p.display_name
        `, [id]);

        res.json({
            role: {
                ...role,
                permissions: permsResult.rows
            }
        });
    } catch (err) {
        console.error('Get role details error:', err);
        res.status(500).json({ error: 'Failed to get role details', details: err.message });
    }
};

/**
 * POST /api/roles - Create a custom role
 */
exports.createRole = async (req, res) => {
    try {
        const { role_name, display_name, description, permissionIds = [] } = req.body;
        const tenantId = req.user.tenantId;
        const createdBy = req.user.id;

        if (!role_name || !display_name) {
            return res.status(400).json({ error: 'role_name and display_name are required' });
        }

        // Check for duplicate role name
        const existing = await pool.query(`
            SELECT id FROM roles WHERE tenant_id = $1 AND role_name = $2
        `, [tenantId, role_name]);

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Role name already exists' });
        }

        // Create role
        const roleResult = await pool.query(`
            INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role, created_by)
            VALUES ($1, $2, $3, $4, false, $5)
            RETURNING id, role_name, display_name, description
        `, [tenantId, role_name, display_name, description, createdBy]);

        const role = roleResult.rows[0];

        // Assign permissions
        for (const permissionId of permissionIds) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ($1, $2)
            `, [role.id, permissionId]);
        }

        res.status(201).json({
            message: 'Role created successfully',
            role
        });
    } catch (err) {
        console.error('Create role error:', err);
        res.status(500).json({ error: 'Failed to create role', details: err.message });
    }
};

/**
 * PUT /api/roles/:id - Update role
 */
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, description } = req.body;
        const tenantId = req.user.tenantId;

        // Check if role is system role
        const roleCheck = await pool.query(`
            SELECT is_system_role FROM roles WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        if (roleCheck.rows[0].is_system_role) {
            return res.status(403).json({ error: 'Cannot modify system roles' });
        }

        const result = await pool.query(`
            UPDATE roles
            SET display_name = COALESCE($1, display_name),
                description = COALESCE($2, description)
            WHERE id = $3 AND tenant_id = $4
            RETURNING id, role_name, display_name, description
        `, [display_name, description, id, tenantId]);

        res.json({ message: 'Role updated successfully', role: result.rows[0] });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: 'Failed to update role', details: err.message });
    }
};

/**
 * DELETE /api/roles/:id - Delete custom role
 */
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Check if role is system role
        const roleCheck = await pool.query(`
            SELECT is_system_role FROM roles WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        if (roleCheck.rows[0].is_system_role) {
            return res.status(403).json({ error: 'Cannot delete system roles' });
        }

        await pool.query(`DELETE FROM roles WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);

        res.json({ message: 'Role deleted successfully' });
    } catch (err) {
        console.error('Delete role error:', err);
        res.status(500).json({ error: 'Failed to delete role', details: err.message });
    }
};

/**
 * POST /api/roles/:id/permissions - Assign permissions to role
 */
exports.assignPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissionIds } = req.body;
        const tenantId = req.user.tenantId;

        if (!Array.isArray(permissionIds)) {
            return res.status(400).json({ error: 'permissionIds must be an array' });
        }

        // Verify role belongs to tenant
        const roleCheck = await pool.query(`
            SELECT id FROM roles WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // Clear existing permissions
        await pool.query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);

        // Assign new permissions
        for (const permissionId of permissionIds) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ($1, $2)
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `, [id, permissionId]);
        }

        res.json({ message: 'Permissions assigned successfully' });
    } catch (err) {
        console.error('Assign permissions error:', err);
        res.status(500).json({ error: 'Failed to assign permissions', details: err.message });
    }
};
