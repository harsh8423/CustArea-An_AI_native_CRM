/**
 * Campaign Follow-up Worker
 * Automatically sends follow-up emails based on configured sequences
 */

const { pool } = require('../../config/db');
const { sendCampaignEmail } = require('./campaignWorker');

/**
 * Process follow-ups for all active campaigns
 */
async function processFollowUps() {
    const client = await pool.connect();

    try {
        // Get all active campaigns
        const campaignsResult = await client.query(
            `SELECT id, tenant_id 
             FROM outreach_campaigns 
             WHERE status = 'active'`
        );

        for (const campaign of campaignsResult.rows) {
            try {
                await processCampaignFollowUps(campaign.id, campaign.tenant_id);
            } catch (error) {
                console.error(`Error processing follow-ups for campaign ${campaign.id}:`, error);
            }
        }

    } finally {
        client.release();
    }
}

/**
 * Process follow-ups for a single campaign
 */
async function processCampaignFollowUps(campaignId, tenantId) {
    const client = await pool.connect();

    try {
        // Get all follow-up templates for this campaign (ordered by created_at)
        const followUpsResult = await client.query(
            `SELECT * FROM campaign_email_templates 
             WHERE campaign_id = $1 AND template_type = 'follow_up'
             ORDER BY created_at`,
            [campaignId]
        );

        if (followUpsResult.rows.length === 0) {
            return; // No follow-ups configured
        }

        // Get contacts that are due for follow-up
        const contactsResult = await client.query(
            `SELECT cc.*, c.email, c.name, c.company_name as company
             FROM campaign_contacts cc
             JOIN contacts c ON cc.contact_id = c.id
             WHERE cc.campaign_id = $1 
             AND cc.status = 'sent'
             AND cc.next_send_at IS NOT NULL
             AND cc.next_send_at <= now()`,
            [campaignId]
        );

        for (const contact of contactsResult.rows) {
            try {
                await sendFollowUpEmail(campaignId, tenantId, contact, followUpsResult.rows, client);
            } catch (error) {
                console.error(`Error sending follow-up to contact ${contact.contact_id}:`, error);
            }
        }

    } finally {
        client.release();
    }
}

/**
 * Send follow-up email to a contact
 */
