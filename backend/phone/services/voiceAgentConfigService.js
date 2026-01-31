/**
 * Voice Agent Configuration Service
 * Fetches voice agent configuration from PostgreSQL for realtime calls
 */

const { pool } = require('../../config/db');

/**
 * Get voice agent configuration by phone number
 * Fetches from tenant_phone_config and joins with realtime model config
 * 
 * @param {string} phoneNumber - The phone number to lookup
 * @returns {Promise<Object>} Voice agent configuration
 */
async function getVoiceAgentConfig(phoneNumber) {
    try {
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
                tpc.realtime_model_id,
                tpc.stt_model_id,
                tpc.llm_model_id,
                tpc.tts_model_id,
                -- Realtime model details
                rt.provider as rt_provider,
                rt.model_name as rt_model,
                rt.voice_name as rt_voice,
                rt.pricing as rt_pricing
            FROM tenant_phone_config tpc
            LEFT JOIN x_realtime_sts rt ON tpc.realtime_model_id = rt.id
            WHERE tpc.phone_number = $1 
                AND tpc.is_active = true
                AND tpc.default_method = 'realtime'
            LIMIT 1
        `, [phoneNumber]);

        if (result.rows.length === 0) {
            return null;
        }

        const config = result.rows[0];

        // Validate realtime configuration
        if (!config.realtime_model_id) {
            throw new Error(`Voice agent for ${phoneNumber} has no realtime model configured`);
        }

        return {
            id: config.id,
            tenantId: config.tenant_id,
            phoneNumber: config.phone_number,
            agentName: config.voice_agent_name,
            welcomeMessage: config.welcome_message,
            customInstructions: config.agent_instructions,
            isActive: config.is_active,
            // Realtime model config
            realtimeModel: {
                id: config.realtime_model_id,
                provider: config.rt_provider,
                modelName: config.rt_model,
                voiceName: config.rt_voice,
                pricing: config.rt_pricing
            }
        };
    } catch (error) {
        console.error('[VoiceAgentConfig] Error fetching config:', error);
        throw error;
    }
}

/**
 * Get voice agent configuration by session
 * Extracts phone number from session and fetches config
 * 
 * For INBOUND calls: toNumber is the tenant's phone (customer called this number)
 * For OUTBOUND calls: fromNumber is the tenant's phone (tenant calling from this number)
 * 
 * @param {Object} session - Call session object
 * @returns {Promise<Object>} Voice agent configuration
 */
async function getVoiceAgentConfigFromSession(session) {
    if (!session) {
        throw new Error('Session is missing');
    }

    // Determine which phone number to query based on call direction
    let tenantPhoneNumber;
    if (session.direction === 'inbound') {
        // For inbound: customer called TO this number (tenant's number)
        tenantPhoneNumber = session.toNumber;
    } else {
        // For outbound: tenant calling FROM this number
        tenantPhoneNumber = session.fromNumber;
    }

    if (!tenantPhoneNumber) {
        throw new Error(`Session missing phone number (direction: ${session.direction}, toNumber: ${session.toNumber}, fromNumber: ${session.fromNumber})`);
    }

    console.log(`[VoiceAgentConfig] Looking up config for ${session.direction} call, tenant phone: ${tenantPhoneNumber}`);
    return getVoiceAgentConfig(tenantPhoneNumber);
}

/**
 * Validate voice agent configuration
 * Ensures all required fields are present
 * 
 * @param {Object} config - Voice agent config
 * @returns {boolean} True if valid
 * @throws {Error} If configuration is invalid
 */
function validateVoiceAgentConfig(config) {
    if (!config) {
        throw new Error('Voice agent configuration is null');
    }

    if (!config.tenantId) {
        throw new Error('Voice agent missing tenant ID');
    }

    if (!config.realtimeModel || !config.realtimeModel.modelName) {
        throw new Error('Voice agent missing realtime model configuration');
    }

    if (!config.realtimeModel.voiceName) {
        throw new Error('Voice agent missing voice configuration');
    }

    return true;
}

module.exports = {
    getVoiceAgentConfig,
    getVoiceAgentConfigFromSession,
    validateVoiceAgentConfig
};
