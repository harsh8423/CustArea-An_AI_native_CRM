/**
 * Bulk Email Job Processor
 * 
 * Processes bulk email jobs from the queue:
 * 1. Fetches contacts from group
 * 2. Sends emails one-by-one with rate limiting
 * 3. Updates job progress in real-time
 * 4. Handles errors and retries gracefully
 */

const { pool } = require('../../config/db');
const EmailProviderFactory = require('../services/emailProviderFactory');

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
        console.log('tenant_allowed_from_emails table not found');
    }
    
    throw new Error(`No verified sender found for ${email}`);
}

// Rate limits per provider (milliseconds between sends)
const RATE_LIMITS = {
    ses: { delay: 100, dailyLimit: 50000 },
    gmail: { delay: 2000, dailyLimit: 500 },
    outlook: { delay: 1000, dailyLimit: 500 }
};

/**
 * Main job processor function
 * @param {Object} job - Bull job object
 * @param {string} job.data.jobId - Database job ID
 * @param {string} job.data.tenantId - Tenant ID
 * @param {string} job.data.groupId - Contact group ID
 * @param {string} job.data.groupName - Contact group name
 * @param {string} job.data.fromEmail - Sender email
 * @param {string} job.data.subject - Email subject
 * @param {string} job.data.bodyHtml - Email HTML body
 * @param {string} job.data.bodyText - Email text body
 * @param {number} job.data.delayMs - Delay between emails
 */
async function processJob(job) {
    const { jobId, tenantId, groupId, groupName, fromEmail, subject, bodyHtml, bodyText, delayMs } = job.data;
    
    console.log(`🚀 [JobProcessor] Starting job ${jobId} for ${groupName}`);
    
    try {
        // 1. Mark job as processing
        await updateJobStatus(jobId, 'processing', { started_at: new Date() });
        
        // 2. Fetch contacts from group
        const contacts = await fetchGroupContacts(groupId, tenantId);
        
        if (contacts.length === 0) {
            throw new Error('No contacts found in group');
        }
        
        console.log(`📧 [JobProcessor] Found ${contacts.length} contacts with emails`);
        
        // 3. Update total recipients
        await updateJobProgress(jobId, {
            total_recipients: contacts.length
        });
        
        // 4. Detect provider for this sender email
        const providerInfo = await detectProviderFromEmail(fromEmail, tenantId);
        const providerType = providerInfo.type;
        
        // 5. Get rate limit for this provider
        const rateLimit = RATE_LIMITS[providerType] || RATE_LIMITS.ses;
        const delay = delayMs || rateLimit.delay;
        
        console.log(`📤 [JobProcessor] Using ${providerType} provider with ${delay}ms delay`);
        
        // 6. Update provider type in job
        await updateJobProgress(jobId, { provider_type: providerType });
        
        // 7. Send emails one by one
        const results = {
            sent: 0,
            failed: 0,
            failedEmails: []
        };
        
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Update progress
            await updateJobProgress(jobId, {
                current_email: contact.email,
                emails_sent: results.sent,
                emails_failed: results.failed,
                progress_percent: Math.floor((i / contacts.length) * 100)
            });
            
            try {
                // Send email
                const result = await sendEmailWithRetry({
                    from: fromEmail,
                    to: contact.email,
                    subject,
                    html: bodyHtml,
                    text: bodyText || bodyHtml,
                    contactName: contact.name
                }, providerInfo, tenantId);
                
                results.sent++;
                
                // --- ANALYTICS LOGGING START ---
                // Log to messages table to trigger analytics (counts as Human/Agent)
                try {
                    await logBulkEmailToHistory(
                        pool, 
                        tenantId, 
                        contact.id, 
                        subject, 
                        bodyText || bodyHtml, 
                        bodyHtml,
                        result.messageId || result.providerMessageId,
                        providerType,
                        jobId
                    );
                } catch (logErr) {
                    console.error(`⚠️ [JobProcessor] Failed to log email to history for ${contact.email}:`, logErr.message);
                    // Don't fail the job, just log the error
                }
                // --- ANALYTICS LOGGING END ---

                console.log(`✅ [JobProcessor] Sent ${i + 1}/${contacts.length} to ${contact.email}`);
                
            } catch (error) {
                results.failed++;
                results.failedEmails.push({
                    email: contact.email,
                    name: contact.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                console.error(`❌ [JobProcessor] Failed to send to ${contact.email}:`, error.message);
            }
            
            // Rate limiting: wait before next send (except for last email)
            if (i < contacts.length - 1) {
                await sleep(delay);
            }
        }
        
        // 8. Mark job as completed
        await updateJobStatus(jobId, 'completed', {
            completed_at: new Date(),
            emails_sent: results.sent,
            emails_failed: results.failed,
            failed_emails: results.failedEmails,
            progress_percent: 100,
            current_email: null
        });
        
        console.log(`🎉 [JobProcessor] Job ${jobId} completed: ${results.sent} sent, ${results.failed} failed`);
        
        return results;
        
    } catch (error) {
        console.error(`💥 [JobProcessor] Job ${jobId} failed:`, error);
        
        // Mark job as failed
        await updateJobStatus(jobId, 'failed', {
            completed_at: new Date(),
            error_message: error.message
        });
        
        throw error; // Re-throw for Bull retry logic
    }
}

/**
 * Fetch contacts with emails from a group
 */
async function fetchGroupContacts(groupId, tenantId) {
    const query = `
        SELECT DISTINCT c.id, c.name, c.email
        FROM contacts c
        INNER JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
        WHERE cgm.group_id = $1
          AND c.tenant_id = $2
          AND c.email IS NOT NULL
          AND c.email != ''
        ORDER BY c.name
    `;
    
    const result = await pool.query(query, [groupId, tenantId]);
    return result.rows;
}

/**
 * Send email with retry logic
 */
async function sendEmailWithRetry(emailData, providerInfo, tenantId, retries = 2) {
    const { from, to, subject, html, text, contactName } = emailData;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Get provider instance
            let providerInstance;
            
            if (providerInfo.type === 'gmail' || providerInfo.type === 'outlook') {
                providerInstance = await EmailProviderFactory.getProviderByConnectionId(
                    providerInfo.connectionId
                );
            } else if (providerInfo.type === 'ses') {
                const sesProvider = require('../services/sesProvider');
                providerInstance = new sesProvider({ 
                    identityId: providerInfo.identityId,
                    tenant_id: tenantId
                });
            }
            
            // Send email
            const result = await providerInstance.sendEmail({
                from,
                to,
                subject,
                html,
                text
            });
            
            return result;
            
        } catch (error) {
            if (attempt === retries) {
                throw error; // Final attempt failed
            }
            
            console.warn(`⚠️  [JobProcessor] Retry ${attempt + 1}/${retries} for ${to}: ${error.message}`);
            await sleep(1000 * (attempt + 1)); // Exponential backoff: 1s, 2s
        }
    }
}

