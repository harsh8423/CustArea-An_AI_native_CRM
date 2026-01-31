/**
 * Bulk Phone Call Controller
 * 
 * API endpoints for managing bulk phone call jobs
 */

const { pool } = require('../../config/db');
const phoneCallQueue = require('../workers/phoneCallQueue');

/**
 * POST /api/phone/bulk-call
 * Start a new bulk calling job
 */
exports.startBulkCall = async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { groupId, callerPhoneNumber, callMode = 'ai', customInstruction } = req.body;

    try {
        // Validate inputs
        if (!groupId) {
            return res.status(400).json({ error: 'Group ID is required' });
        }

        if (!callerPhoneNumber) {
            return res.status(400).json({ error: 'Caller phone number is required' });
        }

        // Get group information
        const groupResult = await pool.query(
            'SELECT name FROM contact_groups WHERE id = $1 AND tenant_id = $2',
            [groupId, tenantId]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const group = groupResult.rows[0];

        // Get count of contacts with phone numbers
        const contactsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM contacts c
            INNER JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
            WHERE cgm.group_id = $1
              AND c.tenant_id = $2
              AND c.phone IS NOT NULL
              AND c.phone != ''
        `, [groupId, tenantId]);

        const contactCount = parseInt(contactsResult.rows[0].count);

        if (contactCount === 0) {
            return res.status(400).json({ 
                error: 'No contacts with valid phone numbers found in this group' 
            });
        }

        // Calculate estimated cost and duration
        const avgCallDuration = 180; // 3 minutes
        const costPerMinute = 0.013; // Twilio avg cost
        const estimatedDuration = (contactCount * avgCallDuration) / 60; // in minutes
        const estimatedCost = estimatedDuration * costPerMinute;

        // Create job in database
        const jobResult = await pool.query(`
            INSERT INTO bulk_phone_call_jobs (
                tenant_id,
                created_by,
                group_id,
                group_name,
                caller_phone_number,
                call_mode,
                custom_instruction,
                status,
                total_recipients
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            RETURNING *
        `, [
            tenantId,
            userId,
            groupId,
            group.name,
            callerPhoneNumber,
            callMode,
            customInstruction,
            contactCount
        ]);

        const job = jobResult.rows[0];

        // Add job to queue
        await phoneCallQueue.add({
            jobId: job.id,
            tenantId,
            groupId,
            groupName: group.name,
            callerPhoneNumber,
            callMode,
            customInstruction
        }, {
            jobId: job.id, // Use DB job ID as Bull job ID for easy tracking
        });

        console.log(`📞 [BulkCallController] Created bulk call job ${job.id} for ${contactCount} contacts`);

        res.json({
            message: 'Bulk call job created successfully',
            job: {
                id: job.id,
                groupName: group.name,
                totalRecipients: contactCount,
                estimatedDuration: `${Math.ceil(estimatedDuration)} minutes`,
                estimatedCost: `$${estimatedCost.toFixed(2)}`,
                status: 'pending'
            }
        });

    } catch (err) {
        console.error('Start bulk call error:', err);
        res.status(500).json({
            error: 'Failed to start bulk call',
            details: err.message
        });
    }
};

/**
 * GET /api/phone/bulk-jobs/:jobId
 * Get job status and progress
 */
exports.getJobStatus = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;

    try {
        const result = await pool.query(`
            SELECT *
            FROM bulk_phone_call_jobs
            WHERE id = $1 AND tenant_id = $2
        `, [jobId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error('Get job status error:', err);
        res.status(500).json({
            error: 'Failed to fetch job status',
            details: err.message
        });
    }
};

/**
 * GET /api/phone/bulk-jobs
 * List all bulk call jobs
 */
exports.listJobs = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { limit = 50, offset = 0, status } = req.query;

    try {
        let query = `
            SELECT 
                id,
                group_name,
                caller_phone_number,
                call_mode,
                status,
                total_recipients,
                calls_completed,
                calls_failed,
                calls_in_progress,
                progress_percent,
                current_contact_id,
                current_contact_name,
                current_contact_phone,
                call_records,
                failed_calls,
                created_at,
                started_at,
                completed_at,
                estimated_completion_at,
                total_call_duration_seconds,
                average_call_duration_seconds
            FROM bulk_phone_call_jobs
            WHERE tenant_id = $1
        `;
        
        const params = [tenantId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC`;
        
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM bulk_phone_call_jobs
            WHERE tenant_id = $1
        `;
        const countParams = [tenantId];

        if (status) {
            countQuery += ` AND status = $2`;
            countParams.push(status);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            jobs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (err) {
        console.error('List jobs error:', err);
        res.status(500).json({
            error: 'Failed to fetch jobs',
            details: err.message
        });
    }
};

/**
 * POST /api/phone/bulk-jobs/:jobId/pause
 * Pause an ongoing job
 */
exports.pauseJob = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;

    try {
        // Update job status to paused
        const result = await pool.query(`
            UPDATE bulk_phone_call_jobs
            SET status = 'paused', paused_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2 AND status = 'processing'
            RETURNING *
        `, [jobId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Job not found or not in processing state' 
            });
        }

        console.log(`⏸️ [BulkCallController] Job ${jobId} paused`);

        res.json({
            message: 'Job paused successfully',
            job: result.rows[0]
        });

    } catch (err) {
        console.error('Pause job error:', err);
        res.status(500).json({
            error: 'Failed to pause job',
            details: err.message
        });
    }
};

/**
 * POST /api/phone/bulk-jobs/:jobId/resume
 * Resume a paused job
 */
exports.resumeJob = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;

    try {
        // Update job status to processing
        const result = await pool.query(`
            UPDATE bulk_phone_call_jobs
            SET status = 'processing', paused_at = NULL, updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2 AND status = 'paused'
            RETURNING *
        `, [jobId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Job not found or not in paused state' 
            });
        }

        console.log(`▶️ [BulkCallController] Job ${jobId} resumed`);

        res.json({
            message: 'Job resumed successfully',
            job: result.rows[0]
        });

    } catch (err) {
        console.error('Resume job error:', err);
        res.status(500).json({
            error: 'Failed to resume job',
            details: err.message
        });
    }
};

/**
 * DELETE /api/phone/bulk-jobs/:jobId
 * Cancel a job
 */
exports.cancelJob = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { jobId } = req.params;

    try {
        // Update job status to cancelled
        const result = await pool.query(`
            UPDATE bulk_phone_call_jobs
            SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'processing', 'paused')
            RETURNING *
        `, [jobId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Job not found or already completed/failed' 
            });
        }

        console.log(`❌ [BulkCallController] Job ${jobId} cancelled`);

        res.json({
            message: 'Job cancelled successfully',
            job: result.rows[0]
        });

    } catch (err) {
        console.error('Cancel job error:', err);
        res.status(500).json({
            error: 'Failed to cancel job',
            details: err.message
        });
    }
};

module.exports = {
    startBulkCall: exports.startBulkCall,
    getJobStatus: exports.getJobStatus,
    listJobs: exports.listJobs,
    pauseJob: exports.pauseJob,
    resumeJob: exports.resumeJob,
    cancelJob: exports.cancelJob
};
