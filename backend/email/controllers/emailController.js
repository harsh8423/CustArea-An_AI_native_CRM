const { pool } = require('../../config/db');
const { createDomainIdentity, fetchIdentityStatus } = require('../services/sesIdentityService');
const { sendTenantEmail } = require('../services/sesSendService');
const { logSentEmail } = require('../services/emailLoggingService');
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

        // Log to messages table (replacing outbound_emails)
        const connection = provider.connectionConfig;
        const loggedMessageId = await logSentEmail({
            tenantId,
            from: fromEmail || connection.email_address,
            to,
            subject,
            html,
            text,
            provider: connection.provider_type,
            providerMessageId: result.providerMessageId,
            connectionId: connection.id
        });

        res.json({ 
            ok: true, 
            messageId: loggedMessageId,
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

// ===== SES IDENTITIES WITH OWNERSHIP VERIFICATION =====

// POST /api/email/identities/claim-domain - Step 1: Claim domain with DNS verification
exports.claimDomain = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { domain } = req.body;
    
    if (!domain || !domain.trim()) {
        return res.status(400).json({ error: 'Domain is required' });
    }
    
    const cleanDomain = domain.trim().toLowerCase();
    
    // Basic domain format validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
        return res.status(400).json({ 
            error: 'Invalid domain format',
            message: 'Please enter a valid domain name (e.g., example.com)'
        });
    }
    
    try {
        // Check if domain already owned by another tenant
        const existingOwner = await pool.query(`
            SELECT tenant_id, t.name as tenant_name, ownership_verified_at
            FROM tenant_ses_identities tsi
            JOIN tenants t ON tsi.tenant_id = t.id
            WHERE identity_value = $1 
            AND identity_type = 'domain'
            AND ownership_verified_at IS NOT NULL
        `, [cleanDomain]);
        
        if (existingOwner.rows.length > 0) {
            const owner = existingOwner.rows[0];
            if (owner.tenant_id !== tenantId) {
                return res.status(409).json({ 
                    error: 'Domain already verified by another organization',
                    message: 'This domain has been verified by another account. If you own this domain, please contact support.',
                    domain: cleanDomain
                });
            } else {
                return res.status(200).json({
                    message: 'Domain already verified by your organization',
                    domain: cleanDomain,
                    verifiedAt: owner.ownership_verified_at,
                    alreadyOwned: true
                 });
            }
        }
        
        // Generate unique verification token
        const crypto = require('crypto');
        const verificationToken = crypto.randomUUID();
        const txtRecordName = `_custarea-verify.${cleanDomain}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        // Store verification challenge
        const result = await pool.query(`
            INSERT INTO domain_ownership_verifications (
                tenant_id, domain, verification_token, verification_method,
                verification_status, dns_record_name, dns_record_expected_value, expires_at
            ) VALUES ($1, $2, $3, 'dns_txt', 'pending', $4, $5, $6)
            ON CONFLICT (tenant_id, domain) 
            DO UPDATE SET
                verification_token = EXCLUDED.verification_token,
                dns_record_name = EXCLUDED.dns_record_name,
                dns_record_expected_value = EXCLUDED.dns_record_expected_value,
                expires_at = EXCLUDED.expires_at,
                verification_status = 'pending',
                created_at = now()
            RETURNING *
        `, [tenantId, cleanDomain, verificationToken, txtRecordName, verificationToken, expiresAt]);
        
        res.json({
            domain: cleanDomain,
            verificationMethod: 'dns_txt',
            verificationToken,
            dnsRecord: {
                type: 'TXT',
                name: txtRecordName,
                value: verificationToken,
                ttl: '300 (or default)'
            },
            instructions: [
                `1. Add a TXT record to your DNS configuration:`,
                `   - Name: ${txtRecordName}`,
                `   - Value: ${verificationToken}`,
                `   - TTL: 300 seconds (or leave as default)`,
                `2. Wait for DNS propagation (usually 5-15 minutes)`,
                `3. Click "Verify Ownership" to complete verification`
            ],
            expiresAt
        });
    } catch (err) {
        console.error('Error claiming domain:', err);
        return res.status(500).json({ 
            error: 'Failed to initiate domain claim', 
            details: err.message 
        });
    }
};

// POST /api/email/identities/verify-ownership - Step 2: Verify DNS ownership
exports.verifyDomainOwnership = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { domain } = req.body;
    
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }
    
    const cleanDomain = domain.trim().toLowerCase();
    
    try {
        // Get pending verification
        const verificationRes = await pool.query(`
            SELECT * FROM domain_ownership_verifications
            WHERE tenant_id = $1 
            AND domain = $2 
            AND verification_status = 'pending'
            AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
        `, [tenantId, cleanDomain]);
        
        if (verificationRes.rows.length === 0) {
            return res.status(404).json({ 
                error: 'No active verification found',
                message: 'Verification not found or has expired. Please start the domain claim process again.'
            });
        }
        
        const verification = verificationRes.rows[0];
        
        // Perform DNS TXT lookup
        const dns = require('dns').promises;
        
        try {
            const txtRecords = await dns.resolveTxt(verification.dns_record_name);
            const flatRecords = txtRecords.flat();
            const foundToken = flatRecords.find(record => 
                record.trim() === verification.verification_token
            );
            
            if (!foundToken) {
                // Update attempt count
                await pool.query(`
                    UPDATE domain_ownership_verifications
                    SET verification_attempts = verification_attempts + 1,
                        dns_record_found_value = $1,
                        error_message = $2,
                        updated_at = now()
                    WHERE id = $3
                `, [
                    JSON.stringify(flatRecords),
                    'DNS TXT record not found or value does not match',
                    verification.id
                ]);
                
                return res.status(400).json({ 
                    error: 'Verification failed',
                    message: 'DNS TXT record not found or value does not match. Please ensure the record is correctly added and DNS has propagated.',
                    expected: {
                        name: verification.dns_record_name,
                        value: verification.verification_token
                    },
                    found: flatRecords.length > 0 ? flatRecords : 'No TXT records found',
                    hint: 'DNS propagation can take 5-60 minutes. Try again in a few minutes.'
                });
            }
            
            // SUCCESS - Mark ownership as verified
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Update verification record
                await client.query(`
                    UPDATE domain_ownership_verifications
                    SET verification_status = 'verified',
                        verified_at = now(),
                        dns_record_found_value = $1,
                        updated_at = now()
                    WHERE id = $2
                `, [foundToken, verification.id]);
                
                // Create/update the SES identity with ownership proof
                const identityResult = await client.query(`
                    INSERT INTO tenant_ses_identities (
                        tenant_id, identity_type, identity_value,
                        ownership_verification_token, ownership_verified_at,
                        ownership_verification_method, verification_status,
                        claimed_at
                    ) VALUES ($1, 'domain', $2, $3, now(), 'dns_txt', 'PENDING', now())
                    ON CONFLICT (tenant_id, identity_type, identity_value)
                    DO UPDATE SET
                        ownership_verified_at = now(),
                        ownership_verification_token = EXCLUDED.ownership_verification_token,
                        ownership_verification_method = EXCLUDED.ownership_verification_method
                    RETURNING *
                `, [tenantId, cleanDomain, verification.verification_token]);
                
                await client.query('COMMIT');
                
                res.json({
                    success: true,
                    message: 'Domain ownership verified successfully!',
                    domain: cleanDomain,
                    verifiedAt: new Date(),
                    identity: identityResult.rows[0],
                    nextStep: 'Now you can configure DKIM and SPF records to complete email verification'
                });
                
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
            
        } catch (dnsError) {
            // DNS lookup failed
            await pool.query(`
                UPDATE domain_ownership_verifications
                SET verification_attempts = verification_attempts + 1,
                    error_message = $1,
                    updated_at = now()
                WHERE id = $2
            `, [dnsError.message, verification.id]);
            
            return res.status(400).json({ 
                error: 'DNS lookup failed',
                message: 'Could not resolve DNS records. Please ensure the TXT record is published and DNS has propagated.',
                details: dnsError.message,
                recordName: verification.dns_record_name,
                hint: 'You can test DNS propagation using: nslookup -type=TXT ' + verification.dns_record_name
            });
        }
        
    } catch (err) {
        console.error('Domain ownership verification error:', err);
        return res.status(500).json({ 
            error: 'Verification failed', 
            details: err.message 
        });
    }
};

// POST /api/email/identities/domain - Step 3: Complete SES verification (REQUIRES OWNERSHIP)
exports.createDomainIdentity = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { domain } = req.body;

    if (!domain) {
        return res.status(400).json({ error: "domain is required" });
    }
    
    const cleanDomain = domain.trim().toLowerCase();

    try {
        // CRITICAL: Verify ownership was proven first
        const ownershipCheck = await pool.query(`
            SELECT * FROM tenant_ses_identities
            WHERE tenant_id = $1 
            AND identity_value = $2 
            AND identity_type = 'domain'
            AND ownership_verified_at IS NOT NULL
        `, [tenantId, cleanDomain]);
        
        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({ 
                error: 'Domain ownership not verified',
                message: 'You must verify domain ownership before configuring SES. Use the domain claim workflow first.',
                domain: cleanDomain,
                nextStep: 'Click "Claim Domain" to start the ownership verification process'
            });
        }
        
        // Ownership verified - proceed with SES identity creation
        let sesRes;
        let isExisting = false;
        
        try {
            sesRes = await createDomainIdentity(cleanDomain);
        } catch (sesErr) {
            // Handle AlreadyExistsException - domain already registered in SES
            if (sesErr.name === 'AlreadyExistsException') {
                isExisting = true;
                // Fetch existing identity status instead
                sesRes = await require('../services/sesIdentityService').getIdentity(cleanDomain);
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
            name: `${token}._domainkey.${cleanDomain}`,
            value: `${token}.dkim.amazonses.com`,
        }));

        const spfRecord = {
            type: "TXT",
            name: cleanDomain,
            value: "v=spf1 include:amazonses.com -all",
        };

        const client = await pool.connect();
        try {
            const insertRes = await client.query(
                `UPDATE tenant_ses_identities 
                 SET verification_status = $1,
                     dkim_status = $2,
                     dkim_tokens = $3,
                     spf_instructions = $4,
                     last_checked_at = now()
                 WHERE tenant_id = $5 AND identity_value = $6 AND identity_type = 'domain'
                 RETURNING *`,
                [
                    verificationStatus,
                    dkimStatus,
                    JSON.stringify(dkimTokens),
                    spfRecord.value,
                    tenantId,
                    cleanDomain
                ]
            );

            return res.json({
                identity: insertRes.rows[0],
                dnsRecords: {
                    dkim: dkimRecords,
                    spf: spfRecord,
                },
                existing: isExisting,
                message: isExisting ? "Domain already exists in SES, fetched current status" : "Domain identity created in SES"
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

        // Log to messages table (sendTenantEmail no longer logs)
        await logSentEmail({
            tenantId,
            from: result.effectiveFromEmail || fromEmail,
            to,
            subject,
            html,
            text,
            provider: 'ses',
            providerMessageId: result.sesMessageId
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
            `SELECT m.*, mem.to_addresses, mem.from_address, mem.subject 
             FROM messages m
             LEFT JOIN message_email_metadata mem ON m.id = mem.message_id
             WHERE m.tenant_id = $1 
             AND m.channel = 'email' 
             AND m.direction = 'outbound'
             ORDER BY m.created_at DESC LIMIT $2`,
            [tenantId, parseInt(limit)]
        );

        const mappedEmails = result.rows.map(row => {
            // Map to_addresses JSON to string
            let toEmail = '';
            if (row.to_addresses && Array.isArray(row.to_addresses)) {
                toEmail = row.to_addresses.map(a => a.email).join(', ');
            }

            return {
                id: row.id,
                tenant_id: row.tenant_id,
                to_email: toEmail,
                from_email: row.from_address,
                subject: row.subject,
                body_html: row.content_html,
                body_text: row.content_text,
                status: row.status,
                provider_type: row.provider,
                connection_id: row.metadata?.connectionId,
                provider_message_id: row.provider_message_id,
                sent_at: row.sent_at,
                created_at: row.created_at
            };
        });

        res.json({ emails: mappedEmails });
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
