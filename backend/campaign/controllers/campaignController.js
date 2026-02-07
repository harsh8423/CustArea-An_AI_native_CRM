/**
 * Campaign Controller
 * Handles HTTP requests for campaign management
 */

const campaignService = require('../services/campaignService');
const templateService = require('../services/templateGenerationService');
const { pool } = require('../../config/db');

/**
 * POST /api/campaigns - Create new campaign
 */
async function createCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id; // FIXED: auth middleware provides req.user.id not req.user.userId

        const result = await campaignService.createCampaign(tenantId, userId, req.body);
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns - List campaigns
 */
async function getCampaigns(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { status, search, offset, limit } = req.query;

        const result = await campaignService.getCampaigns(tenantId, {
            status,
            search,
            offset: parseInt(offset) || 0,
            limit: parseInt(limit) || 50
        }, userId);

        res.json(result);
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns/:id - Get single campaign
 */
async function getCampaignById(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const campaign = await campaignService.getCampaignById(tenantId, id);
        
        res.json(campaign);
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(404).json({ error: error.message });
    }
}

/**
 * PATCH /api/campaigns/:id - Update campaign
 */
async function updateCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const campaign = await campaignService.updateCampaign(tenantId, id, req.body);
        
        res.json({ success: true, campaign });
    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * DELETE /api/campaigns/:id - Delete campaign
 */
async function deleteCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const result = await campaignService.deleteCampaign(tenantId, id);
        
        res.json(result);
    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/launch - Launch campaign
 */
