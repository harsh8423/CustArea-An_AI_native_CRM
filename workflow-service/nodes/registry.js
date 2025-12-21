/**
 * Node Registry - Maps node types to handlers
 */

// Import node handlers
const triggerNodes = require('./triggers');
const logicNodes = require('./logic');
const aiNodes = require('./ai');
const outputNodes = require('./output');
const utilityNodes = require('./utility');

// Combine all handlers
const handlers = {
    ...triggerNodes,
    ...logicNodes,
    ...aiNodes,
    ...outputNodes,
    ...utilityNodes
};

/**
 * Get a node handler by type
 * @param {string} type - Node type (e.g., 'if_else', 'send_whatsapp')
 * @returns {object|null} - Handler object with execute method
 */
function getHandler(type) {
    return handlers[type] || null;
}

/**
 * Get all registered node types
 * @returns {array} - Array of node type strings
 */
function getNodeTypes() {
    return Object.keys(handlers);
}

/**
 * Check if a node type is registered
 * @param {string} type - Node type
 * @returns {boolean}
 */
function hasHandler(type) {
    return type in handlers;
}

module.exports = {
    getHandler,
    getNodeTypes,
    hasHandler
};
