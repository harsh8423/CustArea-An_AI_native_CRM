/**
 * Widget Session Service
 * Manages anonymous widget sessions and contact linking
 * Uses widget_sessions table with configId instead of siteId
 */

const { pool } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { findOrCreateContact } = require('../../services/contactResolver');

/**
 * Find or create a widget session
 */
async function findOrCreateSession(configId, tenantId, externalId) {
    // Try to find existing session
    const existing = await pool.query(
        `SELECT * FROM widget_sessions WHERE site_id = $1 AND external_id = $2`,
        [configId, externalId]
    );
    
    if (existing.rows[0]) {
        // Update last seen
        await pool.query(
            `UPDATE widget_sessions SET last_seen_at = NOW() WHERE id = $1`,
            [existing.rows[0].id]
        );
        return existing.rows[0];
    }
    
    // Create new session with explicit UUID
    const sessionId = uuidv4();
    const result = await pool.query(
        `INSERT INTO widget_sessions (id, site_id, tenant_id, external_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [sessionId, configId, tenantId, externalId]
    );
    
    return result.rows[0];
}

/**
 * Get session by ID
 */
async function getSessionById(sessionId) {
    const result = await pool.query(
        `SELECT * FROM widget_sessions WHERE id = $1`,
        [sessionId]
    );
    return result.rows[0] || null;
}

/**
 * Link session to contact when email/phone provided
 */
async function linkSessionToContact(sessionId, tenantId, { email, phone, name }) {
    // Find or create contact using the contact resolver
    const { contact, isNew } = await findOrCreateContact(
        tenantId,
        { email, phone },
        { name, source: 'widget' }
    );
    
    // Update session with contact link
    await pool.query(
        `UPDATE widget_sessions 
         SET contact_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [sessionId, contact.id]
    );
    
    return { contact, isNew };
}

/**
 * Update session metadata
 */
async function updateSessionMetadata(sessionId, metadata) {
    await pool.query(
        `UPDATE widget_sessions 
         SET metadata = metadata || $2, updated_at = NOW()
         WHERE id = $1`,
        [sessionId, JSON.stringify(metadata)]
    );
}

module.exports = {
    findOrCreateSession,
    getSessionById,
    linkSessionToContact,
    updateSessionMetadata
};
