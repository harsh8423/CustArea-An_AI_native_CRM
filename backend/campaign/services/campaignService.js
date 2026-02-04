/**
 * Campaign Service
 * Handles outreach campaign creation, management, and contact enrollment
 */

const { pool } = require('../../config/db');

/**
 * Create a new campaign with contact group selection
 */
async function createCampaign(tenantId, userId, campaignData) {
    const {
        name,
        description,
        contact_group_id,
        company_name,
        website_url,
        campaign_objective,
        selling_points,
        pain_points,
        value_proposition,
        proof_points,
        language = 'en',
        ai_instructions,
        reply_handling = 'human',
        cta_links = [],
        daily_send_limit = 200,
        max_contacts_limit = 500
    } = campaignData;

    // Validation
    if (!name || !contact_group_id || !company_name || !campaign_objective || !selling_points || !pain_points || !value_proposition) {
        throw new Error('Missing required fields');
    }

    if (daily_send_limit > 200) {
        throw new Error('Daily send limit cannot exceed 200');
    }

    if (max_contacts_limit > 500) {
        throw new Error('Max contacts limit cannot exceed 500');
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Verify contact group exists and belongs to tenant
        const groupCheck = await client.query(
            'SELECT id, name FROM contact_groups WHERE id = $1 AND tenant_id = $2',
            [contact_group_id, tenantId]
        );

        if (groupCheck.rows.length === 0) {
            throw new Error('Contact group not found');
        }

        // Create campaign
        const campaignResult = await client.query(
            `INSERT INTO outreach_campaigns (
                tenant_id, created_by, name, description, contact_group_id,
                company_name, website_url, campaign_objective, selling_points,
                pain_points, value_proposition, proof_points, language,
                ai_instructions, reply_handling, cta_links, daily_send_limit,
                max_contacts_limit, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft')
            RETURNING *`,
            [
                tenantId, userId, name, description, contact_group_id,
                company_name, website_url, campaign_objective, selling_points,
                pain_points, value_proposition, proof_points, language,
                ai_instructions, reply_handling, JSON.stringify(cta_links),
                daily_send_limit, max_contacts_limit
            ]
        );

        const campaign = campaignResult.rows[0];

        await client.query('COMMIT');

        return {
            success: true,
            campaign,
            message: 'Campaign created successfully'
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get all campaigns for a tenant
 */
async function getCampaigns(tenantId, filters = {}, userId = null) {
    const { status, search, offset = 0, limit = 50 } = filters;

    // Check if user is super admin
    let isSuperAdmin = false;
    if (userId) {
        const roleCheck = await pool.query(`
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND (r.role_name = 'super_admin' OR r.role_name = 'super admin')
        `, [userId]);
        isSuperAdmin = roleCheck.rows.length > 0;
    }

    let query = `
        SELECT 
            oc.*,
            cg.name as contact_group_name,
            cg.description as contact_group_description,
            u.name as created_by_name,
            ca.total_contacts_enrolled,
            ca.total_contacts_valid,
            ca.total_contacts_skipped,
            ca.total_emails_sent,
            ca.total_replies,
            ca.emails_sent_today,
            ca.reply_rate,
            ca.skip_rate
        FROM outreach_campaigns oc
        LEFT JOIN contact_groups cg ON oc.contact_group_id = cg.id
        LEFT JOIN users u ON oc.created_by = u.id
        LEFT JOIN campaign_analytics ca ON oc.id = ca.campaign_id
        WHERE oc.tenant_id = $1
    `;

    const params = [tenantId];
    let paramCount = 1;

    // RBAC Filter: Non-super admin users can only see campaigns using contact groups they have access to
    if (!isSuperAdmin && userId) {
        paramCount++;
        query += ` AND (oc.created_by = $${paramCount} OR EXISTS (
            SELECT 1 FROM user_contact_group_assignments ucga
            WHERE ucga.user_id = $${paramCount} AND ucga.contact_group_id = oc.contact_group_id
        ))`;
        params.push(userId);
    }

    if (status) {
        paramCount++;
        query += ` AND oc.status = $${paramCount}`;
        params.push(status);
    }

    if (search) {
        paramCount++;
        query += ` AND (oc.name ILIKE $${paramCount} OR oc.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
    }

    query += ` ORDER BY oc.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM outreach_campaigns WHERE tenant_id = $1' + 
        (status ? ' AND status = $2' : ''),
        status ? [tenantId, status] : [tenantId]
    );

    return {
        campaigns: result.rows,
        total: parseInt(countResult.rows[0].count),
        offset,
        limit
    };
}

/**
 * Get single campaign by ID
 */
async function getCampaignById(tenantId, campaignId) {
    const result = await pool.query(
        `SELECT 
            oc.*,
            cg.name as contact_group_name,
            cg.description as contact_group_description,
            u.name as created_by_name,
            ca.*
        FROM outreach_campaigns oc
        LEFT JOIN contact_groups cg ON oc.contact_group_id = cg.id
        LEFT JOIN users u ON oc.created_by = u.id
        LEFT JOIN campaign_analytics ca ON oc.id = ca.campaign_id
        WHERE oc.id = $1 AND oc.tenant_id = $2`,
        [campaignId, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Campaign not found');
    }

    return result.rows[0];
}

/**
 * Update campaign
 */
async function updateCampaign(tenantId, campaignId, updates) {
    const allowedFields = [
        'name', 'description', 'company_name', 'website_url',
        'campaign_objective', 'selling_points', 'pain_points',
        'value_proposition', 'proof_points', 'language',
        'ai_instructions', 'reply_handling', 'cta_links',
        'daily_send_limit', 'max_contacts_limit'
    ];

    const updateFields = [];
    const values = [campaignId, tenantId];
    let paramCount = 2;

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            paramCount++;
            updateFields.push(`${key} = $${paramCount}`);
            values.push(key === 'cta_links' ? JSON.stringify(updates[key]) : updates[key]);
        }
    });

    if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
    }

    const query = `
        UPDATE outreach_campaigns 
        SET ${updateFields.join(', ')}, updated_at = now()
        WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
        RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
        throw new Error('Campaign not found or cannot be updated (only draft campaigns can be edited)');
    }

    return result.rows[0];
}

/**
 * Delete campaign
 */
async function deleteCampaign(tenantId, campaignId) {
    const result = await pool.query(
        `DELETE FROM outreach_campaigns 
         WHERE id = $1 AND tenant_id = $2
         RETURNING id`,
        [campaignId, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Campaign not found');
    }

    return { success: true, message: 'Campaign deleted successfully' };
}

/**
 * Launch campaign - enrolls contacts and changes status to active
 */
async function launchCampaign(tenantId, campaignId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get campaign details
        const campaignResult = await client.query(
            'SELECT * FROM outreach_campaigns WHERE id = $1 AND tenant_id = $2 AND status = $3',
            [campaignId, tenantId, 'draft']
        );

        if (campaignResult.rows.length === 0) {
            throw new Error('Campaign not found or already launched');
        }

        const campaign = campaignResult.rows[0];

        // Get all contacts from the contact group
        const contactsResult = await client.query(
            `SELECT c.id, c.name, c.email, c.company_name as company
             FROM contact_group_memberships cgm
             JOIN contacts c ON cgm.contact_id = c.id
             WHERE cgm.group_id = $1
             LIMIT $2`,
            [campaign.contact_group_id, campaign.max_contacts_limit]
        );

        if (contactsResult.rows.length === 0) {
            throw new Error('No contacts found in the selected group');
        }

        // Enroll contacts
        let enrolled = 0;
        let skipped = 0;

        for (const contact of contactsResult.rows) {
            if (!contact.email || contact.email.trim() === '') {
                // Skip contacts without email
                await client.query(
                    `INSERT INTO campaign_contacts (
                        campaign_id, contact_id, status, skip_reason, enrolled_by, metadata
                    ) VALUES ($1, $2, 'skipped_no_email', 'No email address', $3, $4)`,
                    [
                        campaignId,
                        contact.id,
                        null, // enrolled_by is null for skipped
                        JSON.stringify({
                            name: contact.name,
                            company: contact.company
                        })
                    ]
                );
                skipped++;
            } else {
                // Enroll contact
                await client.query(
                    `INSERT INTO campaign_contacts (
                        campaign_id, contact_id, status, metadata
                    ) VALUES ($1, $2, 'pending', $3)`,
                    [
                        campaignId,
                        contact.id,
                        JSON.stringify({
                            name: contact.name,
                            email: contact.email,
                            company: contact.company
                        })
                    ]
                );
                enrolled++;
            }
        }

        // Update campaign status to active
        await client.query(
            'UPDATE outreach_campaigns SET status = $1, launched_at = now() WHERE id = $2',
            ['active', campaignId]
        );

        await client.query('COMMIT');

        return {
            success: true,
            message: 'Campaign launched successfully',
            stats: {
                total: contactsResult.rows.length,
                enrolled,
                skipped
            }
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Pause active campaign
 */
async function pauseCampaign(tenantId, campaignId) {
    const result = await pool.query(
        `UPDATE outreach_campaigns 
         SET status = 'paused', updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND status = 'active'
         RETURNING *`,
        [campaignId, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Campaign not found or not active');
    }

    return { success: true, message: 'Campaign paused', campaign: result.rows[0] };
}

/**
 * Resume paused campaign
 */
async function resumeCampaign(tenantId, campaignId) {
    const result = await pool.query(
        `UPDATE outreach_campaigns 
         SET status = 'active', updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND status = 'paused'
         RETURNING *`,
        [campaignId, tenantId]
    );

    if (result.rows.length === 0) {
        throw new Error('Campaign not found or not paused');
    }

    return { success: true, message: 'Campaign resumed', campaign: result.rows[0] };
}

module.exports = {
    createCampaign,
    getCampaigns,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    launchCampaign,
    pauseCampaign,
    resumeCampaign
};
