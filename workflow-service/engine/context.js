/**
 * Context Manager - Handles variable resolution for {{...}} expressions
 */

/**
 * Resolve a template string with variable substitution
 * @param {string} template - String containing {{node_id.path.to.value}} expressions
 * @param {object} context - Accumulated context from previous nodes
 * @returns {string|any} - Resolved value
 */
function resolveTemplate(template, context) {
    if (typeof template !== 'string') {
        return template;
    }

    // Check if entire template is a single variable (return actual type)
    const singleVarMatch = template.match(/^\{\{([^}]+)\}\}$/);
    if (singleVarMatch) {
        return resolvePath(singleVarMatch[1].trim(), context);
    }

    // Replace all {{...}} expressions in the string
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = resolvePath(path.trim(), context);
        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    });
}

/**
 * Resolve a dot-notation path against the context
 * @param {string} path - e.g., "trigger_1.contact.name"
 * @param {object} context - Accumulated context
 * @returns {any} - Resolved value or undefined
 */
function resolvePath(path, context) {
    const parts = path.split('.');
    let current = context;

    for (const part of parts) {
        if (current === undefined || current === null) {
            return undefined;
        }
        
        // Handle array access like items[0]
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
            current = current[arrayMatch[1]];
            if (Array.isArray(current)) {
                current = current[parseInt(arrayMatch[2], 10)];
            } else {
                return undefined;
            }
        } else {
            current = current[part];
        }
    }

    return current;
}

/**
 * Resolve all {{...}} expressions in a config object (deep)
 * @param {object} config - Node configuration
 * @param {object} context - Accumulated context
 * @returns {object} - Resolved configuration
 */
function resolveConfig(config, context) {
    if (config === null || config === undefined) {
        return config;
    }

    if (typeof config === 'string') {
        return resolveTemplate(config, context);
    }

    if (Array.isArray(config)) {
        return config.map(item => resolveConfig(item, context));
    }

    if (typeof config === 'object') {
        const resolved = {};
        for (const [key, value] of Object.entries(config)) {
            resolved[key] = resolveConfig(value, context);
        }
        return resolved;
    }

    return config;
}

/**
 * Evaluate a JavaScript expression against the context
 * Used for if-else conditions
 * @param {string} expression - JavaScript expression
 * @param {object} context - Accumulated context
 * @returns {any} - Result of evaluation
 */
function evaluateExpression(expression, context) {
    // Create a flattened context that includes:
    // 1. All node outputs by their node ID
    // 2. All set_variable outputs as direct variables
    // 3. Common helpers
    const flatContext = { ...context };
    
    // Flatten set_variable and other variable-setting nodes
    for (const [nodeId, output] of Object.entries(context)) {
        if (output && typeof output === 'object') {
            // If the node set a variable by name (like set_variable does),
            // make it available directly
            for (const [key, value] of Object.entries(output)) {
                // Skip special keys and internal properties
                if (key !== 'value' && !key.startsWith('_')) {
                    flatContext[key] = value;
                }
            }
            // Also set the 'value' field if it exists (for set_variable output)
            if (output.value !== undefined && Object.keys(output).length === 2) {
                // Single variable output like {name: value, value: value}
                const variableName = Object.keys(output).find(k => k !== 'value');
                if (variableName) {
                    flatContext[variableName] = output.value;
                }
            }
        }
    }
    
    // Build the function with flattened context variables
    const argNames = Object.keys(flatContext);
    const argValues = Object.values(flatContext);
    
    try {
        // First resolve {{...}} expressions
        let processedExpression = expression.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const resolved = resolvePath(path.trim(), context);
            if (resolved === undefined) {
                // Try direct lookup in flattened context
                return path.trim().replace(/\./g, '?.');
            }
            if (typeof resolved === 'string') {
                return `"${resolved.replace(/"/g, '\\"')}"`;
            }
            if (typeof resolved === 'object') {
                return JSON.stringify(resolved);
            }
            return String(resolved);
        });
        
        // Create and call the function
        const fn = new Function(...argNames, `return (${processedExpression})`);
        return fn(...argValues);
    } catch (error) {
        throw new Error(`Expression evaluation failed: ${error.message}`);
    }
}

/**
 * Add node output to context
 * @param {object} context - Current context
 * @param {string} nodeId - Node ID
 * @param {object} output - Node output data
 * @returns {object} - Updated context
 */
function addToContext(context, nodeId, output) {
    return {
        ...context,
        [nodeId]: output
    };
}

/**
 * Get available variables for a node (for UI autocomplete)
 * @param {array} nodes - All nodes in the workflow
 * @param {array} edges - All edges in the workflow
 * @param {string} targetNodeId - The node we're getting variables for
 * @returns {array} - Available variable paths
 */
function getAvailableVariables(nodes, edges, targetNodeId) {
    const availableNodes = [];
    const visited = new Set();
    
    // Find all nodes that are upstream of the target
    function findUpstream(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        
        const incomingEdges = edges.filter(e => e.target === nodeId);
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode) {
                availableNodes.push(sourceNode);
                findUpstream(sourceNode.id);
            }
        }
    }
    
    findUpstream(targetNodeId);
    
    // Build variable paths from upstream nodes
    // This would integrate with node output schemas
    return availableNodes.map(node => ({
        nodeId: node.id,
        nodeType: node.type,
        label: node.data?.label || node.id
    }));
}

module.exports = {
    resolveTemplate,
    resolvePath,
    resolveConfig,
    evaluateExpression,
    addToContext,
    getAvailableVariables
};
