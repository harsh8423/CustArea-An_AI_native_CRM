/**
 * Voice Agent Controller
 * Handles CRUD operations for voice agents (tenant_phone_config)
 */

const { pool } = require('../../config/db');

/**
 * GET /api/voice-agents
 * List all voice agents for tenant
 */
async function listVoiceAgents(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    try {
        // Check if user is super admin
        const roleCheck = await pool.query(`
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND (r.role_name = 'super_admin' OR r.role_name = 'super admin')
        `, [userId]);
        const isSuperAdmin = roleCheck.rows.length > 0;

        // Build query with optional RBAC filtering
        const params = [tenantId];
        let whereClause = 'WHERE tpc.tenant_id = $1';
        
        if (!isSuperAdmin) {
            whereClause += ` AND (tpc.assigned_user_id = $2 OR tpc.assigned_user_id IS NULL)`;
            params.push(userId);
        }

        const result = await pool.query(`
            SELECT 
                tpc.id,
                tpc.tenant_id,
                tpc.phone_number,
                tpc.voice_agent_name,
                tpc.welcome_message,
                tpc.agent_instructions,
                tpc.default_method,
                tpc.is_active,
                tpc.stt_model_id,
                tpc.llm_model_id,
                tpc.tts_model_id,
                tpc.realtime_model_id,
                tpc.created_at,
                tpc.updated_at,
                -- Get model details
                stt.provider as stt_provider, stt.model_name as stt_model,
                llm.provider as llm_provider, llm.model_name as llm_model,
                tts.provider as tts_provider, tts.voice_name as tts_voice,
                rt.provider as rt_provider, rt.model_name as rt_model, rt.voice_name as rt_voice,
                -- Get phone details
                tap.country_code, tap.country_name, tap.phone_type, tap.monthly_cost
            FROM tenant_phone_config tpc
            LEFT JOIN x_stt stt ON tpc.stt_model_id = stt.id
            LEFT JOIN x_llm llm ON tpc.llm_model_id = llm.id
            LEFT JOIN x_tts tts ON tpc.tts_model_id = tts.id
            LEFT JOIN x_realtime_sts rt ON tpc.realtime_model_id = rt.id
            LEFT JOIN tenants_allowed_phones tap ON tpc.phone_number = tap.phone_number
            ${whereClause}
            ORDER BY tpc.created_at DESC
        `, params);

        res.json({ voiceAgents: result.rows });
    } catch (error) {
        console.error('[VoiceAgent] Error listing voice agents:', error);
        res.status(500).json({ error: 'Failed to list voice agents' });
    }
}

/**
 * GET /api/voice-agents/:id
 * Get single voice agent details
 */
async function getVoiceAgent(req, res) {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT 
                tpc.*,
                stt.provider as stt_provider, stt.model_name as stt_model, stt.pricing as stt_pricing,
                llm.provider as llm_provider, llm.model_name as llm_model, llm.pricing as llm_pricing,
                tts.provider as tts_provider, tts.voice_name as tts_voice, tts.pricing as tts_pricing,
                rt.provider as rt_provider, rt.model_name as rt_model, rt.voice_name as rt_voice, rt.pricing as rt_pricing,
                tap.country_code, tap.country_name, tap.phone_type, tap.monthly_cost
            FROM tenant_phone_config tpc
            LEFT JOIN x_stt stt ON tpc.stt_model_id = stt.id
            LEFT JOIN x_llm llm ON tpc.llm_model_id = llm.id
            LEFT JOIN x_tts tts ON tpc.tts_model_id = tts.id
            LEFT JOIN x_realtime_sts rt ON tpc.realtime_model_id = rt.id
            LEFT JOIN tenants_allowed_phones tap ON tpc.phone_number = tap.phone_number
            WHERE tpc.id = $1 AND tpc.tenant_id = $2
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Voice agent not found' });
        }

        res.json({ voiceAgent: result.rows[0] });
    } catch (error) {
        console.error('[VoiceAgent] Error getting voice agent:', error);
        res.status(500).json({ error: 'Failed to get voice agent' });
    }
}

/**
 * POST /api/voice-agents
 * Create new voice agent
 */
