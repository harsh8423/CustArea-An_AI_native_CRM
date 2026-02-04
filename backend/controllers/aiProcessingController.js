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

        // Verify the message exists and get content
        const msgResult = await pool.query(
            `SELECT m.*, c.channel_contact_id 
             FROM messages m 
             JOIN conversations c ON c.id = m.conversation_id
             WHERE m.id = $1 AND m.tenant_id = $2`,
            [messageId, tenantId]
        );

        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const message = msgResult.rows[0];

        // Check for workflow trigger FIRST
        const { hasTriggerWorkflow, getTriggerType } = require('../services/workflowCheckService');
        const triggerType = getTriggerType(channel, 'message');
        const hasWorkflow = await hasTriggerWorkflow(tenantId, triggerType);

        if (hasWorkflow) {
            // Build trigger data for workflow
            const triggerData = {
                trigger_type: triggerType,
                sender: channel === 'email' ? {
                    email: message.channel_contact_id,
                } : channel === 'whatsapp' ? {
                    phone: message.channel_contact_id,
                    wa_number: (message.channel_contact_id || '').replace('whatsapp:', '')
                } : {
                    id: message.channel_contact_id
                },
                message: {
                    id: message.id,
                    body: message.content_text,
                    subject: message.metadata?.subject || null
                },
                conversation_id: conversationId,
                timestamp: new Date().toISOString()
            };

            await queueIncomingMessage(messageId, tenantId, conversationId, channel, true, triggerData);
            console.log(`[AI Queue] Queued message ${messageId} for WORKFLOW processing (${channel})`);

            return res.json({ 
                queued: true, 
                messageId,
                channel,
                destination: 'workflow'
            });
        }

        // Otherwise check if AI should respond for this channel
        // Check if this is a campaign conversation
        const campaignCheck = await pool.query(
            `SELECT c.campaign_id, oc.reply_handling 
             FROM conversations c
             JOIN outreach_campaigns oc ON c.campaign_id = oc.id
             WHERE c.id = $1 AND c.is_campaign = true`,
            [conversationId]
        );

        let agentType = 'default';
        let campaignId = null;

        if (campaignCheck.rows.length > 0) {
            const campaignInfo = campaignCheck.rows[0];
            if (campaignInfo.reply_handling === 'ai') {
                agentType = 'campaign';
                campaignId = campaignInfo.campaign_id;
                console.log(`[AI Queue] Detected campaign conversation ${conversationId} (Campaign: ${campaignId})`);
            }
        }

        // Otherwise check if AI should respond for this channel (only if not campaign or if campaign uses AI)
        // If it's a campaign with reply_handling='manual', we shouldn't act (unless configured otherwise)
        let aiEnabled = false;
        if (agentType === 'campaign') {
            aiEnabled = true; // Always enable for campaign if configured
        } else {
             aiEnabled = await shouldAgentRespond(tenantId, channel);
        }

        if (!aiEnabled) {
            console.log(`[AI Queue] No workflow or AI enabled for ${channel} (tenant: ${tenantId})`);
            return res.json({ 
                queued: false, 
                reason: 'No workflow trigger and AI not enabled' 
            });
        }

        // Queue the message for AI processing
        await queueIncomingMessage(messageId, tenantId, conversationId, channel, false, null, agentType, campaignId);
        
        console.log(`[AI Queue] Queued message ${messageId} for AI processing (${channel})`);

        res.json({ 
            queued: true, 
            messageId,
            channel,
            destination: 'ai'
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
