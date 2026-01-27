const { pool } = require('../../config/db');
const { createDomainIdentity, fetchIdentityStatus } = require('../services/sesIdentityService');
const { sendTenantEmail } = require('../services/sesSendService');
const EmailProviderFactory = require('../services/emailProviderFactory');

// ===== MULTI-PROVIDER EMAIL OPERATIONS =====

// POST /api/email/send - Send email via any provider
exports.sendEmailMultiProvider = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { to, subject, html, text, fromEmail, replyTo, connectionId, providerType } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ error: 'to, subject and html or text required' });
    }

    try {
        let provider;

        // Determine which provider to use
        if (connectionId) {
            // Use specific connection
            provider = await EmailProviderFactory.getProviderByConnectionId(connectionId);
        } else if (providerType) {
            // Find active connection of this type
            const result = await pool.query(
                `SELECT * FROM tenant_email_connections 
                 WHERE tenant_id = $1 AND provider_type = $2 AND is_active = true
                 LIMIT 1`,
                [tenantId, providerType]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: `No active ${providerType} connection found` });
            }

            provider = EmailProviderFactory.getProvider(providerType, result.rows[0]);
        } else {
            // Use default provider
            provider = await EmailProviderFactory.getDefaultProvider(tenantId);
        }

        // Send email
        const result = await provider.sendEmail({
            from: fromEmail,
            to,
            subject,
            html,
            text,
            replyTo
        });

        // Log to outbound_emails table
        const connection = provider.connectionConfig;
        await pool.query(
            `INSERT INTO outbound_emails (
                tenant_id, to_email, from_email, subject, body_html, body_text,
                status, provider_type, connection_id, provider_message_id, sent_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, $8, $9, now())`,
            [
                tenantId,
                Array.isArray(to) ? to.join(', ') : to,
                fromEmail || connection.email_address,
                subject,
                html,
                text,
                connection.provider_type,
                connection.id,
                result.providerMessageId
            ]
        );

        res.json({ 
            ok: true, 
            messageId: result.messageId,
            providerMessageId: result.providerMessageId,
            provider: connection.provider_type
        });
    } catch (err) {
        console.error('Multi-provider send error:', err);
        res.status(500).json({ error: 'Send failed', details: err.message });
    }
};

// GET /api/email/inbound-multi - Fetch emails from all providers
exports.getInboundEmailsMulti = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { limit = 50, providerType } = req.query;

    try {
        let query = `SELECT ie.*, tec.email_address as connection_email, tec.provider_type
                     FROM inbound_emails ie
                     LEFT JOIN tenant_email_connections tec ON ie.connection_id = tec.id
                     WHERE ie.tenant_id = $1`;
        const params = [tenantId];

        if (providerType) {
            query += ` AND ie.provider_type = $2`;
            params.push(providerType);
        }

        query += ` ORDER BY ie.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        res.json({ 
            emails: result.rows.map(email => ({
                id: email.id,
                from: email.from_json,
                to: email.to_json,
                subject: email.subject,
                textBody: email.text_body,
                htmlBody: email.html_body,
                receivedAt: email.created_at,
                provider: email.provider_type,
                providerMessageId: email.provider_message_id,
                connectionEmail: email.connection_email
            }))
        });
    } catch (err) {
        console.error('Error fetching inbound emails (multi):', err);
        res.status(500).json({ error: 'Failed to fetch emails', details: err.message });
    }
};

// GET /api/email/connections - List all email connections
exports.getEmailConnections = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT tec.*, ep.display_name as provider_name
             FROM tenant_email_connections tec
             JOIN email_providers ep ON tec.provider_id = ep.id
             WHERE tec.tenant_id = $1
             ORDER BY tec.is_default DESC, tec.created_at DESC`,
            [tenantId]
        );

        res.json({ 
            connections: result.rows.map(conn => ({
                id: conn.id,
                provider: conn.provider_type,
                providerName: conn.provider_name,
                email: conn.email_address,
                displayName: conn.display_name,
                isActive: conn.is_active,
                isDefault: conn.is_default,
                oauthExpiresAt: conn.oauth_expires_at,
                lastError: conn.last_error,
                createdAt: conn.created_at
            }))
        });
    } catch (err) {
        console.error('Error fetching connections:', err);
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
};

