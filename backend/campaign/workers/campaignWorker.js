/**
 * Campaign Worker
 * Processes campaign emails with rotation, personalization, and conversation creation
 */

const { pool } = require('../../config/db');
const emailRotationService = require('../services/emailRotationService');
const EmailProviderFactory = require('../../email/services/emailProviderFactory');
const { generateCampaignMessageId, addThreadingHeaders, storeEmailMetadata } = require('../../email/services/emailThreadingHelper');

/**
 * Process campaign contacts and send emails
 * Called periodically to send campaign emails respecting daily limits
 */
async function processCampaignEmails() {
    const client = await pool.connect();

    try {
        // Get all active campaigns
        const campaignsResult = await client.query(
            `SELECT id, tenant_id, daily_send_limit 
             FROM outreach_campaigns 
             WHERE status = 'active'`
        );

        for (const campaign of campaignsResult.rows) {
            try {
                await processCampaign(campaign.id, campaign.tenant_id, campaign.daily_send_limit);
            } catch (error) {
                console.error(`Error processing campaign ${campaign.id}:`, error);
                // Continue with other campaigns
            }
        }

    } finally {
        client.release();
    }
}

/**
 * Process a single campaign
 */
async function processCampaign(campaignId, tenantId, dailyLimit) {
    const client = await pool.connect();

    try {
        // Check daily limit
        const limitCheck = await emailRotationService.checkDailyLimit(campaignId);
        
        if (limitCheck.reachedLimit) {
            console.log(`Campaign ${campaignId} has reached daily limit (${limitCheck.limit})`);
            return;
        }

        const remainingToday = limitCheck.remaining;

        // Get pending contacts (initial emails not sent yet)
        const pendingContacts = await client.query(
            `SELECT cc.*, c.email, c.name, c.company_name as company
             FROM campaign_contacts cc
             JOIN contacts c ON cc.contact_id = c.id
             WHERE cc.campaign_id = $1 
             AND cc.status = 'pending'
             AND cc.current_follow_up_step = 0
             ORDER BY cc.enrolled_at
             LIMIT $2`,
            [campaignId, remainingToday]
        );

        if (pendingContacts.rows.length === 0) {
            console.log(`No pending contacts for campaign ${campaignId}`);
            return;
        }

        // Get initial email template
        const templateResult = await client.query(
            `SELECT * FROM campaign_email_templates 
             WHERE campaign_id = $1 AND template_type = 'initial'
             ORDER BY created_at DESC
             LIMIT 1`,
            [campaignId]
        );

        if (templateResult.rows.length === 0) {
            console.error(`No initial template found for campaign ${campaignId}`);
            return;
        }

        const template = templateResult.rows[0];

        // Get campaign details for sender info
        const campaignResult = await client.query(
            'SELECT * FROM outreach_campaigns WHERE id = $1',
            [campaignId]
        );
        const campaign = campaignResult.rows[0];

        // Process each contact
        for (const contact of pendingContacts.rows) {
            try {
                // Send email (returns conversation ID and email details)
                const { conversationId, rotationEmail } = await sendCampaignEmail(campaignId, tenantId, contact, template, campaign, client);

                // Calculate next send time for first follow-up
                let nextSendAt = null;
                
                // Get first follow-up template (ordered by created_at)
                const followUpResult = await client.query(
                    `SELECT * FROM campaign_email_templates 
                     WHERE campaign_id = $1 AND template_type = 'follow_up'
                     ORDER BY created_at
                     LIMIT 1`,
                    [campaignId]
                );

                if (followUpResult.rows.length > 0) {
                    const firstFollowUp = followUpResult.rows[0];
                    nextSendAt = calculateNextSendTime(
                        firstFollowUp.wait_period_value || 3,
                        firstFollowUp.wait_period_unit || 'days'
                    );
                    console.log(`[Campaign ${campaignId}] Scheduled follow-up for ${contact.email}: ${nextSendAt}`);
                } else {
                    console.log(`[Campaign ${campaignId}] No follow-ups configured for ${contact.email}`);
                }

                // Update campaign contact with status, conversation, and sender email
                await client.query(
                    `UPDATE campaign_contacts 
                     SET status = 'sent', 
                         conversation_id = $1, 
                         last_sent_at = now(), 
                         current_follow_up_step = 1,
                         next_send_at = $2,
                         sender_email_address = $3,
                         updated_at = now()
                     WHERE id = $4`,
                    [conversationId, nextSendAt, rotationEmail.emailAddress, contact.id]
                );

                console.log(`Initial email processed for ${contact.email}. Next follow-up: ${nextSendAt}`);

            } catch (error) {
                console.error(`Error sending email to contact ${contact.contact_id}:`, error);
                // Mark as bounced
                await client.query(
                    `UPDATE campaign_contacts 
                     SET status = 'bounced', updated_at = now()
                     WHERE id = $1`,
                    [contact.id]
                );
            }
        }

        console.log(`Processed ${pendingContacts.rows.length} emails for campaign ${campaignId}`);

    } finally {
        client.release();
    }
}