async function sendFollowUpEmail(campaignId, tenantId, contact, allFollowUpTemplates, client) {
    // FIRST: Check if contact has replied at ANY point
    // If they have, cancel all remaining follow-ups
    const replyCheck = await client.query(
        `SELECT has_reply FROM conversations 
         WHERE id = $1`,
        [contact.conversation_id]
    );

    if (replyCheck.rows.length > 0 && replyCheck.rows[0].has_reply) {
        // Contact replied - cancel all remaining follow-ups
        await client.query(
            `UPDATE campaign_contacts 
             SET status = 'replied', 
                 next_send_at = NULL, 
                 updated_at = now()
             WHERE id = $1`,
            [contact.id]
        );
        console.log(`Contact ${contact.contact_id} has replied - cancelling all remaining follow-ups`);
        return;
    }

    // Determine which follow-up to send
    // current_follow_up_step = 1 means initial sent, so next is first follow-up (index 0)
    const nextFollowUpIndex = contact.current_follow_up_step - 1;
    
    if (nextFollowUpIndex >= allFollowUpTemplates.length) {
        // All follow-ups sent, mark as completed
        await client.query(
            `UPDATE campaign_contacts 
             SET status = 'completed', next_send_at = NULL, completed_at = now()
             WHERE id = $1`,
            [contact.id]
        );
        console.log(`[FollowUp] Contact ${contact.email} completed all ${allFollowUpTemplates.length} follow-ups`);
        return;
    }

    const template = allFollowUpTemplates[nextFollowUpIndex];

    // Get campaign details
    const campaignResult = await client.query(
        'SELECT * FROM outreach_campaigns WHERE id = $1',
        [campaignId]
    );
    const campaign = campaignResult.rows[0];

    // CRITICAL: Use the same sender email that sent the initial email
    // This ensures deliverability and consistency for the contact
    const senderEmail = contact.sender_email_address;
    
    if (!senderEmail) {
        console.error(`[FollowUp] No sender_email_address found for contact ${contact.id}. Skipping follow-up.`);
        return;
    }

    console.log(`[FollowUp] Using consistent sender email: ${senderEmail} for contact ${contact.email}`);

    // Send the follow-up email (reuses existing conversation)
    // Pass the forced email address to ensure consistency
    const { conversationId } = await sendCampaignEmail(
        campaignId, 
        tenantId, 
        contact, 
        template, 
        campaign, 
        client, 
        senderEmail  // Force use of the same sender email
    );

    // Calculate next send time if there are more follow-ups
    let nextSendAt = null;
    const nextFollowUpIdx = nextFollowUpIndex + 1;
    
    console.log(`[FollowUp] Contact ${contact.id}: Current step=${contact.current_follow_up_step}, Next Index=${nextFollowUpIdx}, Total FollowUps=${allFollowUpTemplates.length}`);

    if (nextFollowUpIdx < allFollowUpTemplates.length) {
        const nextTemplate = allFollowUpTemplates[nextFollowUpIdx];
        nextSendAt = calculateNextSendTime(
            nextTemplate.wait_period_value || 3, 
            nextTemplate.wait_period_unit || 'days'
        );
        console.log(`[FollowUp] Scheduling next follow-up for ${nextSendAt}`);
    } else {
        console.log(`[FollowUp] No more follow-ups configured. Chain complete.`);
    }

    // Update contact
    await client.query(
        `UPDATE campaign_contacts 
         SET current_follow_up_step = current_follow_up_step + 1,
             emails_sent = emails_sent + 1,
             next_send_at = $2,
             last_sent_at = now(),
             status = 'sent',
             conversation_id = $3,
             updated_at = now()
         WHERE id = $1`,
        [contact.id, nextSendAt, conversationId]
    );

    console.log(`Follow-up sent to ${contact.email} (step ${contact.current_follow_up_step + 1}). Next: ${nextSendAt}`);
}

/**
 * Calculate next send time based on wait period
 */
function calculateNextSendTime(value, unit) {
    const now = new Date();
    
    switch (unit) {
        case 'minutes':
            now.setMinutes(now.getMinutes() + value);
            break;
        case 'hours':
            now.setHours(now.getHours() + value);
            break;
        case 'days':
            now.setDate(now.getDate() + value);
            break;
        default:
            throw new Error(`Invalid wait period unit: ${unit}`);
    }

    return now;
}

/**
 * Schedule follow-up for a contact after initial email is sent
 */
async function scheduleFirstFollowUp(campaignId, contactId) {
    const client = await pool.connect();

    try {
        // Get first follow-up config
        const followUpResult = await client.query(
            `SELECT * FROM campaign_follow_ups 
             WHERE campaign_id = $1 AND is_active = true
             ORDER BY sequence_order
             LIMIT 1`,
            [campaignId]
        );

        if (followUpResult.rows.length === 0) {
            return; // No follow-ups configured
        }

        const firstFollowUp = followUpResult.rows[0];
        const nextSendAt = calculateNextSendTime(
            firstFollowUp.wait_period_value,
            firstFollowUp.wait_period_unit
        );

        // Update contact with next send time
        await client.query(
            `UPDATE campaign_contacts 
             SET next_send_at = $2
             WHERE id = $1`,
            [contactId, nextSendAt]
        );

    } finally {
        client.release();
    }
}

/**
 * Start follow-up worker (runs every minute)
 */
function startFollowUpWorker() {
    console.log('✓ Campaign follow-up worker started');
    
    // Process immediately on start
    processFollowUps().catch(err => {
        console.error('Follow-up worker error:', err);
    });

    // Then run every minute
    setInterval(() => {
        processFollowUps().catch(err => {
            console.error('Follow-up worker error:', err);
        });
    }, 60 * 1000); // 1 minute
}

module.exports = {
    processFollowUps,
    processCampaignFollowUps,
    scheduleFirstFollowUp,
    startFollowUpWorker
};
