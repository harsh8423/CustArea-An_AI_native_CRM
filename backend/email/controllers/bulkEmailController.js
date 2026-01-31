/**
 * Bulk Email Controller
 * 
 * Handles API endpoints for bulk email sending to contact groups
 * - Create bulk email jobs
 * - Get job status and progress
 * - List user's jobs
 * - Cancel running jobs
 */

const { pool } = require('../../config/db');
const bulkEmailQueue = require('../workers/emailQueue');

/**
 * POST /api/email/send-bulk
 * Create a new bulk email job
 */
exports.sendBulk = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { groupId, from, subject, body, bodyText } = req.body;
    
    // Validation
    if (!groupId || !from || !subject || !body) {
        return res.status(400).json({
            error: 'groupId, from, subject, and body are required'
        });
    }
    
    try {
        // 1. Verify group belongs to tenant
        const groupResult = await pool.query(
            'SELECT id, name FROM contact_groups WHERE id = $1 AND tenant_id = $2',
            [groupId, tenantId]
        );
        
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const groupName = groupResult.rows[0].name;
        
        // 2. Get count of contacts with emails in group
        const countResult = await pool.query(`
            SELECT COUNT(DISTINCT c.id) as count
            FROM contacts c
            INNER JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
            WHERE cgm.group_id = $1
              AND c.tenant_id = $2
              AND c.email IS NOT NULL
              AND c.email != ''
        `, [groupId, tenantId]);
        
        const recipientCount = parseInt(countResult.rows[0].count);
        
        if (recipientCount === 0) {
            return res.status(400).json({ 
                error: 'No contacts with email addresses found in this group' 
            });
        }
        
        // 3. Create job record in database
        const jobResult = await pool.query(`
            INSERT INTO bulk_email_jobs (
                tenant_id, created_by, group_id, group_name,
                from_email, subject, body_html, body_text,
                status, total_recipients
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', $9)
            RETURNING id, created_at
        `, [
            tenantId, userId, groupId, groupName,
            from, subject, body, bodyText || body,
            recipientCount
        ]);
        
        const jobId = jobResult.rows[0].id;
        
        // 4. Add job to Bull queue
        await bulkEmailQueue.add({
            jobId,
            tenantId,
            groupId,
            groupName,
            fromEmail: from,
            subject,
            bodyHtml: body,
            bodyText: bodyText || body,
            delayMs: 500 // Default delay
        }, {
            jobId: jobId, // Use DB job ID as Bull job ID for tracking
            priority: 1   // Normal priority
        });
        
        console.log(`✅ [BulkEmail] Created job ${jobId} for group "${groupName}" (${recipientCount} recipients)`);
        
        res.json({
            success: true,
            jobId,
            status: 'queued',
            totalRecipients: recipientCount,
            groupName,
            estimatedDuration: Math.ceil(recipientCount * 0.5), // seconds
            message: `Bulk email job created. Sending to ${recipientCount} contacts.`
        });
        
    } catch (error) {
        console.error('❌ [BulkEmail] Error creating bulk job:', error);
        res.status(500).json({ 
            error: 'Failed to create bulk email job',
            details: error.message
        });
    }
};

/**
 * GET /api/email/bulk-jobs/:jobId
 * Get status and progress of a specific job
 */
exports.getJobStatus = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                id, group_name, from_email, subject,
                status, total_recipients, emails_sent, emails_failed,
                progress_percent, current_email, provider_type,
                error_message, failed_emails,
                started_at, completed_at, created_at
            FROM bulk_email_jobs
            WHERE id = $1 AND tenant_id = $2
        `, [jobId, tenantId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        const job = result.rows[0];
        
        // Calculate estimated time remaining
        let estimatedSecondsRemaining = null;
        if (job.status === 'processing' && job.started_at) {
            const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
            const emailsRemaining = job.total_recipients - job.emails_sent;
            const averageTimePerEmail = elapsed / (job.emails_sent || 1);
            estimatedSecondsRemaining = Math.ceil(emailsRemaining * averageTimePerEmail);
        }
        
        res.json({
            ...job,
            estimatedSecondsRemaining
        });
        
    } catch (error) {
        console.error('❌ [BulkEmail] Error getting job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
};

/**
 * GET /api/email/bulk-jobs
 * List all jobs for the current user/tenant
 */
exports.listJobs = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { limit = 20, offset = 0, status } = req.query;
    
    try {
        let query = `
            SELECT 
                id, group_name, from_email, subject,
                status, total_recipients, emails_sent, emails_failed,
                progress_percent, created_at, started_at, completed_at
            FROM bulk_email_jobs
            WHERE tenant_id = $1
        `;
        
        const params = [tenantId];
        
        // Filter by status if provided
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await pool.query(query, params);
        
        // Get total count
        const countQuery = status
            ? 'SELECT COUNT(*) FROM bulk_email_jobs WHERE tenant_id = $1 AND status = $2'
            : 'SELECT COUNT(*) FROM bulk_email_jobs WHERE tenant_id = $1';
        const countParams = status ? [tenantId, status] : [tenantId];
        const countResult = await pool.query(countQuery, countParams);
        
        res.json({
            jobs: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('❌ [BulkEmail] Error listing jobs:', error);
        res.status(500).json({ error: 'Failed to list jobs' });
    }
};

/**
 * DELETE /api/email/bulk-jobs/:jobId
 * Cancel a running job
 */
exports.cancelJob = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;
    
    try {
        // Check if job exists and belongs to tenant
        const checkResult = await pool.query(
            'SELECT status FROM bulk_email_jobs WHERE id = $1 AND tenant_id = $2',
            [jobId, tenantId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        const currentStatus = checkResult.rows[0].status;
        
        if (currentStatus === 'completed' || currentStatus === 'cancelled') {
            return res.status(400).json({ 
                error: `Job is already ${currentStatus}` 
            });
        }
        
        // Remove job from Bull queue
        const bullJob = await bulkEmailQueue.getJob(jobId);
        if (bullJob) {
            await bullJob.remove();
        }
        
        // Update status in database
        await pool.query(`
            UPDATE bulk_email_jobs
            SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [jobId]);
        
        console.log(`🚫 [BulkEmail] Job ${jobId} cancelled`);
        
        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
        
    } catch (error) {
        console.error('❌ [BulkEmail] Error cancelling job:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
};

module.exports = {
    sendBulk: exports.sendBulk,
    getJobStatus: exports.getJobStatus,
    listJobs: exports.listJobs,
    cancelJob: exports.cancelJob
};
