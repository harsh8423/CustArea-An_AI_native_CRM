/**
 * Node Execution Routes
 * Execute individual nodes for testing/preview
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/jwtAuth');
const { traverseGraph } = require('../engine/graphTraversal');
const { resolveConfig, addToContext, evaluateExpression } = require('../engine/context');
const nodeRegistry = require('../nodes/registry');
const logger = require('../utils/logger');

router.use(authenticateToken);

/**
 * POST /api/workflows/:workflowId/execute-node
 * Execute a single node (optionally with upstream nodes)
 */
router.post('/:workflowId/execute-node', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { nodeId, versionId, executeUpstream = true, testInput = {} } = req.body;

        if (!nodeId) {
            return res.status(400).json({ error: 'nodeId is required' });
        }

        // Fetch workflow and version
        const wfResult = await pool.query(`
            SELECT w.*, v.nodes, v.edges 
            FROM workflows w
            JOIN workflow_versions v ON v.workflow_id = w.id
            WHERE w.id = $1 AND w.tenant_id = $2 AND v.id = $3
        `, [workflowId, req.tenantId, versionId]);

        if (wfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow or version not found' });
        }

        const workflow = wfResult.rows[0];
        const nodes = workflow.nodes || [];
        const edges = workflow.edges || [];

        // Find target node
        const targetNode = nodes.find(n => n.id === nodeId);
        if (!targetNode) {
            return res.status(404).json({ error: 'Node not found in workflow' });
        }

        // Build execution order
        let nodesToExecute = [targetNode];
        const upstreamOutputs = {};

        if (executeUpstream) {
            // Find all nodes leading to this one (topological order)
            const executionOrder = getExecutionOrder(nodes, edges, nodeId);
            nodesToExecute = executionOrder;
        }

        // Initialize context with trigger data
        let context = { trigger: testInput };
        const startTime = Date.now();

        // Execute nodes in order
        for (const node of nodesToExecute) {
            const nodeHandler = nodeRegistry.getHandler(node.type);
            if (!nodeHandler) {
                logger.warn(`[NodeExecution] No handler for node type: ${node.type}`);
                upstreamOutputs[node.id] = { _error: `Unknown node type: ${node.type}` };
                continue;
            }

            try {
                // Resolve config with current context
                const resolvedConfig = resolveConfig(node.data?.config || {}, context);

                // Create log function
                const logs = [];
                const log = async (level, message, data) => {
                    logs.push({ level, message, data, timestamp: new Date().toISOString() });
                };

                // Execute node - pass all required dependencies
                const output = await nodeHandler.execute({
                    config: resolvedConfig,
                    context,
                    log,
                    runId: `test-${Date.now()}`,
                    tenantId: req.tenantId,
                    // Required for output nodes (send_email, send_whatsapp, etc.)
                    pool,
                    tenant: { id: req.tenantId },
                    run: { id: `test-${Date.now()}` },
                });

                // Add to context
                context = addToContext(context, node.id, output);
                upstreamOutputs[node.id] = {
                    output,
                    logs,
                    executedAt: new Date().toISOString()
                };

                logger.debug(`[NodeExecution] Executed ${node.id}`, { output });

            } catch (error) {
                logger.error(`[NodeExecution] Node ${node.id} failed:`, error);
                upstreamOutputs[node.id] = {
                    _error: error.message,
                    _stack: error.stack
                };
                
                // Stop execution on error
                if (node.id === nodeId) {
                    return res.status(400).json({
                        success: false,
                        error: error.message,
                        nodeId,
                        upstreamOutputs,
                        executionTime: Date.now() - startTime
                    });
                }
            }
        }

        // Get target node output
        const targetOutput = upstreamOutputs[nodeId]?.output || null;

        res.json({
            success: true,
            nodeId,
            output: targetOutput,
            upstreamOutputs,
            executionTime: Date.now() - startTime,
            context
        });

    } catch (error) {
        logger.error('[NodeExecution] Error:', error);
        res.status(500).json({ error: 'Failed to execute node' });
    }
});

/**
 * Get execution order (upstream nodes first, then target)
 */
