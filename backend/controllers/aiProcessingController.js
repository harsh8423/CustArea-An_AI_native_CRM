/**
 * AI Processing Controller
 * Handles AI-related processing requests (for Lambda integration)
 */

const { queueIncomingMessage } = require('../config/redis');
const { shouldAgentRespond } = require('./agentDeploymentController');
const { pool } = require('../config/db');

/**
 * Queue a message for AI processing
 * POST /api/ai/queue/:messageId
 * 
 * Used by external services (like Lambda) to queue messages for AI processing
 */
async function queueMessageForAI(req, res) {
    try {
        const { messageId } = req.params;
        const { tenantId, conversationId, channel } = req.body;

        if (!messageId || !tenantId || !conversationId || !channel) {
            return res.status(400).json({ 
                error: 'Missing required fields: messageId, tenantId, conversationId, channel' 
            });
        }

        // Check if AI should respond for this channel
        const aiEnabled = await shouldAgentRespond(tenantId, channel);

        if (!aiEnabled) {
            console.log(`[AI Queue] AI not enabled for ${channel} (tenant: ${tenantId})`);
            return res.json({ 
                queued: false, 
                reason: 'AI not enabled or outside schedule' 
            });
        }

        // Verify the message exists
        const msgResult = await pool.query(
            `SELECT id FROM messages WHERE id = $1 AND tenant_id = $2`,
            [messageId, tenantId]
        );

        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Queue the message for AI processing
        await queueIncomingMessage(messageId, tenantId, conversationId, channel);
        
        console.log(`[AI Queue] Queued message ${messageId} for AI processing (${channel})`);

        res.json({ 
            queued: true, 
            messageId,
            channel 
        });

    } catch (error) {
        console.error('[AI Queue] Error queueing message:', error);
        res.status(500).json({ error: 'Failed to queue message for AI' });
    }
}

/**
 * Check if AI should respond for a channel
 * GET /api/ai/status/:channel
 */
async function getAIStatus(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { channel } = req.params;

        const shouldRespond = await shouldAgentRespond(tenantId, channel);

        res.json({
            channel,
            aiEnabled: shouldRespond
        });

    } catch (error) {
        console.error('[AI Status] Error checking status:', error);
        res.status(500).json({ error: 'Failed to check AI status' });
    }
}

module.exports = {
    queueMessageForAI,
    getAIStatus
};