/**
 * Update job status in database
 */
async function updateJobStatus(jobId, status, additionalFields = {}) {
    const fields = { status, ...additionalFields };
    const setClause = Object.keys(fields)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    
    const values = [jobId, ...Object.values(fields)];
    
    const query = `
        UPDATE bulk_email_jobs
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
    `;
    
    await pool.query(query, values);
}

/**
 * Update job progress fields
 */
async function updateJobProgress(jobId, fields) {
    const setClause = Object.keys(fields)
        .map((key, idx) => {
            // Handle JSONB fields
            if (key === 'failed_emails') {
                return `${key} = $${idx + 2}::jsonb`;
            }
            return `${key} = $${idx + 2}`;
        })
        .join(', ');
    
    const values = [
        jobId,
        ...Object.values(fields).map(v => 
            typeof v === 'object' && v !== null ? JSON.stringify(v) : v
        )
    ];
    
    const query = `
        UPDATE bulk_email_jobs
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
    `;
    
    await pool.query(query, values);
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper: Log bulk email to history (conversations & messages)
 * Triggers analytics via database triggers
 */
async function logBulkEmailToHistory(pool, tenantId, contactId, subject, text, html, messageId, provider, jobId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create Conversation (treat each bulk blast as a new conversation context for now)
        // We link it to the bulk job via metadata
        const convResult = await client.query(`
            INSERT INTO conversations (
                tenant_id, contact_id, channel, status, subject, 
                metadata, created_at, updated_at
            ) VALUES ($1, $2, 'email', 'open', $3, $4, NOW(), NOW())
            RETURNING id
        `, [
            tenantId, 
            contactId, 
            subject,
            JSON.stringify({ source: 'bulk_email', jobId: jobId })
        ]);
        
        const conversationId = convResult.rows[0].id;

        // 2. Insert Message
        // role='agent' ensures it is counted as human sent by the analytics trigger
        await client.query(`
            INSERT INTO messages (
                tenant_id, conversation_id, direction, role, channel,
                content_text, content_html, provider, provider_message_id, 
                status, sent_at, created_at
            ) VALUES ($1, $2, 'outbound', 'agent', 'email', $3, $4, $5, $6, 'sent', NOW(), NOW())
        `, [
            tenantId,
            conversationId,
            text,
            html,
            provider,
            messageId || `bulk-${Date.now()}` // Fallback ID if provider doesn't return one
        ]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    processJob,
    fetchGroupContacts,
    sendEmailWithRetry,
    updateJobProgress,
    updateJobStatus
};
