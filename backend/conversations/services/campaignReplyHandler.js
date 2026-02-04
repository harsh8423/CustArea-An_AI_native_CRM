const { pool } = require('../../config/db');

/**
 * Campaign Reply Handler
 * Handles incoming replies to campaign emails
 */

/**
 * Handle campaign reply
 * - Updates campaign_contacts status to 'replied'
 * - Routes to campaign AI if reply_handling='ai'
 * - Updates conversations.has_reply = true
 */
async function handleCampaignReply(conversationId, tenantId, messageData) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get conversation with campaign details
        const convResult = await client.query(
            `SELECT c.*, oc.reply_handling, cc.id as campaign_contact_id
             FROM conversations c
             JOIN outreach_campaigns oc ON c.campaign_id = oc.id
             LEFT JOIN campaign_contacts cc ON cc.campaign_id = c.campaign_id AND cc.contact_id = c.contact_id
             WHERE c.id = $1 AND c.tenant_id = $2`,
            [conversationId, tenantId]
        );

        if (convResult.rows.length === 0) {
            console.log(`Conversation ${conversationId} not found or not a campaign`);
            return { handled: false };
        }

        const conversation = convResult.rows[0];

        // Update conversations.has_reply = true
        await client.query(
            `UPDATE conversations 
             SET has_reply = true, updated_at = now()
             WHERE id = $1`,
            [conversationId]
        );

        // Update campaign_contacts if exists
        if (conversation.campaign_contact_id) {
            await client.query(
                `UPDATE campaign_contacts 
                 SET status = 'replied', 
                     replied_at = now(),
                     next_send_at = NULL,
                     updated_at = now()
                 WHERE id = $1`,
                [conversation.campaign_contact_id]
            );

            console.log(`Campaign contact ${conversation.campaign_contact_id} marked as replied`);
        }

        await client.query('COMMIT');

        // Route to campaign AI if needed
        if (conversation.reply_handling === 'ai') {
            console.log(`Routing reply to campaign AI for conversation ${conversationId}`);
            
            // Queue for AI processing
            const campaignAIService = require('../../campaign/services/campaignAIService');
            try {
                await campaignAIService.processCampaignReply(
                    messageData.id,
                    tenantId,
                    conversationId,
                    conversation.campaign_id
                );
            } catch (aiError) {
                console.error('Campaign AI processing error:', aiError);
                // Don't fail the whole flow if AI fails
            }
        } else {
            console.log(`Campaign reply for conversation ${conversationId} - human handling`);
        }

        return { 
            handled: true, 
            replyHandling: conversation.reply_handling 
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Campaign reply handler error:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Check if a conversation is a campaign conversation
 */
async function isCampaignConversation(conversationId, tenantId) {
    const result = await pool.query(
        `SELECT is_campaign, campaign_id 
         FROM conversations 
         WHERE id = $1 AND tenant_id = $2`,
        [conversationId, tenantId]
    );

    if (result.rows.length === 0) {
        return { isCampaign: false };
    }

    const row = result.rows[0];
    return {
        isCampaign: row.is_campaign === true,
        campaignId: row.campaign_id
    };
}

module.exports = {
    handleCampaignReply,
    isCampaignConversation
};
