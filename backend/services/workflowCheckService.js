/**
 * Workflow Check Service
 * Checks if tenant has active workflows with specific trigger types
 */

const { pool } = require('../config/db');

// Cache for workflow trigger existence (TTL 30 seconds)
const triggerCache = new Map();
const CACHE_TTL = 30000;

/**
 * Check if tenant has an active workflow with the specified trigger type
 * @param {string} tenantId - Tenant ID
 * @param {string} triggerType - Trigger type (e.g., 'whatsapp_message', 'email_received')
 * @returns {Promise<boolean>}
 */
async function hasTriggerWorkflow(tenantId, triggerType) {
  const cacheKey = `${tenantId}:${triggerType}`;
  const cached = triggerCache.get(cacheKey);
  
  // Skip cache for now to debug
  // if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  //   return cached.exists;
  // }

  try {
    console.log(`[WorkflowCheck] Checking for trigger: ${triggerType}, tenant: ${tenantId}`);
    
    // Check both single trigger_type column (legacy) and trigger_types array (new)
    const result = await pool.query(`
      SELECT w.id, w.name, w.trigger_type, w.trigger_types, w.status
      FROM workflows w
      WHERE w.tenant_id = $1 
        AND w.status = 'active'
        AND (
          w.trigger_type = $2 
          OR $2 = ANY(w.trigger_types)
        )
      LIMIT 1
    `, [tenantId, triggerType]);

    const exists = result.rows.length > 0;
    
    console.log(`[WorkflowCheck] Found ${result.rows.length} workflows matching ${triggerType}:`, 
      result.rows.map(r => ({ id: r.id, name: r.name, trigger_type: r.trigger_type, trigger_types: r.trigger_types }))
    );
    
    // Cache the result
    triggerCache.set(cacheKey, { exists, timestamp: Date.now() });
    
    return exists;
  } catch (error) {
    console.error('[WorkflowCheck] Error checking trigger workflow:', error);
    return false; // Default to AI processing if check fails
  }
}

/**
 * Get the trigger type for a channel event
 * @param {string} channel - Channel (whatsapp, email, phone)
 * @param {string} eventType - Event type (message, missed_call, etc.)
 * @returns {string} - Trigger type for workflow matching
 */
function getTriggerType(channel, eventType = 'message') {
  const triggerMap = {
    'whatsapp:message': 'whatsapp_message',
    'email:message': 'email_received',
    'phone:missed_call': 'missed_call',
  };
  
  return triggerMap[`${channel}:${eventType}`] || `${channel}_message`;
}

/**
 * Clear cache for a tenant (call when workflows are updated)
 */
function clearTriggerCache(tenantId) {
  for (const key of triggerCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      triggerCache.delete(key);
    }
  }
}

module.exports = {
  hasTriggerWorkflow,
  getTriggerType,
  clearTriggerCache
};
