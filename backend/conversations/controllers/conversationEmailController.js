const { pool } = require('../../config/db');

/**
 * GET /api/email/sender-addresses
 * Get all available sender email addresses for the tenant
 */
exports.getSenderAddresses = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const senderAddresses = [];

        // 1. Get Gmail connections
        const gmailResult = await pool.query(`
            SELECT id, email_address, display_name, is_default
            FROM tenant_email_connections
            WHERE tenant_id = $1::uuid 
            AND provider_type = 'gmail'
            AND is_active = true
            ORDER BY is_default DESC, email_address
        `, [tenantId]);

        gmailResult.rows.forEach(row => {
            senderAddresses.push({
                email: row.email_address,
                provider: 'gmail',
                displayName: row.display_name || `${row.email_address} (Gmail)`,
                connectionId: row.id,
                isDefault: row.is_default
            });
        });

        // 2. Get Outlook connections
        const outlookResult = await pool.query(`
            SELECT id, email_address, display_name, is_default
           FROM tenant_email_connections
            WHERE tenant_id = $1::uuid 
            AND provider_type = 'outlook'
            AND is_active = true
            ORDER BY is_default DESC, email_address
        `, [tenantId]);

        outlookResult.rows.forEach(row => {
            senderAddresses.push({
                email: row.email_address,
                provider: 'outlook',
                displayName: row.display_name || `${row.email_address} (Outlook)`,
                connectionId: row.id,
                isDefault: row.is_default
            });
        });

        // 3. Get SES verified identities (if table exists)
        try {
            const sesResult = await pool.query(`
                SELECT id, email, domain, verification_status
                FROM email_identities
                WHERE tenant_id = $1::uuid
                AND verification_status = 'verified'
                ORDER BY created_at DESC
            `, [tenantId]);

            sesResult.rows.forEach(row => {
                if (row.email) {
                    senderAddresses.push({
                        email: row.email,
                        provider: 'ses',
                        displayName: `${row.email} (Custom Domain)`,
                        identityId: row.id,
                        isDefault: false
                    });
                }
            });
        } catch (sesErr) {
            // Table doesn't exist yet - skip SES addresses
            console.log('SES email_identities table not found, skipping...');
        }

        // 4. Get allowed sender emails from tenant_allowed_from_emails (new migration 003 table)
        try {
            const allowedEmailsResult = await pool.query(`
                SELECT 
                    tafe.email_address, 
                    tafe.is_default,
                    tsi.id as identity_id,
                    tsi.identity_value
                FROM tenant_allowed_from_emails tafe
                JOIN tenant_ses_identities tsi ON tafe.ses_identity_id = tsi.id
                WHERE tafe.tenant_id = $1::uuid
                AND tsi.verification_status = 'SUCCESS'
                ORDER BY tafe.is_default DESC, tafe.created_at DESC
            `, [tenantId]);

            allowedEmailsResult.rows.forEach(row => {
                // Avoid duplicates
                if (!senderAddresses.find(addr => addr.email === row.email_address)) {
                    senderAddresses.push({
                        email: row.email_address,
                        provider: 'ses',
                        displayName: `${row.email_address} (SES)`,
                        identityId: row.identity_id,
                        isDefault: row.is_default || false
                    });
                }
            });
        } catch (allowedEmailsErr) {
            // Table doesn't exist yet - skip
            console.log('tenant_allowed_from_emails table not found, skipping...');
        }

        // 4. Sort by is_default
        senderAddresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

        res.json({ senderAddresses });
    } catch (err) {
        console.error('Get sender addresses error:', err);
        res.status(500).json({ 
            error: 'Failed to fetch sender addresses',
            details: err.message 
        });
    }
};

/**
 * POST /api/email/send-conversation
 * Send email from conversation inbox with smart provider routing
 */
