/**
 * Run Routes - Workflow execution history and logs
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/jwtAuth');
const logger = require('../utils/logger');

router.use(authenticateToken);

/**
 * GET /api/workflows/runs - List runs for tenant
 */
router.get('/', async (req, res) => {
    try {
        const { workflow_id, status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT r.*, w.name as workflow_name
            FROM workflow_runs r
            JOIN workflows w ON w.id = r.workflow_id
            WHERE r.tenant_id = $1
        `;
        const params = [req.tenantId];
        
        if (workflow_id) {
            query += ` AND r.workflow_id = $${params.length + 1}`;
            params.push(workflow_id);
        }
        
        if (status) {
            query += ` AND r.status = $${params.length + 1}`;
            params.push(status);
        }
        
        query += `
            ORDER BY r.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await pool.query(query, params);
        
        res.json({
            runs: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        logger.error('Error listing runs:', error);
        res.status(500).json({ error: 'Failed to list runs' });
    }
});

/**
 * GET /api/workflows/runs/:id - Get run details
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const runResult = await pool.query(`
            SELECT r.*, w.name as workflow_name, v.nodes, v.edges
            FROM workflow_runs r
            JOIN workflows w ON w.id = r.workflow_id
            JOIN workflow_versions v ON v.id = r.version_id
            WHERE r.id = $1 AND r.tenant_id = $2
        `, [id, req.tenantId]);
        
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }
        
        res.json(runResult.rows[0]);
    } catch (error) {
        logger.error('Error getting run:', error);
        res.status(500).json({ error: 'Failed to get run' });
    }
});

/**
 * GET /api/workflows/runs/:id/logs - Get run logs
 */
router.get('/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const { level, limit = 100 } = req.query;
        
        // Verify ownership
        const runResult = await pool.query(`
            SELECT id FROM workflow_runs WHERE id = $1 AND tenant_id = $2
        `, [id, req.tenantId]);
        
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }
        
        let query = `
            SELECT * FROM workflow_run_logs WHERE run_id = $1
        `;
        const params = [id];
        
        if (level) {
            query += ` AND level = $${params.length + 1}`;
            params.push(level);
        }
        
        query += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        res.json({ logs: result.rows });
    } catch (error) {
        logger.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

/**
 * GET /api/workflows/runs/:id/nodes - Get per-node execution results
 */
router.get('/:id/nodes', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const runResult = await pool.query(`
            SELECT id FROM workflow_runs WHERE id = $1 AND tenant_id = $2
        `, [id, req.tenantId]);
        
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }
        
        const result = await pool.query(`
            SELECT * FROM workflow_run_nodes WHERE run_id = $1 ORDER BY started_at ASC
        `, [id]);
        
        res.json({ nodes: result.rows });
    } catch (error) {
        logger.error('Error getting node results:', error);
        res.status(500).json({ error: 'Failed to get node results' });
    }
});

/**
 * POST /api/workflows/runs/:id/cancel - Cancel a running workflow
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            UPDATE workflow_runs
            SET status = 'cancelled', completed_at = now()
            WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'running', 'waiting')
            RETURNING id
        `, [id, req.tenantId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found or not cancellable' });
        }
        
        // Cancel any scheduled jobs
        await pool.query(`
            UPDATE workflow_scheduled_jobs SET status = 'cancelled' WHERE run_id = $1
        `, [id]);
        
        res.json({ message: 'Run cancelled' });
    } catch (error) {
        logger.error('Error cancelling run:', error);
        res.status(500).json({ error: 'Failed to cancel run' });
    }
});

module.exports = router;
