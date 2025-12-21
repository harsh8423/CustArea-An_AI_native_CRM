/**
 * Manual Trigger Routes - API endpoint to manually trigger workflows
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/jwtAuth');
const executorPool = require('../engine/executorPool');
const logger = require('../utils/logger');

router.use(authenticateToken);

/**
 * POST /api/workflows/trigger/:workflowId - Manually trigger a workflow
 */
router.post('/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { payload = {} } = req.body;
        
        // Get workflow and published version
        const wfResult = await pool.query(`
            SELECT w.*, v.id as version_id
            FROM workflows w
            JOIN workflow_versions v ON v.workflow_id = w.id AND v.is_published = true
            WHERE w.id = $1 AND w.tenant_id = $2 AND w.status = 'active'
            ORDER BY v.version_number DESC
            LIMIT 1
        `, [workflowId, req.tenantId]);
        
        if (wfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found or not published' });
        }
        
        const workflow = wfResult.rows[0];
        
        // Check rate limit
        const rateResult = await pool.query(`
            SELECT COUNT(*) FROM workflow_runs 
            WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '1 minute'
        `, [req.tenantId]);
        
        if (parseInt(rateResult.rows[0].count) >= 10) {
            return res.status(429).json({ error: 'Rate limit exceeded (10 runs/minute)' });
        }
        
        // Create run
        const triggerData = {
            ...payload,
            triggered_by: 'manual',
            triggered_at: new Date().toISOString(),
            user_id: req.user.userId || req.user.id
        };
        
        const runResult = await pool.query(`
            INSERT INTO workflow_runs (workflow_id, version_id, tenant_id, trigger_data, context, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id
        `, [workflow.id, workflow.version_id, req.tenantId, 
            JSON.stringify(triggerData), JSON.stringify({ trigger: triggerData })]);
        
        const runId = runResult.rows[0].id;
        
        // Submit to executor pool
        executorPool.submit(runId);
        
        logger.info(`[Trigger] Manual trigger for workflow ${workflow.name}, run ${runId}`);
        
        res.status(202).json({
            message: 'Workflow triggered',
            run_id: runId,
            workflow_id: workflow.id
        });
    } catch (error) {
        logger.error('Error triggering workflow:', error);
        res.status(500).json({ error: 'Failed to trigger workflow' });
    }
});

/**
 * POST /api/workflows/trigger/:workflowId/test - Dry run / simulation
 */
router.post('/:workflowId/test', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { payload = {}, version_id } = req.body;
        
        // Get workflow version
        let versionQuery = `
            SELECT v.*, w.name as workflow_name
            FROM workflow_versions v
            JOIN workflows w ON w.id = v.workflow_id
            WHERE w.id = $1 AND w.tenant_id = $2
        `;
        const params = [workflowId, req.tenantId];
        
        if (version_id) {
            versionQuery += ` AND v.id = $3`;
            params.push(version_id);
        } else {
            versionQuery += ` ORDER BY v.version_number DESC LIMIT 1`;
        }
        
        const versionResult = await pool.query(versionQuery, params);
        
        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow version not found' });
        }
        
        const version = versionResult.rows[0];
        
        // Simulate execution (just validate and return node order)
        const { validateGraph, getExecutionOrder } = require('../engine/graphTraversal');
        const { resolveConfig } = require('../engine/context');
        
        const validation = validateGraph(version.nodes || [], version.edges || []);
        if (!validation.valid) {
            return res.status(400).json({ 
                error: 'Invalid workflow',
                details: validation.errors 
            });
        }
        
        const executionOrder = getExecutionOrder(version.nodes || [], version.edges || []);
        
        // Simulate context with trigger data
        const simulatedContext = { trigger: payload };
        
        const simulation = executionOrder.map(node => ({
            node_id: node.id,
            node_type: node.type,
            label: node.data?.label || node.id,
            config: node.data?.config || {},
            resolved_config: resolveConfig(node.data?.config || {}, simulatedContext)
        }));
        
        res.json({
            valid: true,
            workflow_name: version.workflow_name,
            version_number: version.version_number,
            execution_order: simulation
        });
    } catch (error) {
        logger.error('Error simulating workflow:', error);
        res.status(500).json({ error: 'Failed to simulate workflow' });
    }
});

module.exports = router;