exports.sendConversationEmail = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { 
        to, 
        subject, 
        body,
        from,           // Sender email address
        cc,
        bcc,
        conversationId,
        replyToMessageId
    } = req.body;

    if (!to || !subject || !body || !from) {
        console.log('❌ Missing required fields:', { to: !!to, from: !!from, subject: !!subject, body: !!body });
        return res.status(400).json({ 
            error: 'to, from, subject, and body are required' 
        });
    }

    console.log('📧 Sending conversation email with params:', {
        from,
        to,
        subject,
        bodyLength: body?.length || 0,
        cc,
        bcc,
        conversationId
    });

    try {
        const EmailProviderFactory = require('../../email/services/emailProviderFactory');
        
        // 1. Detect provider from sender email
        const provider = await detectProviderFromEmail(from, tenantId);
        
        // 2. Get provider instance
        let providerInstance;
        if (provider.type === 'gmail' || provider.type === 'outlook') {
            providerInstance = await EmailProviderFactory.getProviderByConnectionId(
                provider.connectionId
            );
        } else if (provider.type === 'ses') {
            const sesProvider = require('../../email/services/sesProvider');
            providerInstance = new sesProvider({ 
                identityId: provider.identityId,
                tenant_id: tenantId  // Add tenant_id so SES can log to outbound_emails
            });
        }
        
        // 3. Send email
        const emailParams = {
            from,
            to,
            subject,
            html: body,
            text: body,
            cc,
            bcc
        };
        
        console.log('📤 Sending email with params:', {
            from: emailParams.from,
            to: emailParams.to,
            subject: emailParams.subject,
            htmlLength: emailParams.html?.length || 0,
            textLength: emailParams.text?.length || 0
        });
        
        const result = await providerInstance.sendEmail(emailParams);

        // 4. Link contact and conversation (NO auto-create)
        let finalConversationId = conversationId;
        
        if (!finalConversationId) {
            // OUTBOUND EMAIL: Lookup contact but don't auto-create
            const { findContact } = require('../../services/contactResolver');
            
            console.log('🔍 Looking up contact for email:', to, 'tenant:', tenantId);
            
            // Try to find existing contact
            const contact = await findContact(tenantId, { email: to });
            
            console.log('🔍 Contact lookup result:', contact ? `Found: ${contact.id}` : 'NOT FOUND');
            
            if (contact) {
                console.log('✅ Found existing contact:', contact.id, 'email:', contact.email, 'name:', contact.name);
                // Find or create conversation with contact
                finalConversationId = await findOrCreateConversation(tenantId, contact.id, subject, to);
            } else {
                console.log('❌ NO CONTACT FOUND for:', to);
                console.log('📧 Creating conversation WITHOUT contact (NULL contact_id)');
                // Create conversation WITHOUT contact (NULL contact_id)
                const contactName = extractNameFromEmail(to);
                const convResult = await pool.query(
                    `INSERT INTO conversations (
                        tenant_id, contact_id, channel, channel_contact_id, subject, status,
                        sender_display_name, sender_identifier_type, sender_identifier_value
                    ) VALUES ($1, NULL, 'email', $2, $3, 'open', $4, 'email', $5)
                    RETURNING id`,
                    [tenantId, to, subject, contactName, to]
                );
                finalConversationId = convResult.rows[0].id;
            }
        }

        // 5. Create message record in conversation
        await createConversationMessage(finalConversationId, {
            direction: 'outbound',
            role: 'agent',
            content_text: body,
            content_html: body,
            provider: provider.type,
            provider_message_id: result.messageId,
            reply_to_message_id: replyToMessageId,
            metadata: { 
                subject,
                from,
                to,
                cc,
                bcc
            }
        }, tenantId);

        res.json({ 
            success: true, 
            messageId: result.messageId,
            provider: provider.type,
            conversationId: finalConversationId  // Return the conversation ID
        });
    } catch (err) {
        console.error('Send conversation email error:', err);
        res.status(500).json({ 
            error: 'Failed to send email',
            details: err.message 
        });
    }
};

/**
 * Helper: Extract name from email address
 * john.doe@example.com -> John Doe
 */
