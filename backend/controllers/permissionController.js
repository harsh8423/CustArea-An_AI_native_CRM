const { pool } = require('../config/db');
const { getUserPermissions } = require('../services/permissionService');

/**
 * GET /api/permissions - List all available permissions
 */
exports.listAllPermissions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, permission_key, display_name, description, category, resource_type
            FROM permissions
            ORDER BY category, display_name
        `);

        // Group by category for better UX
        const grouped = result.rows.reduce((acc, perm) => {
            if (!acc[perm.category]) {
                acc[perm.category] = [];
            }
            acc[perm.category].push(perm);
            return acc;
        }, {});

        res.json({ 
            permissions: result.rows,
            grouped: grouped 
        });
    } catch (err) {
        console.error('List permissions error:', err);
        res.status(500).json({ error: 'Failed to list permissions', details: err.message });
    }
};

/**
 * GET /api/users/me/permissions - Get current user's effective permissions
 */
exports.getCurrentUserPermissions = async (req, res) => {
    try {
        const userId = req.user.id;

        const permissions = await getUserPermissions(userId);

        res.json({ permissions });
    } catch (err) {
        console.error('Get user permissions error:', err);
        res.status(500).json({ error: 'Failed to get permissions', details: err.message });
    }
};