function getExecutionOrder(nodes, edges, targetNodeId) {
    const result = [];
    const visited = new Set();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    function visit(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        // Find upstream nodes
        const upstreamEdges = edges.filter(e => e.target === nodeId);
        for (const edge of upstreamEdges) {
            visit(edge.source);
        }

        const node = nodeMap.get(nodeId);
        if (node) {
            result.push(node);
        }
    }

    visit(targetNodeId);
    return result;
}

/**
 * GET /api/workflows/:workflowId/trigger-schema
 * Get the schema/test data template for all trigger types in workflow
 */
router.get('/:workflowId/trigger-schema', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { triggerType } = req.query;

        // Sample test data for each trigger type - matches actual trigger node output
        const triggerSchemas = {
            manual_trigger: {
                trigger_type: 'manual_trigger',
                triggered_at: new Date().toISOString(),
                triggered_by: 'user@example.com',
                payload: { custom_field: 'any value you pass' }
            },
            whatsapp_message: {
                trigger_type: 'whatsapp_message',
                sender_phone: '+91 98765 43210',
                sender_name: 'John Doe',
                message_body: 'Hi, I need help with my order',
                message_id: 'msg_abc123',
                contact_id: 'contact_uuid',
                conversation_id: 'conv_uuid',
                timestamp: new Date().toISOString()
            },
            email_received: {
                trigger_type: 'email_received',
                sender_email: 'customer@example.com',
                sender_name: 'Jane Smith',
                email_subject: 'Question about my subscription',
                email_body: 'Hello, I would like to upgrade my plan...',
                message_id: 'msg_xyz789',
                contact_id: 'contact_uuid',
                conversation_id: 'conv_uuid',
                timestamp: new Date().toISOString()
            },
            ticket_created: {
                trigger_type: 'ticket_created',
                ticket_id: 'ticket_uuid',
                ticket_number: 'TKT-001',
                ticket_title: 'Need assistance',
                ticket_description: 'Customer reported an issue',
                ticket_priority: 'high',
                ticket_status: 'open',
                contact_id: 'contact_uuid',
                timestamp: new Date().toISOString()
            },
            lead_added: {
                trigger_type: 'lead_added',
                lead_id: 'lead_uuid',
                lead_name: 'New Prospect',
                lead_email: 'prospect@company.com',
                lead_phone: '+1 555-0123',
                lead_source: 'website',
                pipeline_id: 'pipeline_uuid',
                stage_id: 'stage_uuid',
                timestamp: new Date().toISOString()
            },
            missed_call: {
                trigger_type: 'missed_call',
                caller_phone: '+1 555-0199',
                caller_name: 'Caller Name',
                call_id: 'call_uuid',
                contact_id: 'contact_uuid',
                timestamp: new Date().toISOString()
            }
        };

        // If specific trigger type requested, return just that
        if (triggerType) {
            const schema = triggerSchemas[triggerType] || triggerSchemas.manual_trigger;
            return res.json({
                triggerType: triggerType || 'manual_trigger',
                schema,
                description: `Test data for ${triggerType || 'manual'} trigger`
            });
        }

        // Otherwise, get all triggers from the workflow and return their schemas
        const versionResult = await pool.query(`
            SELECT nodes FROM workflow_versions 
            WHERE workflow_id = $1 
            ORDER BY version_number DESC LIMIT 1
        `, [workflowId]);

        if (versionResult.rows.length > 0) {
            const nodes = versionResult.rows[0].nodes || [];
            const triggerNodes = nodes.filter(n => 
                n.type?.includes('trigger') || n.type?.includes('message') || n.type?.includes('received')
            );

            // Build per-node schemas
            const perNodeSchemas = {};
            for (const node of triggerNodes) {
                const nodeType = node.type || 'manual_trigger';
                perNodeSchemas[node.id] = triggerSchemas[nodeType] || triggerSchemas.manual_trigger;
            }

            return res.json({
                triggerType: 'multiple',
                schema: perNodeSchemas,
                allSchemas: triggerSchemas, // Send all schemas for reference
                description: 'Test data for all triggers in workflow'
            });
        }

        // Fallback
        res.json({
            triggerType: triggerType || 'manual_trigger',
            schema: triggerSchemas[triggerType] || triggerSchemas.manual_trigger,
            description: `Test data for ${triggerType || 'manual'} trigger`
        });

    } catch (error) {
        logger.error('[TriggerSchema] Error:', error);
        res.status(500).json({ error: 'Failed to get trigger schema' });
    }
});

module.exports = router;