/**
 * Send email to a campaign contact
 */
async function sendCampaignEmail(campaignId, tenantId, contact, template, campaign, client, forcedEmailAddress = null) {
    // Get next rotation email (or use forced email for follow-ups)
    let rotationEmail;
    if (forcedEmailAddress) {
        // For follow-ups: use the same email that sent the initial email
        // Construct a minimal rotation object with the forced address
        rotationEmail = {
            emailAddress: forcedEmailAddress,
            emailType: 'forced', // Will be determined from DB lookup
            id: null // Not used for forced emails
        };
        // Look up the actual provider details for this email
        const emailLookup = await client.query(
            `SELECT 
                CASE 
                    WHEN tec.id IS NOT NULL THEN 'connection'
                    ELSE 'identity'
                END as email_type,
                tec.id as email_connection_id,
                tec.provider_type,
                tafe.id as allowed_email_id,
                tafe.ses_identity_id
             FROM (SELECT $1::text as email) e
             LEFT JOIN tenant_email_connections tec ON tec.email_address = e.email AND tec.tenant_id = $2
             LEFT JOIN tenant_allowed_from_emails tafe ON tafe.email_address = e.email AND tafe.tenant_id = $2
             LIMIT 1`,
            [forcedEmailAddress, tenantId]
        );
        
        if (emailLookup.rows.length > 0) {
            const lookup = emailLookup.rows[0];
            rotationEmail.emailType = lookup.email_type;
            rotationEmail.emailConnectionId = lookup.email_connection_id;
            rotationEmail.provider = lookup.provider_type;
            rotationEmail.allowedEmailId = lookup.allowed_email_id;
            rotationEmail.sesIdentityId = lookup.ses_identity_id;
        }
    } else {
        // Normal rotation for initial emails
        rotationEmail = await emailRotationService.getNextRotationEmail(campaignId);
    }

    // Personalize email content
    const personalizedSubject = personalizeContent(template.subject, contact);
    const personalizedBodyHtml = personalizeContent(template.body_html, contact);
    const personalizedBodyText = personalizeContent(template.body_text || '', contact);

    // Create conversation first (NEW conversation per outreach)
    // Store campaign_sender_email for reply consistency with rotating emails
    const conversationResult = await client.query(
        `INSERT INTO conversations (
            tenant_id, contact_id, channel, channel_contact_id, status, 
            is_campaign, campaign_id, has_reply, campaign_sender_email, subject
        ) VALUES ($1, $2, 'email', $3, 'open', true, $4, false, $5, $6)
        RETURNING id`,
        [tenantId, contact.contact_id, contact.email, campaignId, rotationEmail.emailAddress, personalizedSubject]
    );

    const conversationId = conversationResult.rows[0].id;
    console.log(`Created campaign conversation ${conversationId} with sender: ${rotationEmail.emailAddress}`);

    // Generate Message-ID for threading
    const currentStep = contact.current_follow_up_step || 0;
    const messageIdHeader = generateCampaignMessageId(campaignId, contact.contact_id, currentStep);
    
    // Get threading headers if this is a follow-up (conversation already has messages)
    const { getConversationThreadingHeaders } = require('../../email/services/emailThreadingHelper');
    const threadingHeaders = currentStep > 0 ? await getConversationThreadingHeaders(conversationId) : null;

    // Prepare email send based on email type
    let providerInstance;
    let fromEmail;

    if (rotationEmail.emailType === 'identity') {
        // SES Identity - use AWS SES directly
        const SESProvider = require('../../email/services/sesProvider');
        // Create SES provider with minimal config (tenant_id is all it needs for sending)
        providerInstance = new SESProvider({ tenant_id: tenantId });
        fromEmail = rotationEmail.emailAddress; // Already resolved from identity_value or allowed_email
    } else {
        // Gmail/Outlook connection - use EmailProviderFactory
        providerInstance = await EmailProviderFactory.getProviderByConnectionId(
            rotationEmail.emailConnectionId
        );
        fromEmail = rotationEmail.emailAddress;
    }

    // Send email using the provider
    let emailData = {
        from: fromEmail,
        to: contact.email,
        subject: personalizedSubject,
        html: personalizedBodyHtml,
        text: personalizedBodyText
    };

    // Add threading headers
    emailData = addThreadingHeaders(emailData, {
        messageId: messageIdHeader,
        inReplyTo: threadingHeaders?.lastMessageId || null,
        references: threadingHeaders?.references || null,
        campaignId: campaignId,
        contactId: contact.contact_id
    }, rotationEmail.emailType);

    const result = await providerInstance.sendEmail(emailData);

    // Store message in messages table (using correct schema)
    const messageResult = await client.query(
        `INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel, 
            content_text, content_html, provider_message_id, 
            provider, status, sent_at, metadata
        ) VALUES ($1, $2, 'outbound', 'agent', 'email', $3, $4, $5, $6, 'sent', now(), $7)
        RETURNING id`,
        [
            tenantId,
            conversationId,
            personalizedBodyText,
            personalizedBodyHtml,
            result.messageId || null,
            rotationEmail.emailType === 'identity' ? 'ses' : rotationEmail.provider,
            JSON.stringify({
                from: fromEmail,
                to: contact.email,
                subject: personalizedSubject
            })
        ]
    );

    // Store email metadata with threading headers
    await storeEmailMetadata(messageResult.rows[0].id, {
        fromAddress: fromEmail,
        toAddresses: [{ email: contact.email, name: contact.name }],
        messageIdHeader: messageIdHeader,
        inReplyTo: threadingHeaders?.lastMessageId || null,
        references: threadingHeaders?.references || null,
        subject: personalizedSubject
    });

    // Increment rotation email sent count (only for non-forced emails)
    if (!forcedEmailAddress && rotationEmail.id) {
        await emailRotationService.incrementDailySent(rotationEmail.id);
    }

    // Update campaign analytics - increment emails sent
    await client.query(
        `UPDATE campaign_analytics
         SET total_emails_sent = total_emails_sent + 1,
             emails_sent_today = emails_sent_today + 1,
             last_updated_at = now()
         WHERE campaign_id = $1`,
        [campaignId]
    );

    // Increment campaign daily sent
    await emailRotationService.incrementCampaignDailySent(campaignId);

    console.log(`Email sent to ${contact.email} for campaign ${campaignId}`);
    
    // Return conversation ID so caller can update status/steps
    return {
        conversationId: conversationId, // Return the conversation ID we created
        rotationEmail: rotationEmail // Return the full rotation email object
    };
}

