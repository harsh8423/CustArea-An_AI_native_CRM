/**
 * Workflow CRUD Routes
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/jwtAuth');
const { validateGraph } = require('../engine/graphTraversal');
const logger = require('../utils/logger');

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/workflows - List workflows for tenant
 */
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT w.*, 
                   lv.version_number as latest_version,
                   lv.is_published,
                   (SELECT COUNT(*) FROM workflow_runs WHERE workflow_id = w.id) as run_count
            FROM workflows w
            LEFT JOIN LATERAL (
                SELECT version_number, is_published 
                FROM workflow_versions 
                WHERE workflow_id = w.id 
                ORDER BY version_number DESC 
                LIMIT 1
            ) lv ON true
            WHERE w.tenant_id = $1
        `;
        const params = [req.tenantId];
        
        if (status) {
            query += ` AND w.status = $${params.length + 1}`;
            params.push(status);
        }
        
        query += `
            ORDER BY w.updated_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await pool.query(query, params);
        
        res.json({
            workflows: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        logger.error('Error listing workflows:', error);
        res.status(500).json({ error: 'Failed to list workflows' });
    }
});

/**
 * GET /api/workflows/:id - Get workflow details
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { version } = req.query;
        
        // Get workflow
        const wfResult = await pool.query(`
            SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2
        `, [id, req.tenantId]);
        
        if (wfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const workflow = wfResult.rows[0];
        
        // Get version (latest or specific)
        let versionQuery = `
            SELECT * FROM workflow_versions WHERE workflow_id = $1
        `;
        const versionParams = [id];
        
        if (version) {
            versionQuery += ` AND version_number = $2`;
            versionParams.push(parseInt(version));
        } else {
            versionQuery += ` ORDER BY version_number DESC LIMIT 1`;
        }
        
        const versionResult = await pool.query(versionQuery, versionParams);
        
        // Get all versions list
        const versionsListResult = await pool.query(`
            SELECT id, version_number, is_published, created_at
            FROM workflow_versions
            WHERE workflow_id = $1
            ORDER BY version_number DESC
        `, [id]);
        
        res.json({
            ...workflow,
            current_version: versionResult.rows[0] || null,
            versions: versionsListResult.rows
        });
    } catch (error) {
        logger.error('Error getting workflow:', error);
        res.status(500).json({ error: 'Failed to get workflow' });
    }
});

/**
 * POST /api/workflows - Create new workflow
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, nodes = [], edges = [] } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Validate graph if provided
        if (nodes.length > 0) {
            const validation = validateGraph(nodes, edges);
            if (!validation.valid) {
                return res.status(400).json({ error: 'Invalid workflow graph', details: validation.errors });
            }
        }
        
        // Create workflow
        const wfResult = await pool.query(`
            INSERT INTO workflows (tenant_id, name, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.tenantId, name, description || '', req.user.userId || req.user.id]);
        
        const workflow = wfResult.rows[0];
        
        // Create initial version
        const versionResult = await pool.query(`
            INSERT INTO workflow_versions (workflow_id, version_number, nodes, edges, created_by)
            VALUES ($1, 1, $2, $3, $4)
            RETURNING *
        `, [workflow.id, JSON.stringify(nodes), JSON.stringify(edges), req.user.userId || req.user.id]);
        
        res.status(201).json({
            ...workflow,
            current_version: versionResult.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Workflow with this name already exists' });
        }
        logger.error('Error creating workflow:', error);
        res.status(500).json({ error: 'Failed to create workflow' });
    }
});

/**
 * PUT /api/workflows/:id - Update workflow
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;
        
        const result = await pool.query(`
            UPDATE workflows
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                updated_at = now()
            WHERE id = $4 AND tenant_id = $5
            RETURNING *
        `, [name, description, status, id, req.tenantId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

/**
 * POST /api/workflows/:id/versions - Save new version
 */
router.post('/:id/versions', async (req, res) => {
    try {
        const { id } = req.params;
        const { nodes, edges, variables, settings } = req.body;
        
        // Verify ownership
        const wfResult = await pool.query(`
            SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2
        `, [id, req.tenantId]);
        
        if (wfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        // Validate graph
        const validation = validateGraph(nodes || [], edges || []);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Invalid workflow graph', details: validation.errors });
        }
        
        // Get next version number
        const versionNumResult = await pool.query(`
            SELECT COALESCE(MAX(version_number), 0) + 1 as next FROM workflow_versions WHERE workflow_id = $1
        `, [id]);
        
        const nextVersion = versionNumResult.rows[0].next;
        
        // Unpublish all previous versions so events go to the new version
        await pool.query(`
            UPDATE workflow_versions SET is_published = false WHERE workflow_id = $1
        `, [id]);
        
        // Create new version (starts as unpublished, user will publish when ready)
        const result = await pool.query(`
            INSERT INTO workflow_versions (workflow_id, version_number, nodes, edges, variables, settings, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [id, nextVersion, JSON.stringify(nodes || []), JSON.stringify(edges || []), 
            JSON.stringify(variables || []), JSON.stringify(settings || {}), req.user.userId || req.user.id]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error saving version:', error);
        res.status(500).json({ error: 'Failed to save version' });
    }
});

/**
 * POST /api/workflows/:id/publish - Publish a version
 */
router.post('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const { version_id } = req.body;
        
        // Verify ownership
        const wfResult = await pool.query(`
            SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2
        `, [id, req.tenantId]);
        
        if (wfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        // Get version to publish
        const versionResult = await pool.query(`
            SELECT * FROM workflow_versions WHERE id = $1 AND workflow_id = $2
        `, [version_id, id]);
        
        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        const version = versionResult.rows[0];
        
        // Validate graph
        const validation = validateGraph(version.nodes || [], version.edges || []);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Cannot publish invalid workflow', details: validation.errors });
        }
        
        // Unpublish other versions
        await pool.query(`
            UPDATE workflow_versions SET is_published = false WHERE workflow_id = $1
        `, [id]);
        
        // Publish this version
        await pool.query(`
            UPDATE workflow_versions SET is_published = true, published_at = now() WHERE id = $1
        `, [version_id]);
        
        // Extract ALL trigger nodes and their types
        const triggerNodes = (version.nodes || []).filter(n => 
            n.type?.includes('trigger') || n.type?.includes('message') || n.type?.includes('received')
        );
        
        // Collect all trigger types (for multi-trigger support)
        const triggerTypes = [...new Set(triggerNodes.map(n => n.type).filter(Boolean))];
        const primaryTrigger = triggerNodes[0]; // First trigger for legacy column
        
        await pool.query(`
            UPDATE workflows 
            SET status = 'active', 
                trigger_type = $1,
                trigger_types = $2,
                trigger_config = $3,
                updated_at = now()
            WHERE id = $4
        `, [
            primaryTrigger?.type, 
            triggerTypes, // PostgreSQL TEXT[] 
            JSON.stringify(primaryTrigger?.data?.config || {}), 
            id
        ]);
        
        res.json({ message: 'Workflow published', version_id });
    } catch (error) {
        logger.error('Error publishing workflow:', error);
        res.status(500).json({ error: 'Failed to publish workflow' });
    }
});

/**
 * DELETE /api/workflows/:id - Delete workflow
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            DELETE FROM workflows WHERE id = $1 AND tenant_id = $2 RETURNING id
        `, [id, req.tenantId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        res.json({ message: 'Workflow deleted' });
    } catch (error) {
        logger.error('Error deleting workflow:', error);
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

module.exports = router;
