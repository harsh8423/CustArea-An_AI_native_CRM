const BaseEmailProvider = require('./baseEmailProvider');
const { sendTenantEmail } = require('./sesSendService');

const { pool } = require('../../config/db');

/**
 * AWS SES Email Provider
 * Wraps existing SES functionality in the new provider interface
 */
class SESProvider extends BaseEmailProvider {
    constructor(connectionConfig) {
        super(connectionConfig);
    }

    /**
     * Send email via AWS SES
     */
    async sendEmail({ from, to, subject, html, text, replyTo }) {
        try {
            const result = await sendTenantEmail({
                tenantId: this.connectionConfig.tenant_id,
                fromEmail: from || this.connectionConfig.email_address,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
                text,
                replyTo
            });

            return {
                messageId: result.sesMessageId,
                providerMessageId: result.sesMessageId
            };
        } catch (error) {
            console.error('SES send error:', error);
            throw new Error(`Failed to send email via SES: ${error.message}`);
        }
    }

    /**
     * Fetch emails from SES (actually from our database of received emails)
     */
    async fetchEmails({ limit = 50, query = '', pageToken = null }) {
        try {
            // SES inbound emails are stored in our database
            const result = await pool.query(
                `SELECT * FROM inbound_emails 
                 WHERE tenant_id = $1 AND provider_type = 'ses'
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [this.connectionConfig.tenant_id, limit]
            );

            return {
                emails: result.rows.map(row => this.normalizeEmail(row)),
                nextPageToken: null
            };
        } catch (error) {
            console.error('SES fetch error:', error);
            throw new Error(`Failed to fetch SES emails: ${error.message}`);
        }
    }

    /**
     * Get specific email by ID
     */
    async getEmail(messageId) {
        try {
            const result = await pool.query(
                `SELECT * FROM inbound_emails 
                 WHERE id = $1 AND provider_type = 'ses'`,
                [messageId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return this.normalizeEmail(result.rows[0]);
        } catch (error) {
            console.error('SES get email error:', error);
            return null;
        }
    }

    /**
     * Check SES connection status
     */
    async checkConnection() {
        try {
            // Check if we have verified identities
            const result = await pool.query(
                `SELECT * FROM tenant_ses_identities 
                 WHERE tenant_id = $1 AND verification_status = 'SUCCESS'
                 LIMIT 1`,
                [this.connectionConfig.tenant_id]
            );

            if (result.rows.length > 0) {
                return {
                    status: 'connected',
                    error: null,
                    details: {
                        verifiedIdentities: result.rows.length
                    }
                };
            } else {
                return {
                    status: 'not_verified',
                    error: 'No verified SES identities',
                    details: null
                };
            }
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                details: null
            };
        }
    }

    /**
     * SES doesn't need credential refresh (uses AWS SDK credentials)
     */
    async refreshCredentials() {
        return {
            success: true,
            credentials: null
        };
    }

    /**
     * SES disconnect (mark as inactive in database)
     */
    async disconnect() {
        try {
            await pool.query(
                `UPDATE tenant_email_connections 
                 SET is_active = false 
                 WHERE id = $1`,
                [this.connectionConfig.id]
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Normalize SES email (already in our format)
     */
    normalizeEmail(sesEmail) {
        return {
            provider_message_id: sesEmail.raw_message_id || sesEmail.id,
            from: sesEmail.from_json,
            to: sesEmail.to_json,
            cc: sesEmail.cc_json,
            bcc: sesEmail.bcc_json,
            subject: sesEmail.subject,
            text_body: sesEmail.text_body,
            html_body: sesEmail.html_body,
            received_at: sesEmail.created_at,
            raw_data: sesEmail
        };
    }
}

module.exports = SESProvider;
