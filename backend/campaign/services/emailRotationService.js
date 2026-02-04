/**
 * Email Rotation Service
 * Handles email rotation for campaigns (optional - supports single or multiple emails)
 */

const { pool } = require('../../config/db');

/**
 * Add email(s) to campaign rotation
 * @param {string} campaignId - Campaign ID
 * @param {array} emailConnections - Array of {id, type} objects where type is 'connection' or 'identity'
 */
async function addEmailsToRotation(campaignId, emailConnections) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Remove existing rotation emails
        await client.query(
            'DELETE FROM campaign_email_rotation WHERE campaign_id = $1',
            [campaignId]
        );

        // Add new rotation emails
        for (let i = 0; i < emailConnections.length; i++) {
            const { id, type } = emailConnections[i];
            
            if (type === 'connection') {
                await client.query(
                    `INSERT INTO campaign_email_rotation (
                        campaign_id, tenant_email_connection_id, email_type, rotation_order
                    ) VALUES ($1, $2, $3, $4)`,
                    [campaignId, id, 'connection', i + 1]
                );
            } else if (type === 'identity') {
                // For SES identities, the id is from tenant_allowed_from_emails
                // We need to get the actual ses_identity_id
                const sesLookup = await client.query(
                    `SELECT ses_identity_id FROM tenant_allowed_from_emails WHERE id = $1`,
                    [id]
                );
                
                if (sesLookup.rows.length > 0) {
                    const sesIdentityId = sesLookup.rows[0].ses_identity_id;
                    await client.query(
                        `INSERT INTO campaign_email_rotation (
                            campaign_id, ses_identity_id, email_type, rotation_order, allowed_email_id
                        ) VALUES ($1, $2, $3, $4, $5)`,
                        [campaignId, sesIdentityId, 'identity', i + 1, id]
                    );
                }
            }
        }

        await client.query('COMMIT');

        return {
            success: true,
            message: `Added ${emailConnections.length} email(s) to rotation`,
            count: emailConnections.length
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get next email for rotation
 * If only one email in rotation, always returns that email
 * If multiple emails, rotates based on current_daily_sent
 */
async function getNextRotationEmail(campaignId) {
    const client = await pool.connect();

    try {
        // Get all active rotation emails for this campaign
        // Join with tenant_email_connections, tenant_ses_identities, AND tenant_allowed_from_emails
        const rotationResult = await client.query(
            `SELECT 
                cer.*,
                tec.email_address as connection_email,
                tec.provider_type as connection_provider,
                tec.credentials_encrypted as connection_credentials,
                COALESCE(tafe.email_address, tsi.identity_value) as identity_email,
                'ses' as identity_provider
             FROM campaign_email_rotation cer
             LEFT JOIN tenant_email_connections tec ON cer.tenant_email_connection_id = tec.id
             LEFT JOIN tenant_ses_identities tsi ON cer.ses_identity_id = tsi.id
             LEFT JOIN tenant_allowed_from_emails tafe ON cer.allowed_email_id = tafe.id
             WHERE cer.campaign_id = $1 AND cer.is_active = true
             ORDER BY cer.rotation_order`,
            [campaignId]
        );

        if (rotationResult.rows.length === 0) {
            throw new Error('No active email connections found for campaign rotation');
        }

        // If only one email, return it (no rotation needed)
        if (rotationResult.rows.length === 1) {
            const row = rotationResult.rows[0];
            return {
                id: row.id,
                emailConnectionId: row.tenant_email_connection_id || row.ses_identity_id,
                emailAddress: row.connection_email || row.identity_email,
                provider: row.connection_provider || row.identity_provider || 'ses',
                credentials: row.connection_credentials,
                emailType: row.email_type,
                isRotation: false
            };
        }

        // Multiple emails - find the one with lowest daily sent count
        const emails = rotationResult.rows;
        let selectedEmail = emails[0];
        let lowestSent = emails[0].current_daily_sent;

        for (const email of emails) {
            if (email.current_daily_sent < lowestSent) {
                lowestSent = email.current_daily_sent;
                selectedEmail = email;
            }
        }

        return {
            id: selectedEmail.id,
            emailConnectionId: selectedEmail.tenant_email_connection_id || selectedEmail.ses_identity_id,
            emailAddress: selectedEmail.connection_email || selectedEmail.identity_email,
            provider: selectedEmail.connection_provider || selectedEmail.identity_provider || 'ses',
            credentials: selectedEmail.connection_credentials,
            emailType: selectedEmail.email_type,
            isRotation: true,
            currentDailySent: selectedEmail.current_daily_sent
        };

    } finally {
        client.release();
    }
}

/**
 * Increment daily sent count for rotation email
 */
async function incrementDailySent(rotationEmailId) {
    await pool.query(
        `UPDATE campaign_email_rotation 
         SET current_daily_sent = current_daily_sent + 1
         WHERE id = $1`,
        [rotationEmailId]
    );
}

/**
 * Check if campaign has reached daily send limit (200/day)
 */
async function checkDailyLimit(campaignId) {
    const result = await pool.query(
        `SELECT oc.daily_send_limit, ca.emails_sent_today
         FROM outreach_campaigns oc
         LEFT JOIN campaign_analytics ca ON oc.id = ca.campaign_id
         WHERE oc.id = $1`,
        [campaignId]
    );

    if (result.rows.length === 0) {
        throw new Error('Campaign not found');
    }

    const { daily_send_limit, emails_sent_today } = result.rows[0];
    const remaining = daily_send_limit - (emails_sent_today || 0);

    return {
        limit: daily_send_limit,
        sent: emails_sent_today || 0,
        remaining: remaining > 0 ? remaining : 0,
        reachedLimit: remaining <= 0
    };
}

/**
 * Increment campaign daily sent count
 */
async function incrementCampaignDailySent(campaignId) {
    await pool.query(
        `INSERT INTO campaign_analytics (id, campaign_id, emails_sent_today, today_date)
         VALUES ($1, $1, 1, CURRENT_DATE)
         ON CONFLICT (campaign_id) 
         DO UPDATE SET 
            emails_sent_today = campaign_analytics.emails_sent_today + 1,
            today_date = CURRENT_DATE`,
        [campaignId]
    );
}

/**
 * Get rotation emails for a campaign
 */
async function getRotationEmails(campaignId) {
    const result = await pool.query(
        `SELECT 
            cer.*,
            tec.email_address as connection_email,
            tec.provider_type as connection_provider,
            COALESCE(tafe.email_address, tsi.identity_value) as identity_email,
            'ses' as identity_provider
         FROM campaign_email_rotation cer
         LEFT JOIN tenant_email_connections tec ON cer.tenant_email_connection_id = tec.id
         LEFT JOIN tenant_ses_identities tsi ON cer.ses_identity_id = tsi.id
         LEFT JOIN tenant_allowed_from_emails tafe ON cer.allowed_email_id = tafe.id
         WHERE cer.campaign_id = $1
         ORDER BY cer.rotation_order`,
        [campaignId]
    );

    return result.rows.map(row => ({
        ...row,
        email_address: row.connection_email || row.identity_email,
        provider: row.connection_provider || row.identity_provider
    }));
}

module.exports = {
    addEmailsToRotation,
    getNextRotationEmail,
    incrementDailySent,
    checkDailyLimit,
    incrementCampaignDailySent,
    getRotationEmails
};
