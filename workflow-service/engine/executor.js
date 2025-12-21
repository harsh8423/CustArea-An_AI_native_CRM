/**
 * Core Workflow Executor
 * Executes a single workflow run, node by node
 */

const { pool } = require('../config/db');
const { resolveConfig, addToContext, evaluateExpression } = require('./context');
const { findTriggerNode, findNextNodes, findNodeById, isBranchingNode, isTerminalNode } = require('./graphTraversal');
const nodeRegistry = require('../nodes/registry');
const logger = require('../utils/logger');

class Executor {
    constructor(run, version, tenant) {
        this.run = run;
        this.version = version;
        this.tenant = tenant;
        this.nodes = version.nodes || [];
        this.edges = version.edges || [];
        this.context = run.context || {};
        this.executedCount = run.executed_node_count || 0;
        this.currentNodeId = run.current_node_id;
        this.startTime = Date.now();
        this.maxExecutionTime = parseInt(process.env.MAX_EXECUTION_TIME_MS) || 300000;
    }

    /**
     * Execute the workflow from the beginning or resume point
     */
    async execute() {
        logger.info(`[Executor] Starting execution for run ${this.run.id}`);

        try {
            // Update run status to running
            await this.updateRunStatus('running');

            // Find starting node
            let currentNode;
            if (this.currentNodeId) {
                // Resume from saved position
                currentNode = findNodeById(this.currentNodeId, this.nodes);
                logger.info(`[Executor] Resuming from node ${this.currentNodeId}`);
            } else {
                // Start from trigger node - use event_type to find matching trigger
                const eventType = this.context?.event_type || null;
                currentNode = findTriggerNode(this.nodes, eventType);
                if (!currentNode) {
                    throw new Error('No trigger node found in workflow');
                }
                logger.info(`[Executor] Starting from trigger node ${currentNode.id}`);
            }

            // Execute nodes in sequence
            while (currentNode) {
                // Check execution timeout
                if (Date.now() - this.startTime > this.maxExecutionTime) {
                    throw new Error('Workflow execution timeout');
                }

                // Execute the current node
                const result = await this.executeNode(currentNode);

                // Handle special results
                if (result.action === 'wait') {
                    // Delay node - schedule resume and exit
                    await this.scheduleResume(result.resumeAt, result.nextNodeId);
                    await this.updateRunStatus('waiting', result.nextNodeId);
                    logger.info(`[Executor] Workflow paused until ${result.resumeAt}`);
                    return { status: 'waiting', resumeAt: result.resumeAt };
                }

                if (result.action === 'stop') {
                    // Stop node - end execution
                    await this.updateRunStatus('completed');
                    logger.info(`[Executor] Workflow stopped by node`);
                    return { status: 'completed', stoppedByNode: true };
                }

                // Find next node(s)
                const nextNodeIds = result.nextNodes || this.findNextNodeIds(currentNode, result);

                if (nextNodeIds.length === 0) {
                    // No more nodes - workflow complete
                    currentNode = null;
                } else if (nextNodeIds.length === 1) {
                    // Single next node
                    currentNode = findNodeById(nextNodeIds[0], this.nodes);
                } else {
                    // Multiple branches - for now, take first (could implement parallel execution)
                    // TODO: Implement parallel branch execution
                    currentNode = findNodeById(nextNodeIds[0], this.nodes);
                }
            }

            // Workflow completed successfully
            await this.updateRunStatus('completed');
            logger.info(`[Executor] Workflow completed successfully`);
            return { status: 'completed' };

        } catch (error) {
            logger.error(`[Executor] Workflow failed:`, error);
            await this.updateRunStatus('failed', null, error.message);
            return { status: 'failed', error: error.message };
        }
    }

    /**
     * Execute a single node
     */
    async executeNode(node) {
        const nodeStartTime = Date.now();
        logger.info(`[Executor] Executing node ${node.id} (${node.type})`);

        // Create node run record
        const nodeRunId = await this.createNodeRun(node);

        try {
            // Get node handler from registry
            const handler = nodeRegistry.getHandler(node.type);
            if (!handler) {
                throw new Error(`Unknown node type: ${node.type}`);
            }

            // Resolve input configuration with context
            const config = node.data?.config || {};
            
            // Debug log raw config for send_whatsapp nodes
            if (node.type === 'send_whatsapp') {
                logger.info(`[Executor] DEBUG send_whatsapp RAW node.data: ${JSON.stringify(node.data)}`);
                logger.info(`[Executor] DEBUG send_whatsapp RAW config: ${JSON.stringify(config)}`);
            }
            
            const resolvedConfig = resolveConfig(config, this.context);

            // Log resolved inputs
            await this.log(node.id, 'debug', 'Resolved inputs', { config: resolvedConfig });

            // Execute the node handler
            const output = await handler.execute({
                nodeId: node.id,
                config: resolvedConfig,
                context: this.context,
                run: this.run,
                tenant: this.tenant,
                pool,
                log: (level, message, data) => this.log(node.id, level, message, data)
            });

            // Add output to context
            this.context = addToContext(this.context, node.id, output);

            // Update node run as completed
            const executionMs = Date.now() - nodeStartTime;
            await this.updateNodeRun(nodeRunId, 'completed', resolvedConfig, output, executionMs);
            
            // Update run context in DB
            await this.saveContext();

            this.executedCount++;
            logger.info(`[Executor] Node ${node.id} completed in ${executionMs}ms`);

            return output;

        } catch (error) {
            const executionMs = Date.now() - nodeStartTime;
            await this.updateNodeRun(nodeRunId, 'failed', null, null, executionMs, error.message);
            await this.log(node.id, 'error', `Node execution failed: ${error.message}`, { error: error.stack });
            throw error;
        }
    }