// POST /api/email/connections/:id/set-default - Set default connection
exports.setDefaultConnection = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify connection exists and belongs to tenant
        const check = await client.query(
            `SELECT id FROM tenant_email_connections 
             WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [id, tenantId]
        );

        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Connection not found' });
        }

        // Unset all defaults
        await client.query(
            `UPDATE tenant_email_connections SET is_default = false WHERE tenant_id = $1`,
            [tenantId]
        );

        // Set new default
        await client.query(
            `UPDATE tenant_email_connections 
             SET is_default = true, updated_at = now() 
             WHERE id = $1`,
            [id]
        );

        await client.query('COMMIT');

        res.json({ message: 'Default connection updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error setting default connection:', err);
        res.status(500).json({ error: 'Failed to set default connection' });
    } finally {
        client.release();
    }
};

// ===== SES IDENTITIES =====

// POST /api/email/identities/domain - Create domain identity
exports.createDomainIdentity = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { domain } = req.body;

    if (!domain) {
        return res.status(400).json({ error: "domain is required" });
    }

    try {
        let sesRes;
        let isExisting = false;
        
        try {
            sesRes = await createDomainIdentity(domain);
        } catch (sesErr) {
            // Handle AlreadyExistsException - domain already registered in SES
            if (sesErr.name === 'AlreadyExistsException') {
                isExisting = true;
                // Fetch existing identity status instead
                sesRes = await require('../services/sesIdentityService').getIdentity(domain);
            } else {
                throw sesErr;
            }
        }

        const dkimTokens = sesRes.DkimAttributes?.Tokens || [];
        const verificationStatus = isExisting 
            ? (sesRes.VerificationStatus || "PENDING")
            : "PENDING";
        const dkimStatus = sesRes.DkimAttributes?.Status || "PENDING";

        // Build DNS records for the user
        const dkimRecords = dkimTokens.map((token) => ({
            type: "CNAME",
            name: `${token}._domainkey.${domain}`,
            value: `${token}.dkim.amazonses.com`,
        }));

        const spfRecord = {
            type: "TXT",
            name: domain,
            value: "v=spf1 include:amazonses.com -all",
        };

        const client = await pool.connect();
        try {
            const insertRes = await client.query(
                `INSERT INTO tenant_ses_identities (
                    tenant_id, identity_type, identity_value,
                    verification_status, dkim_status, dkim_tokens, spf_instructions
                ) VALUES ($1, 'domain', $2, $3, $4, $5, $6)
                ON CONFLICT (tenant_id, identity_type, identity_value)
                DO UPDATE SET
                    verification_status = EXCLUDED.verification_status,
                    dkim_status = EXCLUDED.dkim_status,
                    dkim_tokens = EXCLUDED.dkim_tokens,
                    spf_instructions = EXCLUDED.spf_instructions,
                    last_checked_at = now()
                RETURNING *`,
                [
                    tenantId,
                    domain,
                    verificationStatus,
                    dkimStatus,
                    JSON.stringify(dkimTokens),
                    spfRecord.value,
                ]
            );

            return res.json({
                identity: insertRes.rows[0],
                dnsRecords: {
                    dkim: dkimRecords,
                    spf: spfRecord,
                },
                existing: isExisting,
                message: isExisting ? "Domain already exists in SES, fetched current status" : "Domain identity created"
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Error creating SES identity:", err);
        return res.status(500).json({ error: "SES identity creation failed", details: err.message });
    }
};

// GET /api/email/identities - List all identities
exports.getIdentities = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT * FROM tenant_ses_identities WHERE tenant_id = $1 ORDER BY created_at DESC`,
            [tenantId]
        );
        res.json({ identities: result.rows });
    } catch (err) {
        console.error("Error fetching identities:", err);
        res.status(500).json({ error: "Failed to fetch identities" });
    }
};

// GET /api/email/identities/:id/status - Check and update status from SES
exports.checkIdentityStatus = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        // Get identity from DB
        const identityRes = await pool.query(
            `SELECT * FROM tenant_ses_identities WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        if (identityRes.rows.length === 0) {
            return res.status(404).json({ error: "Identity not found" });
        }

        const identity = identityRes.rows[0];
        const status = await fetchIdentityStatus(identity.identity_value);

        // Update DB with new status
        const updateRes = await pool.query(
            `UPDATE tenant_ses_identities
             SET verification_status = $1, dkim_status = $2, last_checked_at = now()
             WHERE id = $3
             RETURNING *`,
            [status.verificationStatus, status.dkimStatus, id]
        );

        res.json({
            identity: updateRes.rows[0],
            sesStatus: status,
        });
    } catch (err) {
        console.error("Error checking identity status:", err);
        res.status(500).json({ error: "Failed to check status", details: err.message });
    }
};

// ===== ALLOWED FROM EMAILS =====

// POST /api/email/allowed-from - Add allowed sender
exports.addAllowedFrom = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { email, identityId, isDefault } = req.body;

    if (!email || !identityId) {
        return res.status(400).json({ error: "email and identityId required" });
    }

    try {
        // Verify identity belongs to tenant
        const identityCheck = await pool.query(
            `SELECT id FROM tenant_ses_identities WHERE id = $1 AND tenant_id = $2`,
            [identityId, tenantId]
        );

        if (identityCheck.rows.length === 0) {
            return res.status(400).json({ error: "Identity not found for this tenant" });
        }

        const result = await pool.query(
            `INSERT INTO tenant_allowed_from_emails (tenant_id, ses_identity_id, email_address, is_default)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id, email_address) DO UPDATE SET is_default = EXCLUDED.is_default
             RETURNING *`,
            [tenantId, identityId, email.toLowerCase(), !!isDefault]
        );

        res.json({ allowedEmail: result.rows[0] });
    } catch (err) {
        console.error("Error adding allowed from:", err);
        res.status(500).json({ error: "Failed to add allowed email" });
    }
};

// GET /api/email/allowed-from - List allowed senders
exports.getAllowedFrom = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT tafe.*, tsi.identity_value as domain, tsi.verification_status
             FROM tenant_allowed_from_emails tafe
             JOIN tenant_ses_identities tsi ON tafe.ses_identity_id = tsi.id
             WHERE tafe.tenant_id = $1
             ORDER BY tafe.is_default DESC, tafe.created_at DESC`,
            [tenantId]
        );
        res.json({ allowedEmails: result.rows });
    } catch (err) {
        console.error("Error fetching allowed from:", err);
        res.status(500).json({ error: "Failed to fetch allowed emails" });
    }
};

