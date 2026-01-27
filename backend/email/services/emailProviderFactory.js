const { pool } = require('../../config/db');
const { decrypt } = require('../../utils/encryption');
const GmailProvider = require('./gmailProvider');
const SESProvider = require('./sesProvider');

/**
 * Email Provider Factory
 * Creates appropriate email provider instance based on provider type
 */
class EmailProviderFactory {
    /**
     * Get provider instance by type
     * @param {string} providerType - 'gmail', 'ses', 'outlook', etc.
     * @param {Object} connectionConfig - Connection configuration from database
     * @returns {BaseEmailProvider} - Provider instance
     */
    static getProvider(providerType, connectionConfig) {
        switch (providerType.toLowerCase()) {
            case 'gmail':
                return new GmailProvider(connectionConfig);
            
            case 'ses':
                return new SESProvider(connectionConfig);
            
            case 'outlook':
                // TODO: Implement OutlookProvider
                throw new Error('Outlook provider not yet implemented');
            
            case 'workspace':
                // TODO: Implement Google Workspace provider
                throw new Error('Google Workspace provider not yet implemented');
            
            case 'smtp':
                // TODO: Implement SMTP provider
                throw new Error('SMTP provider not yet implemented');
            
            default:
                throw new Error(`Unknown email provider type: ${providerType}`);
        }
    }

    /**
     * Get provider instance by connection ID
     * @param {string} connectionId - UUID of tenant_email_connections
     * @returns {Promise<BaseEmailProvider>} - Provider instance
     */
    static async getProviderByConnectionId(connectionId) {
        const result = await pool.query(
            `SELECT * FROM tenant_email_connections WHERE id = $1 AND is_active = true`,
            [connectionId]
        );

        if (result.rows.length === 0) {
            throw new Error('Email connection not found or inactive');
        }

        const connection = result.rows[0];
        return this.getProvider(connection.provider_type, connection);
    }

    /**
     * Get default provider for a tenant
     * @param {string} tenantId - Tenant UUID
     * @returns {Promise<BaseEmailProvider>} - Default provider instance
     */
    static async getDefaultProvider(tenantId) {
        const result = await pool.query(
            `SELECT * FROM tenant_email_connections 
             WHERE tenant_id = $1 AND is_active = true AND is_default = true
             LIMIT 1`,
            [tenantId]
        );

        if (result.rows.length === 0) {
            // Fallback to any active connection
            const fallback = await pool.query(
                `SELECT * FROM tenant_email_connections 
                 WHERE tenant_id = $1 AND is_active = true
                 ORDER BY created_at ASC
                 LIMIT 1`,
                [tenantId]
            );

            if (fallback.rows.length === 0) {
                throw new Error('No active email connection found for tenant');
            }

            const connection = fallback.rows[0];
            return this.getProvider(connection.provider_type, connection);
        }

        const connection = result.rows[0];
        return this.getProvider(connection.provider_type, connection);
    }

    /**
     * Get all active providers for a tenant
     * @param {string} tenantId - Tenant UUID
     * @returns {Promise<Array<{connection: Object, provider: BaseEmailProvider}>>}
     */
    static async getAllProvidersForTenant(tenantId) {
        const result = await pool.query(
            `SELECT * FROM tenant_email_connections 
             WHERE tenant_id = $1 AND is_active = true
             ORDER BY is_default DESC, created_at ASC`,
            [tenantId]
        );

        return result.rows.map(connection => ({
            connection,
            provider: this.getProvider(connection.provider_type, connection)
        }));
    }
}

module.exports = EmailProviderFactory;
