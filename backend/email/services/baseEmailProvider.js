/**
 * Base Email Provider Interface
 * All email providers must extend this class and implement these methods
 */
class BaseEmailProvider {
    constructor(connectionConfig) {
        this.connectionConfig = connectionConfig;
    }

    /**
     * Send an email
     * @param {Object} params - Email parameters
     * @param {string} params.from - Sender email address
     * @param {string|string[]} params.to - Recipient email address(es)
     * @param {string} params.subject - Email subject
     * @param {string} params.html - HTML body
     * @param {string} params.text - Plain text body
     * @param {string} params.replyTo - Reply-to address
     * @param {Array} params.attachments - Email attachments
     * @returns {Promise<{messageId: string, providerMessageId: string}>}
     */
    async sendEmail({ from, to, subject, html, text, replyTo, attachments }) {
        throw new Error('sendEmail() must be implemented by provider');
    }

    /**
     * Fetch emails from provider
     * @param {Object} params - Fetch parameters
     * @param {number} params.limit - Maximum number of emails to fetch
     * @param {string} params.query - Provider-specific query string
     * @param {string} params.pageToken - Pagination token
     * @returns {Promise<{emails: Array, nextPageToken: string}>}
     */
    async fetchEmails({ limit, query, pageToken }) {
        throw new Error('fetchEmails() must be implemented by provider');
    }

    /**
     * Get a specific email by provider message ID
     * @param {string} providerMessageId - Provider-specific message ID
     * @returns {Promise<Object>} - Email data
     */
    async getEmail(providerMessageId) {
        throw new Error('getEmail() must be implemented by provider');
    }

    /**
     * Check connection status and validity
     * @returns {Promise<{status: string, error: string, details: Object}>}
     */
    async checkConnection() {
        throw new Error('checkConnection() must be implemented by provider');
    }

    /**
     * Refresh credentials if needed (e.g., OAuth token refresh)
     * @returns {Promise<{success: boolean, credentials: Object}>}
     */
    async refreshCredentials() {
        throw new Error('refreshCredentials() must be implemented by provider');
    }

    /**
     * Disconnect/revoke connection
     * @returns {Promise<{success: boolean}>}
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by provider');
    }

    /**
     * Normalize email data to unified format
     * @param {Object} providerEmail - Provider-specific email format
     * @returns {Object} - Normalized email object
     */
    normalizeEmail(providerEmail) {
        throw new Error('normalizeEmail() must be implemented by provider');
    }
}

module.exports = BaseEmailProvider;