    /**
     * Find next node IDs based on node type and output
     */
    findNextNodeIds(node, output) {
        if (isBranchingNode(node)) {
            // For branching nodes, use the branch handle from output
            const handle = output.branch || output.handle || 'output';
            return findNextNodes(node.id, this.edges, handle);
        }
        
        return findNextNodes(node.id, this.edges);
    }

    /**
     * Schedule a resume for delay nodes
     */
    async scheduleResume(resumeAt, nextNodeId) {
        await pool.query(`
            INSERT INTO workflow_scheduled_jobs (run_id, tenant_id, workflow_id, job_type, resume_node_id, resume_at)
            VALUES ($1, $2, $3, 'delay_resume', $4, $5)
        `, [this.run.id, this.tenant.id, this.run.workflow_id, nextNodeId, resumeAt]);
    }

    /**
     * Update run status
     */
    async updateRunStatus(status, currentNodeId = null, errorMessage = null) {
        const completedAt = ['completed', 'failed', 'cancelled'].includes(status) ? 'now()' : null;
        
        await pool.query(`
            UPDATE workflow_runs 
            SET status = $1, 
                current_node_id = COALESCE($2, current_node_id),
                error_message = $3,
                executed_node_count = $4,
                started_at = COALESCE(started_at, now()),
                completed_at = ${completedAt ? 'now()' : 'NULL'}
            WHERE id = $5
        `, [status, currentNodeId, errorMessage, this.executedCount, this.run.id]);
    }

    /**
     * Save current context to database
     */
    async saveContext() {
        await pool.query(`
            UPDATE workflow_runs SET context = $1, executed_node_count = $2 WHERE id = $3
        `, [JSON.stringify(this.context), this.executedCount, this.run.id]);
    }

    /**
     * Create a node run record
     */
    async createNodeRun(node) {
        const result = await pool.query(`
            INSERT INTO workflow_run_nodes (run_id, node_id, node_type, status, started_at)
            VALUES ($1, $2, $3, 'running', now())
            RETURNING id
        `, [this.run.id, node.id, node.type]);
        return result.rows[0].id;
    }

    /**
     * Update a node run record
     */
    async updateNodeRun(nodeRunId, status, inputData, outputData, executionMs, errorMessage = null) {
        await pool.query(`
            UPDATE workflow_run_nodes 
            SET status = $1, input_data = $2, output_data = $3, execution_ms = $4, error_message = $5, completed_at = now()
            WHERE id = $6
        `, [status, JSON.stringify(inputData), JSON.stringify(outputData), executionMs, errorMessage, nodeRunId]);
    }

    /**
     * Write a log entry
     */
    async log(nodeId, level, message, data = {}) {
        await pool.query(`
            INSERT INTO workflow_run_logs (run_id, tenant_id, node_id, level, message, data)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [this.run.id, this.tenant.id, nodeId, level, message, JSON.stringify(data)]);
    }
}

/**
 * Create and run an executor for a workflow run
 */
async function executeRun(runId) {
    // Load run with version and tenant
    const runResult = await pool.query(`
        SELECT r.*, v.nodes, v.edges, v.settings,
               t.id as tenant_id, t.name as tenant_name
        FROM workflow_runs r
        JOIN workflow_versions v ON r.version_id = v.id
        JOIN tenants t ON r.tenant_id = t.id
        WHERE r.id = $1
    `, [runId]);

    if (runResult.rows.length === 0) {
        throw new Error(`Run ${runId} not found`);
    }

    const row = runResult.rows[0];
    const run = {
        id: row.id,
        workflow_id: row.workflow_id,
        version_id: row.version_id,
        tenant_id: row.tenant_id,
        status: row.status,
        trigger_data: row.trigger_data,
        context: row.context || {},
        current_node_id: row.current_node_id,
        executed_node_count: row.executed_node_count
    };

    const version = {
        nodes: row.nodes || [],
        edges: row.edges || [],
        settings: row.settings || {}
    };

    const tenant = {
        id: row.tenant_id,
        name: row.tenant_name
    };

    // Create and execute
    const executor = new Executor(run, version, tenant);
    return executor.execute();
}

module.exports = { Executor, executeRun };
