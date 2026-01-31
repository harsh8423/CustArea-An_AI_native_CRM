/**
 * Email History Controller
 * 
 * Provides endpoints for viewing:
 * - Single outbound email history
 * - Bulk email job history
 */

const { pool } = require('../../config/db');

/**
 * GET /api/email/history/outbound
 * Get single email send history
 */
exports.getOutboundHistory = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { 
        limit = 50, 
        offset = 0, 
        status, 
        startDate, 
        endDate,
        search 
    } = req.query;

    try {
        let query = `
            SELECT 
                id,
                from_email,
                to_email,
                subject,
                status,
                sent_at,
                provider_type,
                error_message,
                message_id
            FROM outbound_emails
            WHERE tenant_id = $1
        `;
        
        const params = [tenantId];
        let paramCount = 1;

        // Filter by status
        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }

        // Filter by date range
        if (startDate) {
            paramCount++;
            query += ` AND sent_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND sent_at <= $${paramCount}`;
            params.push(endDate);
        }

        // Search in recipient or subject
        if (search) {
            paramCount++;
            query += ` AND (to_email ILIKE $${paramCount} OR subject ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Order by most recent
        query += ` ORDER BY sent_at DESC`;

        // Pagination
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM outbound_emails
            WHERE tenant_id = $1
        `;
        const countParams = [tenantId];
        let countParamIdx = 1;

        if (status) {
            countParamIdx++;
            countQuery += ` AND status = $${countParamIdx}`;
            countParams.push(status);
        }

        if (startDate) {
            countParamIdx++;
            countQuery += ` AND sent_at >= $${countParamIdx}`;
            countParams.push(startDate);
        }

        if (endDate) {
            countParamIdx++;
            countQuery += ` AND sent_at <= $${countParamIdx}`;
            countParams.push(endDate);
        }

        if (search) {
            countParamIdx++;
            countQuery += ` AND (to_email ILIKE $${countParamIdx} OR subject ILIKE $${countParamIdx})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            emails: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (err) {
        console.error('Get outbound email history error:', err);
        res.status(500).json({
            error: 'Failed to fetch email history',
            details: err.message
        });
    }
};

/**
 * GET /api/email/history/bulk
 * Get bulk email job history
 */
exports.getBulkJobHistory = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { 
        limit = 50, 
        offset = 0, 
        status,
        startDate,
        endDate 
    } = req.query;

    try {
        let query = `
            SELECT 
                id,
                group_id,
                group_name,
                from_email,
                subject,
                status,
                total_recipients,
                emails_sent,
                emails_failed,
                progress_percent,
                provider_type,
                created_at,
                started_at,
                completed_at,
                error_message
            FROM bulk_email_jobs
            WHERE tenant_id = $1
        `;
        
        const params = [tenantId];
        let paramCount = 1;

        // Filter by status
        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }

        // Filter by date range
        if (startDate) {
            paramCount++;
            query += ` AND created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND created_at <= $${paramCount}`;
            params.push(endDate);
        }

        // Order by most recent
        query += ` ORDER BY created_at DESC`;

        // Pagination
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
            FROM bulk_email_jobs
            WHERE tenant_id = $1
        `;
        const countParams = [tenantId];
        let countParamIdx = 1;

        if (status) {
            countParamIdx++;
            countQuery += ` AND status = $${countParamIdx}`;
            countParams.push(status);
        }

        if (startDate) {
            countParamIdx++;
            countQuery += ` AND created_at >= $${countParamIdx}`;
            countParams.push(startDate);
        }

        if (endDate) {
            countParamIdx++;
            countQuery += ` AND created_at <= $${countParamIdx}`;
            countParams.push(endDate);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            jobs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (err) {
        console.error('Get bulk job history error:', err);
        res.status(500).json({
            error: 'Failed to fetch bulk job history',
            details: err.message
        });
    }
};

/**
 * GET /api/email/history/outbound/:emailId
 * Get single email details
 */
exports.getOutboundEmailDetails = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { emailId } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                oe.*,
                mem.cc_addresses,
                mem.bcc_addresses,
                mem.reply_to_address
            FROM outbound_emails oe
            LEFT JOIN message_email_metadata mem ON oe.message_id = mem.message_id
            WHERE oe.id = $1 AND oe.tenant_id = $2
        `, [emailId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error('Get email details error:', err);
        res.status(500).json({
            error: 'Failed to fetch email details',
            details: err.message
        });
    }
};

module.exports = {
    getOutboundHistory: exports.getOutboundHistory,
    getBulkJobHistory: exports.getBulkJobHistory,
    getOutboundEmailDetails: exports.getOutboundEmailDetails
};
