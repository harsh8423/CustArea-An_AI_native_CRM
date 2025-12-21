/**
 * Graph Traversal - Navigate the React Flow graph
 */

/**
 * Find the trigger node (entry point)
 * @param {array} nodes - React Flow nodes
 * @param {string} eventType - Optional: the event type to match (e.g., 'email_received', 'whatsapp_message')
 * @returns {object|null} - Trigger node or null
 */
function findTriggerNode(nodes, eventType = null) {
    // If event type specified, find the matching trigger node
    if (eventType) {
        const matchingTrigger = nodes.find(node => node.type === eventType);
        if (matchingTrigger) {
            return matchingTrigger;
        }
    }
    
    // Fallback: find any trigger node (for manual runs or no match)
    return nodes.find(node => {
        const type = node.type || '';
        return type.includes('trigger') || 
               type.includes('message') || 
               type.includes('received') ||
               type.includes('created') ||
               type.includes('added') ||
               type.includes('call');
    }) || nodes[0]; // Default to first node
}

/**
 * Find the next node(s) to execute based on edges
 * @param {string} currentNodeId - Current node ID
 * @param {array} edges - React Flow edges
 * @param {string} sourceHandle - Optional: specific output handle (for branching)
 * @returns {array} - Array of next node IDs
 */
function findNextNodes(currentNodeId, edges, sourceHandle = null) {
    const outgoingEdges = edges.filter(edge => {
        if (edge.source !== currentNodeId) return false;
        if (sourceHandle && edge.sourceHandle !== sourceHandle) return false;
        return true;
    });

    return outgoingEdges.map(edge => edge.target);
}

/**
 * Find a node by ID
 * @param {string} nodeId - Node ID
 * @param {array} nodes - React Flow nodes
 * @returns {object|null} - Node or null
 */
function findNodeById(nodeId, nodes) {
    return nodes.find(node => node.id === nodeId) || null;
}

/**
 * Get all nodes in execution order (topological sort)
 * @param {array} nodes - React Flow nodes
 * @param {array} edges - React Flow edges
 * @returns {array} - Nodes in execution order
 */
function getExecutionOrder(nodes, edges) {
    const visited = new Set();
    const result = [];
    const inDegree = new Map();

    // Calculate in-degree for each node
    nodes.forEach(node => inDegree.set(node.id, 0));
    edges.forEach(edge => {
        const current = inDegree.get(edge.target) || 0;
        inDegree.set(edge.target, current + 1);
    });

    // Find nodes with no incoming edges (start nodes)
    const queue = nodes.filter(node => inDegree.get(node.id) === 0);

    while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node.id)) continue;

        visited.add(node.id);
        result.push(node);

        // Find outgoing edges and reduce in-degree of targets
        const outgoing = edges.filter(e => e.source === node.id);
        for (const edge of outgoing) {
            const targetDegree = inDegree.get(edge.target) - 1;
            inDegree.set(edge.target, targetDegree);
            
            if (targetDegree === 0) {
                const targetNode = findNodeById(edge.target, nodes);
                if (targetNode) queue.push(targetNode);
            }
        }
    }

    return result;
}

/**
 * Check if a node is a branching node (has multiple outputs)
 * @param {object} node - React Flow node
 * @returns {boolean}
 */
function isBranchingNode(node) {
    const branchTypes = ['if_else', 'switch', 'loop'];
    return branchTypes.includes(node.type);
}

/**
 * Check if a node is a terminal node (no outgoing edges)
 * @param {string} nodeId - Node ID
 * @param {array} edges - React Flow edges
 * @returns {boolean}
 */
function isTerminalNode(nodeId, edges) {
    return !edges.some(edge => edge.source === nodeId);
}

/**
 * Get the handle IDs for a branching node
 * @param {object} node - Branching node
 * @returns {array} - Handle IDs like ['true', 'false'] or ['case_1', 'case_2', 'default']
 */
function getBranchHandles(node) {
    switch (node.type) {
        case 'if_else':
            return ['true', 'false'];
        case 'switch':
            const cases = node.data?.config?.cases || [];
            return [...cases.map((c, i) => `case_${i}`), 'default'];
        case 'loop':
            return ['item', 'done'];
        default:
            return ['output'];
    }
}

/**
 * Validate graph structure
 * @param {array} nodes - React Flow nodes
 * @param {array} edges - React Flow edges
 * @returns {object} - { valid: boolean, errors: array }
 */
function validateGraph(nodes, edges) {
    const errors = [];

    // Check for trigger node
    const triggerNode = findTriggerNode(nodes);
    if (!triggerNode) {
        errors.push('Workflow must have a trigger node');
    }

    // Check for orphan nodes (no incoming or outgoing edges)
    const nodeIds = new Set(nodes.map(n => n.id));
    const connectedNodes = new Set();
    
    edges.forEach(edge => {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
    });

    // Trigger node is allowed to have no incoming edges
    const orphans = nodes.filter(n => 
        !connectedNodes.has(n.id) && n.id !== triggerNode?.id
    );
    
    if (orphans.length > 0) {
        errors.push(`Orphan nodes detected: ${orphans.map(n => n.id).join(', ')}`);
    }

    // Check for invalid edge references
    edges.forEach(edge => {
        if (!nodeIds.has(edge.source)) {
            errors.push(`Edge references non-existent source: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(`Edge references non-existent target: ${edge.target}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    findTriggerNode,
    findNextNodes,
    findNodeById,
    getExecutionOrder,
    isBranchingNode,
    isTerminalNode,
    getBranchHandles,
    validateGraph
};