function extractNameFromEmail(email) {
    const localPart = email.split('@')[0];
    // Replace dots, underscores, hyphens with spaces
    const cleaned = localPart.replace(/[._-]/g, ' ');
    // Capitalize each word
    return cleaned.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Helper: Extract name from email address
 * Moved from findOrCreateContactByEmail - now uses centralized contactResolver
 */

/**
 * Helper: Find or create conversation for email thread
 * Creates new conversation per subject/thread
 */
async function findOrCreateConversation(tenantId, contactId, subject, recipientEmail) {
    const normalizedSubject = subject?.trim() || '(No Subject)';
    
    // 1. Try to find existing conversation with same contact + subject
    const existingConv = await pool.query(`
        SELECT id 
        FROM conversations
        WHERE tenant_id = $1::uuid 
        AND contact_id = $2::uuid
        AND channel = 'email'
        AND subject = $3
        AND status != 'closed'
        ORDER BY created_at DESC
        LIMIT 1
    `, [tenantId, contactId, normalizedSubject]);
    
    
    if (existingConv.rows.length > 0) {
        console.log('✅ Found existing conversation for subject:', normalizedSubject);
        // Clear sender fields if they exist (conversation might have been created before contact was linked)
        await pool.query(`
            UPDATE conversations 
            SET sender_display_name = NULL,
                sender_identifier_type = NULL,
                sender_identifier_value = NULL,
                updated_at = now()
            WHERE id = $1 AND (sender_display_name IS NOT NULL OR sender_identifier_type IS NOT NULL)
        `, [existingConv.rows[0].id]);
        return existingConv.rows[0].id;
    }
    
    
    // 2. Create new conversation WITH known contact (sender fields = NULL)
    const newConv = await pool.query(`
        INSERT INTO conversations (
            tenant_id, contact_id, channel, channel_contact_id, 
            subject, status, ai_enabled, priority,
            sender_display_name, sender_identifier_type, sender_identifier_value
        ) VALUES (
            $1::uuid, $2::uuid, 'email', $3, 
            $4, 'open', true, 'normal',
            NULL, NULL, NULL
        ) RETURNING id
    `, [tenantId, contactId, recipientEmail.toLowerCase(), normalizedSubject]);
    
    console.log('✨ Created new conversation for known contact:', recipientEmail, 'subject:', normalizedSubject);
    return newConv.rows[0].id;
}

/**
 * Helper: Detect email provider from sender address
 */
async function detectProviderFromEmail(email, tenantId) {
    // 1. Check Gmail connections
    const gmailConn = await pool.query(`
        SELECT id FROM tenant_email_connections
        WHERE tenant_id = $1::uuid 
        AND provider_type = 'gmail'
        AND email_address = $2
        AND is_active = true
    `, [tenantId, email]);
    
    if (gmailConn.rows.length > 0) {
        return { type: 'gmail', connectionId: gmailConn.rows[0].id };
    }
    
    // 2. Check Outlook connections
    const outlookConn = await pool.query(`
        SELECT id FROM tenant_email_connections
        WHERE tenant_id = $1::uuid 
        AND provider_type = 'outlook'
        AND email_address = $2
        AND is_active = true
    `, [tenantId, email]);
    
    if (outlookConn.rows.length > 0) {
        return { type: 'outlook', connectionId: outlookConn.rows[0].id };
    }
    
    // 3. Check SES identities (legacy table)
    try {
        const sesIdentity = await pool.query(`
            SELECT id FROM email_identities
            WHERE tenant_id = $1::uuid
            AND email = $2
            AND verification_status = 'verified'
        `, [tenantId, email]);
        
        if (sesIdentity.rows.length > 0) {
            return { type: 'ses', identityId: sesIdentity.rows[0].id };
        }
    } catch (err) {
        // email_identities table doesn't exist - try newer tables
        console.log('email_identities table not found, checking tenant_allowed_from_emails...');
    }
    
    // 4. Check tenant_allowed_from_emails (new migration 003)
    try {
        const allowedEmail = await pool.query(`
            SELECT tsi.id as identity_id
            FROM tenant_allowed_from_emails tafe
            JOIN tenant_ses_identities tsi ON tafe.ses_identity_id = tsi.id
            WHERE tafe.tenant_id = $1::uuid
            AND tafe.email_address = $2
            AND tsi.verification_status = 'SUCCESS'
        `, [tenantId, email]);
        
        if (allowedEmail.rows.length > 0) {
            return { type: 'ses', identityId: allowedEmail.rows[0].identity_id };
        }
    } catch (err) {
        // tenant_allowed_from_emails table doesn't exist - that's okay
        console.log('tenant_allowed_from_emails table not found');
    }
    
    throw new Error(`No verified sender found for ${email}`);
}

/**
 * Helper: Create message in conversation
 */
async function createConversationMessage(conversationId, messageData, tenantId) {
    const result = await pool.query(`
        INSERT INTO messages (
            tenant_id, conversation_id, direction, role, channel,
            content_text, content_html, provider, provider_message_id,
            reply_to_message_id, status, metadata, created_at
        ) VALUES (
            $1::uuid, $2::uuid, $3, $4, 'email',
            $5, $6, $7, $8,
            $9, 'sent', $10, now()
        ) RETURNING id
    `, [
        tenantId,
        conversationId,
        messageData.direction,
        messageData.role,
        messageData.content_text,
        messageData.content_html,
        messageData.provider,
        messageData.provider_message_id,
        messageData.reply_to_message_id || null,
        JSON.stringify(messageData.metadata)
    ]);

    // Create email metadata
    if (messageData.metadata) {
        await pool.query(`
            INSERT INTO message_email_metadata (
                message_id, from_address, to_addresses
            ) VALUES ($1::uuid, $2, $3)
        `, [
            result.rows[0].id,
            messageData.metadata.from,
            JSON.stringify([{ email: messageData.metadata.to }])
        ]);
    }

    return result.rows[0].id;
}

module.exports = {
    getSenderAddresses: exports.getSenderAddresses,
    sendConversationEmail: exports.sendConversationEmail
};