async function createVoiceAgent(req, res) {
    const tenantId = req.user.tenantId;
    const {
        phoneNumber,
        voiceAgentName,
        welcomeMessage,
        agentInstructions,
        defaultMethod,
        sttModelId,
        llmModelId,
        ttsModelId,
        realtimeModelId
    } = req.body;

    // Validation
    if (!phoneNumber || !voiceAgentName || !defaultMethod) {
        return res.status(400).json({ error: 'Missing required fields: phoneNumber, voiceAgentName, defaultMethod' });
    }

    if (!['realtime', 'legacy'].includes(defaultMethod)) {
        return res.status(400).json({ error: 'defaultMethod must be either "realtime" or "legacy"' });
    }

    // Legacy method is currently disabled
    if (defaultMethod === 'legacy') {
        return res.status(400).json({ 
            error: 'Legacy method is currently disabled. Please use realtime method. Legacy method coming soon with cheaper pricing!' 
        });
    }

    try {
        // Check if phone number is granted to this tenant
        const phoneCheck = await pool.query(`
            SELECT * FROM tenants_allowed_phones 
            WHERE phone_number = $1 AND tenant_id = $2 AND is_granted = true
        `, [phoneNumber, tenantId]);

        if (phoneCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Phone number not available or not granted to your tenant' });
        }

        // Check if phone number already in use
        const existingAgent = await pool.query(`
            SELECT id FROM tenant_phone_config WHERE phone_number = $1
        `, [phoneNumber]);

        if (existingAgent.rows.length > 0) {
            return res.status(400).json({ error: 'Phone number already in use by another voice agent' });
        }

        // Insert voice agent
        const result = await pool.query(`
            INSERT INTO tenant_phone_config (
                tenant_id, phone_number, voice_agent_name, welcome_message, 
                agent_instructions, default_method, stt_model_id, llm_model_id, 
                tts_model_id, realtime_model_id, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            RETURNING *
        `, [
            tenantId, phoneNumber, voiceAgentName, welcomeMessage,
            agentInstructions, defaultMethod, sttModelId, llmModelId,
            ttsModelId, realtimeModelId
        ]);

        console.log(`[VoiceAgent] Created voice agent ${result.rows[0].id} for tenant ${tenantId}`);
        res.status(201).json({ voiceAgent: result.rows[0] });
    } catch (error) {
        console.error('[VoiceAgent] Error creating voice agent:', error);
        res.status(500).json({ error: 'Failed to create voice agent' });
    }
}

/**
 * PUT /api/voice-agents/:id
 * Update voice agent
 */
async function updateVoiceAgent(req, res) {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const {
        voiceAgentName,
        welcomeMessage,
        agentInstructions,
        defaultMethod,
        sttModelId,
        llmModelId,
        ttsModelId,
        realtimeModelId,
        isActive
    } = req.body;

    try {
        // Verify agent belongs to tenant
        const check = await pool.query(`
            SELECT id FROM tenant_phone_config WHERE id = $1 AND tenant_id = $2
        `, [id, tenantId]);

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Voice agent not found' });
        }

        const result = await pool.query(`
            UPDATE tenant_phone_config SET
                voice_agent_name = COALESCE($1, voice_agent_name),
                welcome_message = COALESCE($2, welcome_message),
                agent_instructions = COALESCE($3, agent_instructions),
                default_method = COALESCE($4, default_method),
                stt_model_id = COALESCE($5, stt_model_id),
                llm_model_id = COALESCE($6, llm_model_id),
                tts_model_id = COALESCE($7, tts_model_id),
                realtime_model_id = COALESCE($8, realtime_model_id),
                is_active = COALESCE($9, is_active),
                updated_at = now()
            WHERE id = $10 AND tenant_id = $11
            RETURNING *
        `, [
            voiceAgentName, welcomeMessage, agentInstructions, defaultMethod,
            sttModelId, llmModelId, ttsModelId, realtimeModelId, isActive,
            id, tenantId
        ]);

        console.log(`[VoiceAgent] Updated voice agent ${id}`);
        res.json({ voiceAgent: result.rows[0] });
    } catch (error) {
        console.error('[VoiceAgent] Error updating voice agent:', error);
        res.status(500).json({ error: 'Failed to update voice agent' });
    }
}

/**
 * DELETE /api/voice-agents/:id
 * Delete voice agent
 */
async function deleteVoiceAgent(req, res) {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            DELETE FROM tenant_phone_config 
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Voice agent not found' });
        }

        console.log(`[VoiceAgent] Deleted voice agent ${id}`);
        res.json({ message: 'Voice agent deleted successfully', voiceAgent: result.rows[0] });
    } catch (error) {
        console.error('[VoiceAgent] Error deleting voice agent:', error);
        res.status(500).json({ error: 'Failed to delete voice agent' });
    }
}

module.exports = {
    listVoiceAgents,
    getVoiceAgent,
    createVoiceAgent,
    updateVoiceAgent,
    deleteVoiceAgent
};
