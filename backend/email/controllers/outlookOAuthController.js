const { pool } = require('../../config/db');
const { encrypt } = require('../../utils/encryption');
const OutlookProvider = require('../services/outlookProvider');

/**
 * GET /api/settings/email/outlook/authorize
 * Start Outlook OAuth flow
 */
exports.startOutlookAuthorization = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        // Validate environment variables
        if (!process.env.MICROSOFT_OAUTH_CLIENT_ID || !process.env.MICROSOFT_OAUTH_CLIENT_SECRET) {
            return res.status(500).json({ 
                error: 'Microsoft OAuth not configured. Please set MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in environment variables.' 
            });
        }

        // Generate state token with tenant info
        const state = Buffer.from(JSON.stringify({
            tenantId,
            timestamp: Date.now()
        })).toString('base64');

        // Get authorization URL
        const authUrl = OutlookProvider.getAuthorizationUrl(state);

        res.json({ authorizationUrl: authUrl });
    } catch (err) {
        console.error('Outlook authorization error:', err);
        res.status(500).json({ 
            error: 'Failed to start Outlook authorization', 
            details: err.message 
        });
    }
};

/**
 * GET /oauth/microsoft/callback
 * Handle OAuth callback from Microsoft
 */
exports.handleOutlookCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
        console.error('OAuth error:', error, error_description);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_error=${encodeURIComponent('Missing code or state parameter')}`);
    }

    try {
        // Decode state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { tenantId } = stateData;

        if (!tenantId) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_error=${encodeURIComponent('Invalid state parameter')}`);
        }

        // Exchange code for tokens
        const { tokens, emailAddress, expiresAt } = await OutlookProvider.exchangeCodeForTokens(code);

        // Get Outlook provider ID
        const providerResult = await pool.query(
            `SELECT id FROM email_providers WHERE provider_type = 'outlook'`
        );

        if (providerResult.rows.length === 0) {
            console.error('Outlook provider not found in email_providers table');
            return res.redirect(
                `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_error=${encodeURIComponent('Provider not configured in database')}`
            );
        }

        const providerId = providerResult.rows[0].id;

        // Encrypt credentials
        const encryptedCredentials = encrypt({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
            scope: tokens.scope
        });

        // Store connection in database
        const connectionResult = await pool.query(
            `INSERT INTO tenant_email_connections (
                tenant_id, provider_id, provider_type, email_address,
                credentials_encrypted, oauth_scopes, oauth_expires_at,
                is_active, is_default
            ) VALUES ($1::uuid, $2::uuid, 'outlook', $3, $4::text, $5, $6, true, false)
            ON CONFLICT (tenant_id, email_address, provider_type) 
            DO UPDATE SET
                credentials_encrypted = EXCLUDED.credentials_encrypted,
                oauth_expires_at = EXCLUDED.oauth_expires_at,
                is_active = true,
                updated_at = now()
            RETURNING *`,
            [
                tenantId,
                providerId,
                emailAddress,
                encryptedCredentials,
                tokens.scope ? tokens.scope.split(' ') : [],
                expiresAt
            ]
        );

        const connection = connectionResult.rows[0];

        // Redirect to frontend with success
        res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_connected=true&email=${encodeURIComponent(emailAddress)}`
        );
    } catch (err) {
        console.error('===== Outlook callback error =====');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        console.error('==================================');
        res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?outlook_error=${encodeURIComponent(err.message)}`
        );
    }
};

/**
 * GET /api/settings/email/outlook/status
 * Get Outlook connection status
 */
exports.getOutlookStatus = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT id, email_address, is_active, is_default, oauth_expires_at, created_at, last_error
             FROM tenant_email_connections
             WHERE tenant_id = $1::uuid AND provider_type = 'outlook'
             ORDER BY created_at DESC`,
            [tenantId]
        );

        res.json({ 
            connections: result.rows.map(conn => ({
                id: conn.id,
                email: conn.email_address,
                provider_type: 'outlook',
                is_active: conn.is_active,
                is_default: conn.is_default,
                expires_at: conn.oauth_expires_at
            }))
        });
    } catch (err) {
        console.error('Get Outlook status error:', err);
        res.status(500).json({ 
            error: 'Failed to get Outlook status', 
            details: err.message 
        });
    }
};

/**
 * DELETE /api/settings/email/outlook/disconnect/:connectionId
 * Disconnect Outlook account
 */
exports.disconnectOutlook = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { connectionId } = req.params;

    try {
        // Get connection
        const connectionResult = await pool.query(
            `SELECT * FROM tenant_email_connections 
             WHERE id = $1::uuid AND tenant_id = $2::uuid AND provider_type = 'outlook'`,
            [connectionId, tenantId]
        );

        if (connectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Outlook connection not found' });
        }

        const connection = connectionResult.rows[0];

        // Try to revoke OAuth token
        try {
            const provider = new OutlookProvider(connection);
            await provider.disconnect();
        } catch (revokeErr) {
            console.warn('Failed to revoke Outlook token:', revokeErr);
            // Continue anyway to mark as inactive
        }

        // Mark connection as inactive
        await pool.query(
            `UPDATE tenant_email_connections 
             SET is_active = false, updated_at = now()
             WHERE id = $1::uuid`,
            [connectionId]
        );

        res.json({ message: 'Outlook disconnected successfully' });
    } catch (err) {
        console.error('Disconnect Outlook error:', err);
        res.status(500).json({ 
            error: 'Failed to disconnect Outlook', 
            details: err.message 
        });
    }
};

/**
 * POST /api/settings/email/outlook/set-default/:connectionId
 * Set Outlook connection as default
 */
exports.setOutlookAsDefault = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { connectionId } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify connection exists and belongs to tenant
        const connectionCheck = await client.query(
            `SELECT id FROM tenant_email_connections 
             WHERE id = $1::uuid AND tenant_id = $2::uuid AND provider_type = 'outlook' AND is_active = true`,
            [connectionId, tenantId]
        );

        if (connectionCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Outlook connection not found' });
        }

        // Unset all defaults for this tenant
        await client.query(
            `UPDATE tenant_email_connections 
             SET is_default = false 
             WHERE tenant_id = $1::uuid`,
            [tenantId]
        );

        // Set this connection as default
        await client.query(
            `UPDATE tenant_email_connections 
             SET is_default = true, updated_at = now()
             WHERE id = $1::uuid`,
            [connectionId]
        );

        await client.query('COMMIT');

        res.json({ message: 'Outlook set as default successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Set Outlook default error:', err);
        res.status(500).json({ 
            error: 'Failed to set Outlook as default', 
            details: err.message 
        });
    } finally {
        client.release();
    }
};
