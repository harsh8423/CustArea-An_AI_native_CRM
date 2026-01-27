const { pool } = require('../../config/db');
const { encrypt } = require('../../utils/encryption');
const GmailProvider = require('../services/gmailProvider');

/**
 * GET /api/settings/email/gmail/authorize
 * Start Gmail OAuth flow
 */
exports.startGmailAuthorization = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        // Generate state token with tenant info
        const state = Buffer.from(JSON.stringify({
            tenantId,
            timestamp: Date.now()
        })).toString('base64');

        // Get authorization URL
        const authUrl = GmailProvider.getAuthorizationUrl(state);

        res.json({ authorizationUrl: authUrl });
    } catch (err) {
        console.error('Gmail authorization error:', err);
        res.status(500).json({ 
            error: 'Failed to start Gmail authorization', 
            details: err.message 
        });
    }
};

/**
 * GET /oauth/google/callback
 * Handle OAuth callback from Google
 */
exports.handleGmailCallback = async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error('OAuth error:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail_error=${error}`);
    }

    if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    try {
        // Decode state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { tenantId } = stateData;

        if (!tenantId) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }

        // Exchange code for tokens
        const { tokens, emailAddress, expiresAt } = await GmailProvider.exchangeCodeForTokens(code);

        // Get Gmail provider ID
        const providerResult = await pool.query(
            `SELECT id FROM email_providers WHERE provider_type = 'gmail'`
        );

        if (providerResult.rows.length === 0) {
            return res.status(500).json({ error: 'Gmail provider not found in database' });
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
            ) VALUES ($1::uuid, $2::uuid, 'gmail', $3, $4::text, $5, $6, true, false)
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
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail_connected=true&email=${emailAddress}`
        );
    } catch (err) {
        console.error('===== Gmail callback error =====');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        console.error('===============================');
        res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail_error=${encodeURIComponent(err.message)}`
        );
    }
};

/**
 * GET /api/settings/email/gmail/status
 * Get Gmail connection status
 */
exports.getGmailStatus = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT id, email_address, is_active, is_default, oauth_expires_at, created_at, last_error
             FROM tenant_email_connections
             WHERE tenant_id = $1 AND provider_type = 'gmail'
             ORDER BY created_at DESC`,
            [tenantId]
        );

        res.json({ 
            connections: result.rows.map(conn => ({
                id: conn.id,
                email: conn.email_address,
                provider_type: 'gmail',
                is_active: conn.is_active,
                is_default: conn.is_default,
                expires_at: conn.oauth_expires_at
            }))
        });
    } catch (err) {
        console.error('Get Gmail status error:', err);
        res.status(500).json({ 
            error: 'Failed to get Gmail status', 
            details: err.message 
        });
    }
};

/**
 * DELETE /api/settings/email/gmail/disconnect/:connectionId
 * Disconnect Gmail account
 */
exports.disconnectGmail = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { connectionId } = req.params;

    try {
        // Get connection
        const connectionResult = await pool.query(
            `SELECT * FROM tenant_email_connections 
             WHERE id = $1 AND tenant_id = $2 AND provider_type = 'gmail'`,
            [connectionId, tenantId]
        );

        if (connectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Gmail connection not found' });
        }

        const connection = connectionResult.rows[0];

        // Try to revoke OAuth token
        try {
            const provider = new GmailProvider(connection);
            await provider.disconnect();
        } catch (revokeErr) {
            console.warn('Failed to revoke Gmail token:', revokeErr);
            // Continue anyway to mark as inactive
        }

        // Mark connection as inactive
        await pool.query(
            `UPDATE tenant_email_connections 
             SET is_active = false, updated_at = now()
             WHERE id = $1`,
            [connectionId]
        );

        res.json({ message: 'Gmail disconnected successfully' });
    } catch (err) {
        console.error('Disconnect Gmail error:', err);
        res.status(500).json({ 
            error: 'Failed to disconnect Gmail', 
            details: err.message 
        });
    }
};

/**
 * POST /api/settings/email/gmail/set-default/:connectionId
 * Set Gmail connection as default
 */
exports.setGmailAsDefault = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { connectionId } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify connection exists and belongs to tenant
        const connectionCheck = await client.query(
            `SELECT id FROM tenant_email_connections 
             WHERE id = $1 AND tenant_id = $2 AND provider_type = 'gmail' AND is_active = true`,
            [connectionId, tenantId]
        );

        if (connectionCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Gmail connection not found' });
        }

        // Unset all defaults for this tenant
        await client.query(
            `UPDATE tenant_email_connections 
             SET is_default = false 
             WHERE tenant_id = $1`,
            [tenantId]
        );

        // Set this connection as default
        await client.query(
            `UPDATE tenant_email_connections 
             SET is_default = true, updated_at = now()
             WHERE id = $1`,
            [connectionId]
        );

        await client.query('COMMIT');

        res.json({ message: 'Gmail set as default successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Set Gmail default error:', err);
        res.status(500).json({ 
            error: 'Failed to set Gmail as default', 
            details: err.message 
        });
    } finally {
        client.release();
    }
};
