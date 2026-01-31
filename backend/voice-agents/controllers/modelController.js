/**
 * Model Controller
 * Provides access to available AI models (STT, LLM, TTS, Realtime)
 */

const { pool } = require('../../config/db');

/**
 * GET /api/models/stt
 * Get all available STT models
 */
async function getSTTModels(req, res) {
    try {
        const result = await pool.query(`
            SELECT * FROM x_stt 
            WHERE is_active = true
            ORDER BY provider, model_name
        `);

        res.json({ models: result.rows });
    } catch (error) {
        console.error('[Models] Error getting STT models:', error);
        res.status(500).json({ error: 'Failed to get STT models' });
    }
}

/**
 * GET /api/models/llm
 * Get all available LLM models
 */
async function getLLMModels(req, res) {
    try {
        const result = await pool.query(`
            SELECT * FROM x_llm 
            WHERE is_active = true
            ORDER BY provider, model_name
        `);

        res.json({ models: result.rows });
    } catch (error) {
        console.error('[Models] Error getting LLM models:', error);
        res.status(500).json({ error: 'Failed to get LLM models' });
    }
}

/**
 * GET /api/models/tts
 * Get all available TTS voices
 */
async function getTTSVoices(req, res) {
    try {
        const result = await pool.query(`
            SELECT * FROM x_tts 
            WHERE is_active = true
            ORDER BY provider, voice_name
        `);

        res.json({ voices: result.rows });
    } catch (error) {
        console.error('[Models] Error getting TTS voices:', error);
        res.status(500).json({ error: 'Failed to get TTS voices' });
    }
}

/**
 * GET /api/models/realtime
 * Get all available realtime models
 */
async function getRealtimeModels(req, res) {
    try {
        const result = await pool.query(`
            SELECT * FROM x_realtime_sts 
            WHERE is_active = true
            ORDER BY provider, model_name, voice_name
        `);

        res.json({ models: result.rows });
    } catch (error) {
        console.error('[Models] Error getting realtime models:', error);
        res.status(500).json({ error: 'Failed to get realtime models' });
    }
}

module.exports = {
    getSTTModels,
    getLLMModels,
    getTTSVoices,
    getRealtimeModels
};