// DELETE /api/email/allowed-from/:id - Remove allowed sender
exports.removeAllowedFrom = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM tenant_allowed_from_emails WHERE id = $1 AND tenant_id = $2 RETURNING *`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Allowed email not found" });
        }

        res.json({ deleted: result.rows[0] });
    } catch (err) {
        console.error("Error removing allowed from:", err);
        res.status(500).json({ error: "Failed to remove allowed email" });
    }
};

// ===== SEND EMAIL =====

// POST /api/email/send - Send email
exports.sendEmail = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { to, subject, html, text, fromEmail, replyTo } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ error: "to, subject and html or text required" });
    }

    try {
        const result = await sendTenantEmail({
            tenantId,
            fromEmail,
            to,
            subject,
            html,
            text,
            replyTo,
        });

        res.json({ ok: true, ...result });
    } catch (err) {
        console.error("Error sending email:", err);
        res.status(500).json({ error: "Send failed", details: err.message });
    }
};

// ===== OUTBOUND EMAILS =====

// GET /api/email/outbound - List sent emails
exports.getOutboundEmails = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { limit = 50 } = req.query;

    try {
        const result = await pool.query(
            `SELECT * FROM outbound_emails WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [tenantId, parseInt(limit)]
        );
        res.json({ emails: result.rows });
    } catch (err) {
        console.error("Error fetching outbound emails:", err);
        res.status(500).json({ error: "Failed to fetch outbound emails" });
    }
};

// ===== INBOUND EMAILS =====

// GET /api/email/inbound - List received emails
exports.getInboundEmails = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { limit = 50 } = req.query;

    try {
        const result = await pool.query(
            `SELECT * FROM inbound_emails WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [tenantId, parseInt(limit)]
        );
        res.json({ emails: result.rows });
    } catch (err) {
        console.error("Error fetching inbound emails:", err);
        res.status(500).json({ error: "Failed to fetch inbound emails" });
    }
};

// ===== ALLOWED INBOUND EMAILS =====

// POST /api/email/allowed-inbound - Add allowed inbound address
exports.addAllowedInbound = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { email, description } = req.body;

    if (!email) {
        return res.status(400).json({ error: "email is required" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO allowed_inbound_emails (tenant_id, email_address, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (tenant_id, email_address) DO UPDATE SET description = EXCLUDED.description
             RETURNING *`,
            [tenantId, email.toLowerCase(), description || null]
        );
        res.json({ allowedInbound: result.rows[0] });
    } catch (err) {
        console.error("Error adding allowed inbound:", err);
        res.status(500).json({ error: "Failed to add allowed inbound" });
    }
};

// GET /api/email/allowed-inbound - List allowed inbound addresses
exports.getAllowedInbound = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT * FROM allowed_inbound_emails WHERE tenant_id = $1 ORDER BY created_at DESC`,
            [tenantId]
        );
        res.json({ allowedInbound: result.rows });
    } catch (err) {
        console.error("Error fetching allowed inbound:", err);
        res.status(500).json({ error: "Failed to fetch allowed inbound" });
    }
};

// DELETE /api/email/allowed-inbound/:id - Remove allowed inbound address
exports.removeAllowedInbound = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM allowed_inbound_emails WHERE id = $1 AND tenant_id = $2 RETURNING *`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Allowed inbound not found" });
        }

        res.json({ deleted: result.rows[0] });
    } catch (err) {
        console.error("Error removing allowed inbound:", err);
        res.status(500).json({ error: "Failed to remove allowed inbound" });
    }
};