/**
 * Personalize email content with contact data
 */
function personalizeContent(content, contact) {
    if (!content) return '';
    
    let personalized = content;
    
    // Replace {{name}} with contact name or default
    personalized = personalized.replace(
        /\{\{name\}\}/gi, 
        contact.name || contact.metadata?.name || 'there'
    );
    
    // Replace {{company}} with contact company or default
    personalized = personalized.replace(
        /\{\{company\}\}/gi, 
        contact.company || contact.metadata?.company || 'your company'
    );

    // Add more personalization fields as needed
    personalized = personalized.replace(
        /\{\{email\}\}/gi,
        contact.email || ''
    );

    return personalized;
}

/**
 * Start campaign worker (runs every 5 minutes)
 */
function startCampaignWorker() {
    console.log('✓ Campaign email worker started');
    
    // Process immediately on start
    processCampaignEmails().catch(err => {
        console.error('Campaign worker error:', err);
    });

    // Then run every 5 minutes
    setInterval(() => {
        processCampaignEmails().catch(err => {
            console.error('Campaign worker error:', err);
        });
    }, 5 * 60 * 1000); // 5 minutes
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
            now.setDate(now.getDate() + 1); // Default 1 day
    }

    return now;
}

module.exports = {
    processCampaignEmails,
    processCampaign,
    sendCampaignEmail,
    startCampaignWorker
};