async function launchCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const result = await campaignService.launchCampaign(tenantId, id);
        
        // Trigger immediate processing of the campaign
        const { processCampaign } = require('../workers/campaignWorker');
        setImmediate(() => {
            processCampaign(id, tenantId).catch(err => {
                console.error('Error processing campaign immediately after launch:', err);
            });
        });
        
        res.json(result);
    } catch (error) {
        console.error('Launch campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/pause - Pause campaign
 */
async function pauseCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const result = await campaignService.pauseCampaign(tenantId, id);
        
        res.json(result);
    } catch (error) {
        console.error('Pause campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/resume - Resume paused campaign
 */
async function resumeCampaign(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const result = await campaignService.resumeCampaign(tenantId, id);
        
        res.json(result);
    } catch (error) {
        console.error('Resume campaign error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/templates/generate - Generate AI email templates
 */
async function generateTemplates(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const { followUpCount = 2 } = req.body;

        // Get campaign details
        const campaign = await campaignService.getCampaignById(tenantId, id);

        // Generate templates using AI
        const templates = await templateService.generateCampaignTemplates(campaign, followUpCount);

        // Save to database
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const savedTemplates = await templateService.saveTemplatesToDatabase(id, templates, client);
            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Templates generated successfully',
                templates: savedTemplates
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Generate templates error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns/:id/templates - Get campaign templates
 */
async function getTemplates(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const result = await pool.query(
            `SELECT * FROM campaign_email_templates 
             WHERE campaign_id = $1 
             ORDER BY 
                CASE WHEN template_type = 'initial' THEN 0 ELSE 1 END,
                created_at`,
            [id]
        );

        res.json({ templates: result.rows });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/templates - Create a new template
 */
async function createTemplate(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const { template_type, subject, body_html, wait_period_value, wait_period_unit } = req.body;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const result = await pool.query(
            `INSERT INTO campaign_email_templates 
             (campaign_id, template_type, subject, body_html, wait_period_value, wait_period_unit)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, template_type, subject, body_html, wait_period_value || 3, wait_period_unit || 'days']
        );

        res.json({ template: result.rows[0] });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * PUT /api/campaigns/:id/templates/:templateId - Update a template
 */
async function updateTemplate(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id, templateId } = req.params;
        const { subject, body_html, wait_period_value, wait_period_unit } = req.body;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const result = await pool.query(
            `UPDATE campaign_email_templates 
             SET subject = $1, 
                 body_html = $2, 
                 wait_period_value = $3,
                 wait_period_unit = $4,
                 updated_at = now()
             WHERE id = $5 AND campaign_id = $6
             RETURNING *`,
            [subject, body_html, wait_period_value, wait_period_unit, templateId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ template: result.rows[0] });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * DELETE /api/campaigns/:id/templates/:templateId - Delete a template
 */
async function deleteTemplate(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id, templateId } = req.params;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const result = await pool.query(
            `DELETE FROM campaign_email_templates 
             WHERE id = $1 AND campaign_id = $2
             RETURNING id`,
            [templateId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/:id/emails/rotation - Set email rotation
 */
async function setEmailRotation(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const { emailConnectionIds, emailConnections } = req.body;

        // Support both old format (emailConnectionIds) and new format (emailConnections)
        let connections;
        if (emailConnections) {
            // New format with type info: [{id, type}]
            connections = emailConnections;
        } else if (emailConnectionIds) {
            // Old format - assume all are connections
            connections = emailConnectionIds.map(id => ({ id, type: 'connection' }));
        } else {
            return res.status(400).json({ error: 'emailConnections or emailConnectionIds required' });
        }

        if (!Array.isArray(connections) || connections.length === 0) {
            return res.status(400).json({ error: 'Must provide at least one email connection' });
        }

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const emailRotationService = require('../services/emailRotationService');
        const result = await emailRotationService.addEmailsToRotation(id, connections);

        res.json(result);
    } catch (error) {
        console.error('Set email rotation error:', error);
        res.status(400).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns/:id/emails/rotation - Get email rotation
 */
async function getEmailRotation(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        const emailRotationService = require('../services/emailRotationService');
        const emails = await emailRotationService.getRotationEmails(id);

        res.json({ 
            emails,
            count: emails.length,
            isRotation: emails.length > 1
        });
    } catch (error) {
        console.error('Get email rotation error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns/:id/analytics - Get campaign analytics
 */
async function getCampaignAnalytics(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        // Verify campaign belongs to tenant
        await campaignService.getCampaignById(tenantId, id);

        // Get stored analytics (activity counters)
        const analyticsResult = await pool.query(
            'SELECT * FROM campaign_analytics WHERE campaign_id = $1',
            [id]
        );
        let analytics = analyticsResult.rows[0] || {};

        // Calculate REAL-TIME status counts from contacts table
        const statusCounts = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied,
                COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_active
             FROM campaign_contacts 
             WHERE campaign_id = $1`,
            [id]
        );
        
        const counts = statusCounts.rows[0];

        // Merge real-time counts into analytics object
        // We keep 'emails_sent' from analytics table because it tracks total OUTBOUND emails (including follow-ups),
        // whereas 'sent' status only tracks contacts who are currently in 'sent' state.
        analytics.total_enrolled = parseInt(counts.total);
        analytics.replied = parseInt(counts.replied);
        analytics.bounced = parseInt(counts.bounced);
        analytics.pending = parseInt(counts.pending);
        analytics.completed = parseInt(counts.completed);
        
        // Return structured data
        res.json({
            analytics,
            statusBreakdown: {
                total: parseInt(counts.total),
                pending: parseInt(counts.pending),
                sent: parseInt(counts.sent_active),
                replied: parseInt(counts.replied),
                completed: parseInt(counts.completed),
                bounced: parseInt(counts.bounced)
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/campaigns/:id/contacts - Get campaign contacts with details
 */
async function getCampaignContacts(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const { limit = 100, offset = 0, search } = req.query;

        // Verify campaign
        await campaignService.getCampaignById(tenantId, id);

        let query = `
            SELECT 
                cc.id, cc.campaign_id, cc.status, cc.current_follow_up_step, 
                cc.next_send_at, cc.last_sent_at, cc.replied_at, cc.enrolled_at,
                c.id as contact_id, c.name, c.email, c.company_name as company, c.phone
            FROM campaign_contacts cc
            JOIN contacts c ON cc.contact_id = c.id
            WHERE cc.campaign_id = $1
        `;
        
        const params = [id];

        if (search) {
            query += ` AND (c.name ILIKE $2 OR c.email ILIKE $2 OR c.company_name ILIKE $2)`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY cc.enrolled_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) 
            FROM campaign_contacts cc
            JOIN contacts c ON cc.contact_id = c.id
            WHERE cc.campaign_id = $1
            ${search ? `AND (c.name ILIKE $2 OR c.email ILIKE $2 OR c.company_name ILIKE $2)` : ''}
        `;
        const countParams = search ? [id, `%${search}%`] : [id];
        const countResult = await pool.query(countQuery, countParams);

        res.json({
            contacts: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Get campaign contacts error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/campaigns/preview/templates - Generate templates from form data WITHOUT creating campaign
 */
async function generateTemplatesPreview(req, res) {
    try {
        const { campaignData, followUpCount = 2 } = req.body;

        // Validate required fields
        if (!campaignData.company_name || !campaignData.campaign_objective || 
            !campaignData.selling_points || !campaignData.pain_points || 
            !campaignData.value_proposition) {
            return res.status(400).json({ error: 'Missing required campaign data fields' });
        }

        // Create a temporary campaign object for template generation (NOT saved to DB)
        const tempCampaignData = {
            name: campaignData.name || 'Preview Campaign',
            company_name: campaignData.company_name,
            website_url: campaignData.website_url,
            campaign_objective: campaignData.campaign_objective,
            selling_points: campaignData.selling_points,
            pain_points: campaignData.pain_points,
            value_proposition: campaignData.value_proposition,
            proof_points: campaignData.proof_points,
            language: campaignData.language || 'en',
            ai_instructions: campaignData.ai_instructions
        };

        // Generate templates using AI (no DB interaction)
        const templatesResult = await templateService.generateCampaignTemplates(tempCampaignData, followUpCount);
        
        // Convert to array format and add IDs + wait periods for frontend tracking
        const templatesArray = [
            { ...templatesResult.initial, id: `temp-initial-${Date.now()}` },
            ...templatesResult.followUps.map((t, i) => ({ 
                ...t, 
                id: `temp-followup-${i}-${Date.now()}`,
                wait_period_value: 3,
                wait_period_unit: 'days'
            }))
        ];

        res.json({
            success: true,
            message: 'Templates generated successfully',
            templates: templatesArray
        });

    } catch (error) {
        console.error('Generate templates preview error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createCampaign,
    getCampaigns,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    launchCampaign,
    pauseCampaign,
    resumeCampaign,
    generateTemplates,
    generateTemplatesPreview,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setEmailRotation,
    getEmailRotation,
    getCampaignAnalytics,
    getCampaignContacts
};

