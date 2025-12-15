const { pool } = require('../config/db');

// Get or create default pipeline for tenant
const getOrCreateDefaultPipeline = async (tenantId) => {
    // Check if pipeline exists
    let result = await pool.query(
        `SELECT * FROM pipelines WHERE tenant_id = $1 AND is_default = true`,
        [tenantId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Create default pipeline
    result = await pool.query(
        `INSERT INTO pipelines (tenant_id, name, is_default) VALUES ($1, 'Sales Pipeline', true) RETURNING *`,
        [tenantId]
    );
    const pipeline = result.rows[0];

    // Create default stages
    const stages = [
        { name: 'New', order_index: 1, is_terminal: false },
        { name: 'Contacted', order_index: 2, is_terminal: false },
        { name: 'Discovery', order_index: 3, is_terminal: false },
        { name: 'Qualified', order_index: 4, is_terminal: false },
        { name: 'Demo / Meeting', order_index: 5, is_terminal: false },
        { name: 'Proposal / Quote', order_index: 6, is_terminal: false },
        { name: 'Negotiation', order_index: 7, is_terminal: false },
        { name: 'Won', order_index: 8, is_terminal: true },
        { name: 'Lost', order_index: 9, is_terminal: true }
    ];

    for (const stage of stages) {
        await pool.query(
            `INSERT INTO pipeline_stages (pipeline_id, name, order_index, is_terminal) VALUES ($1, $2, $3, $4)`,
            [pipeline.id, stage.name, stage.order_index, stage.is_terminal]
        );
    }

    return pipeline;
};

// Get pipeline with stages
exports.getPipeline = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const pipeline = await getOrCreateDefaultPipeline(tenantId);

        const stages = await pool.query(
            `SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY order_index`,
            [pipeline.id]
        );

        res.json({ pipeline, stages: stages.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch pipeline' });
    }
};

// Get all leads with contact info (with search/filter)
exports.getLeads = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { search, stageId, minScore, maxScore } = req.query;

        let query = `
            SELECT 
                l.*,
                c.name as contact_name,
                c.email as contact_email,
                c.phone as contact_phone,
                c.company_name as contact_company,
                c.metadata as contact_metadata,
                ps.name as stage_name,
                ps.order_index as stage_order
            FROM leads l
            JOIN contacts c ON l.contact_id = c.id
            JOIN pipeline_stages ps ON l.stage_id = ps.id
            WHERE l.tenant_id = $1
        `;
        
        const params = [tenantId];
        let paramIndex = 2;

        // Search filter
        if (search) {
            query += ` AND (c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Stage filter
        if (stageId) {
            query += ` AND l.stage_id = $${paramIndex}`;
            params.push(stageId);
            paramIndex++;
        }

        // Score filters
        if (minScore !== undefined) {
            query += ` AND COALESCE(l.score, 0) >= $${paramIndex}`;
            params.push(parseInt(minScore));
            paramIndex++;
        }

        if (maxScore !== undefined) {
            query += ` AND COALESCE(l.score, 0) <= $${paramIndex}`;
            params.push(parseInt(maxScore));
            paramIndex++;
        }

        query += ` ORDER BY l.created_at DESC`;

        const result = await pool.query(query, params);

        res.json({ leads: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

// Add contacts to leads (bulk)
exports.createLeadsFromContacts = async (req, res) => {
    const client = await pool.connect();
    try {
        const { contactIds } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.userId;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ error: 'No contact IDs provided' });
        }

        await client.query('BEGIN');

        // Get or create pipeline
        const pipeline = await getOrCreateDefaultPipeline(tenantId);

        // Get the first stage (New)
        const stageResult = await client.query(
            `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND order_index = 1`,
            [pipeline.id]
        );

        if (stageResult.rows.length === 0) {
            throw new Error('No stages found for pipeline');
        }

        const firstStageId = stageResult.rows[0].id;
        const createdLeads = [];

        for (const contactId of contactIds) {
            // Check if lead already exists for this contact
            const existingLead = await client.query(
                `SELECT id FROM leads WHERE contact_id = $1 AND tenant_id = $2`,
                [contactId, tenantId]
            );

            if (existingLead.rows.length > 0) {
                continue; // Skip if lead already exists
            }

            // Create lead
            const result = await client.query(
                `INSERT INTO leads (tenant_id, contact_id, pipeline_id, stage_id, status, created_by)
                 VALUES ($1, $2, $3, $4, 'open', $5) RETURNING *`,
                [tenantId, contactId, pipeline.id, firstStageId, userId]
            );

            createdLeads.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ 
            message: `Created ${createdLeads.length} leads`, 
            leads: createdLeads,
            skipped: contactIds.length - createdLeads.length
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to create leads' });
    } finally {
        client.release();
    }
};

// Update lead stage (for drag-and-drop)
exports.updateLeadStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stageId } = req.body;
        const tenantId = req.user.tenantId;

        const result = await pool.query(
            `UPDATE leads SET stage_id = $1, last_activity_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [stageId, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update lead stage' });
    }
};

// Update lead status (won/lost)
exports.updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const tenantId = req.user.tenantId;

        if (!['open', 'won', 'lost', 'disqualified'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(
            `UPDATE leads SET status = $1, last_activity_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [status, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update lead status' });
    }
};

// Update lead score
exports.updateLeadScore = async (req, res) => {
    try {
        const { id } = req.params;
        const { score } = req.body;
        const tenantId = req.user.tenantId;

        if (score === undefined || score < 0 || score > 5) {
            return res.status(400).json({ error: 'Score must be between 0 and 5' });
        }

        const result = await pool.query(
            `UPDATE leads SET score = $1, last_activity_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [parseInt(score), id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update lead score' });
    }
};
