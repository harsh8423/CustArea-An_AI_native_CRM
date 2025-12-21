/**
 * Node Definition Routes - Get available node types
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { extractTenant } = require('../middleware/jwtAuth');
const logger = require('../utils/logger');

// Optional auth - node definitions are generally public within the app
router.use(extractTenant);

/**
 * GET /api/workflows/node-definitions - Get all node definitions
 */
router.get('/', async (req, res) => {
    try {
        const { category, active_only = 'true' } = req.query;
        
        let query = `
            SELECT * FROM workflow_node_definitions
        `;
        const params = [];
        const conditions = [];
        
        if (active_only === 'true') {
            conditions.push('is_active = true');
        }
        
        if (category) {
            params.push(category);
            conditions.push(`category = $${params.length}`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY category, sort_order, name';
        
        const result = await pool.query(query, params);
        
        // Group by category
        const grouped = {};
        for (const node of result.rows) {
            if (!grouped[node.category]) {
                grouped[node.category] = [];
            }
            grouped[node.category].push(node);
        }
        
        res.json({
            nodes: result.rows,
            by_category: grouped
        });
    } catch (error) {
        logger.error('Error getting node definitions:', error);
        res.status(500).json({ error: 'Failed to get node definitions' });
    }
});

/**
 * GET /api/workflows/node-definitions/:type - Get single node definition
 */
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM workflow_node_definitions WHERE type = $1
        `, [type]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Node type not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error getting node definition:', error);
        res.status(500).json({ error: 'Failed to get node definition' });
    }
});

/**
 * GET /api/workflows/node-definitions/categories/list - Get category list
 */
router.get('/categories/list', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT category, COUNT(*) as node_count
            FROM workflow_node_definitions
            WHERE is_active = true
            GROUP BY category
            ORDER BY 
                CASE category 
                    WHEN 'trigger' THEN 1
                    WHEN 'logic' THEN 2
                    WHEN 'ai' THEN 3
                    WHEN 'output' THEN 4
                    WHEN 'utility' THEN 5
                    ELSE 6
                END
        `);
        
        res.json({ categories: result.rows });
    } catch (error) {
        logger.error('Error getting categories:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

module.exports = router;
