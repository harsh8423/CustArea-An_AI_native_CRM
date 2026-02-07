/**
 * ContactResolver Service
 * 
 * Centralized service for finding or creating contacts with cross-channel deduplication.
 * All channel handlers should use this service instead of directly inserting contacts.
 */

const { pool } = require('../config/db');

/**
 * Find contact without creating (lookup only)
 * Returns null if not found - use this for inbound message handling
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} identifiers - Contact identifiers
 * @param {string} identifiers.email - Email address
 * @param {string} identifiers.phone - Phone number
 * @param {string} identifiers.visitorId - Widget visitor ID
 * @returns {Object|null} contact object or null if not found
 */
async function findContact(tenantId, identifiers = {}) {
    const { email, phone, visitorId } = identifiers;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const normalizedVisitorId = visitorId ? visitorId.trim() : null;

    const client = await pool.connect();
    try {
        let contact = null;

        // Priority 1: Search by email (most reliable identifier)
        if (normalizedEmail) {
            contact = await findContactByIdentifier(client, tenantId, 'email', normalizedEmail);
        }

        // Priority 2: Search by phone
        if (!contact && normalizedPhone) {
            contact = await findContactByIdentifier(client, tenantId, 'phone', normalizedPhone);
        }

        // Priority 3: Search by visitor ID (least reliable)
        if (!contact && normalizedVisitorId) {
            contact = await findContactByIdentifier(client, tenantId, 'visitor_id', normalizedVisitorId);
        }

        return contact; // Returns null if not found
    } finally {
        client.release();
    }
}

/**
 * Create new contact explicitly - use for user-initiated actions
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} identifiers - Contact identifiers
 * @param {string} identifiers.email - Email address
 * @param {string} identifiers.phone - Phone number
 * @param {string} identifiers.visitorId - Widget visitor ID
 * @param {Object} metadata - Additional contact data
 * @param {string} metadata.name - Contact name
 * @param {string} metadata.source - Source channel
 * @param {string} metadata.companyName - Company name
 * @param {string} metadata.createdBy - User ID who created this contact
 * @returns {Object} created contact
 */
async function createContact(tenantId, identifiers = {}, metadata = {}) {
    const { email, phone, visitorId } = identifiers;
    const { name, source, companyName, createdBy } = metadata;

    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const normalizedVisitorId = visitorId ? visitorId.trim() : null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertResult = await client.query(
            `INSERT INTO contacts (tenant_id, name, email, phone, source, company_name, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [tenantId, name || null, normalizedEmail, normalizedPhone, source || 'manual', companyName || null, createdBy || null]
        );
        const contact = insertResult.rows[0];

        // Add identifiers
        if (normalizedEmail) {
            await addIdentifier(client, tenantId, contact.id, 'email', normalizedEmail, source, true);
        }
        if (normalizedPhone) {
            await addIdentifier(client, tenantId, contact.id, 'phone', normalizedPhone, source, true);
        }
        if (normalizedVisitorId) {
            await addIdentifier(client, tenantId, contact.id, 'visitor_id', normalizedVisitorId, source, true);
        }

        await client.query('COMMIT');
        return contact;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * LEGACY: Find or create a contact with cross-channel deduplication
 * 
 * @deprecated Use findContact() for lookups and createContact() for explicit creation
 * Kept for backward compatibility - will auto-create contacts
 * 
 * @param {string} tenantId - Tenant ID
 * @param {Object} identifiers - Contact identifiers
 * @param {string} identifiers.email - Email address
 * @param {string} identifiers.phone - Phone number
 * @param {string} identifiers.visitorId - Widget visitor ID
 * @param {Object} metadata - Additional contact data
 * @param {string} metadata.name - Contact name
 * @param {string} metadata.source - Source channel (whatsapp, email, widget)
 * @param {string} metadata.companyName - Company name
 * @returns {Object} { contact, isNew, identifiersAdded }
 */
async function findOrCreateContactLegacy(tenantId, identifiers = {}, metadata = {}) {
    const { email, phone, visitorId } = identifiers;
    const { name, source, companyName } = metadata;

    // Normalize identifiers
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const normalizedVisitorId = visitorId ? visitorId.trim() : null;

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        let contact = null;
        let isNew = false;
        const identifiersAdded = [];

        // Priority 1: Search by email (most reliable identifier)
        if (normalizedEmail) {
            contact = await findContactByIdentifier(client, tenantId, 'email', normalizedEmail);
        }

        // Priority 2: Search by phone
        if (!contact && normalizedPhone) {
            contact = await findContactByIdentifier(client, tenantId, 'phone', normalizedPhone);
        }

        // Priority 3: Search by visitor ID (least reliable)
        if (!contact && normalizedVisitorId) {
            contact = await findContactByIdentifier(client, tenantId, 'visitor_id', normalizedVisitorId);
        }

        if (contact) {
            // Existing contact found - update missing fields and add new identifiers
            const updates = [];
            const params = [contact.id];
            let paramIndex = 2;

            if (name && !contact.name) {
                updates.push(`name = $${paramIndex++}`);
                params.push(name);
            }
            if (companyName && !contact.company_name) {
                updates.push(`company_name = $${paramIndex++}`);
                params.push(companyName);
            }
            // Update email/phone on main contact if missing
            if (normalizedEmail && !contact.email) {
                updates.push(`email = $${paramIndex++}`);
                params.push(normalizedEmail);
            }
            if (normalizedPhone && !contact.phone) {
                updates.push(`phone = $${paramIndex++}`);
                params.push(normalizedPhone);
            }

            if (updates.length > 0) {
                updates.push(`updated_at = now()`);
                await client.query(
                    `UPDATE contacts SET ${updates.join(', ')} WHERE id = $1`,
                    params
                );
            }

            // Add any new identifiers
            if (normalizedEmail) {
                const added = await addIdentifierIfNew(client, tenantId, contact.id, 'email', normalizedEmail, source);
                if (added) identifiersAdded.push('email');
            }
            if (normalizedPhone) {
                const added = await addIdentifierIfNew(client, tenantId, contact.id, 'phone', normalizedPhone, source);
                if (added) identifiersAdded.push('phone');
            }
            if (normalizedVisitorId) {
                const added = await addIdentifierIfNew(client, tenantId, contact.id, 'visitor_id', normalizedVisitorId, source);
                if (added) identifiersAdded.push('visitor_id');
            }

            // Refresh contact data
            const refreshed = await client.query(`SELECT * FROM contacts WHERE id = $1`, [contact.id]);
            contact = refreshed.rows[0];

        } else {
            // No existing contact - create new one
            const insertResult = await client.query(
                `INSERT INTO contacts (tenant_id, name, email, phone, source, company_name)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [tenantId, name || null, normalizedEmail, normalizedPhone, source || 'unknown', companyName || null]
            );
            contact = insertResult.rows[0];
            isNew = true;

            // Add identifiers
            if (normalizedEmail) {
                await addIdentifier(client, tenantId, contact.id, 'email', normalizedEmail, source, true);
                identifiersAdded.push('email');
            }
            if (normalizedPhone) {
                await addIdentifier(client, tenantId, contact.id, 'phone', normalizedPhone, source, true);
                identifiersAdded.push('phone');
            }
            if (normalizedVisitorId) {
                await addIdentifier(client, tenantId, contact.id, 'visitor_id', normalizedVisitorId, source, true);
                identifiersAdded.push('visitor_id');
            }
        }

        await client.query('COMMIT');

        return { contact, isNew, identifiersAdded };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('ContactResolver error:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Find contact by identifier
 */
async function findContactByIdentifier(client, tenantId, type, value) {
    const result = await client.query(
        `SELECT c.* FROM contacts c
         JOIN contact_identifiers ci ON ci.contact_id = c.id
         WHERE ci.tenant_id = $1 AND ci.identifier_type = $2 AND ci.identifier_value = $3`,
        [tenantId, type, value]
    );
    return result.rows[0] || null;
}

/**
 * Add identifier if it doesn't exist
 */
async function addIdentifierIfNew(client, tenantId, contactId, type, value, source) {
    try {
        await client.query(
            `INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, source)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING`,
            [tenantId, contactId, type, value, source || 'unknown']
        );
        return true;
    } catch (err) {
        // Duplicate - already exists for another contact
        return false;
    }
}

/**
 * Add identifier (primary)
 */
async function addIdentifier(client, tenantId, contactId, type, value, source, isPrimary = false) {
    await client.query(
        `INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, source, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING`,
        [tenantId, contactId, type, value, source || 'unknown', isPrimary]
    );
}

/**
 * Normalize phone number (remove formatting, keep digits and + prefix)
 */
function normalizePhone(phone) {
    if (!phone) return null;
    // Remove 'whatsapp:' prefix if present
    let normalized = phone.replace(/^whatsapp:/i, '');
    // Keep only digits and leading +
    normalized = normalized.replace(/[^\d+]/g, '');
    // Ensure + at start if it was there
    if (phone.startsWith('+') && !normalized.startsWith('+')) {
        normalized = '+' + normalized;
    }
    return normalized || null;
}

/**
 * Get all identifiers for a contact
 */
async function getContactIdentifiers(tenantId, contactId) {
    const result = await pool.query(
        `SELECT * FROM contact_identifiers 
         WHERE tenant_id = $1 AND contact_id = $2 
         ORDER BY identifier_type, is_primary DESC`,
        [tenantId, contactId]
    );
    return result.rows;
}

/**
 * Merge two contacts (keeps primary, merges secondary into it)
 */
async function mergeContacts(tenantId, primaryContactId, secondaryContactId, mergedBy = null) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get secondary contact data for audit
        const secondary = await client.query(
            `SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2`,
            [secondaryContactId, tenantId]
        );

        if (secondary.rows.length === 0) {
            throw new Error('Secondary contact not found');
        }

        // Move identifiers to primary contact
        await client.query(
            `UPDATE contact_identifiers 
             SET contact_id = $1, is_primary = false
             WHERE contact_id = $2 AND tenant_id = $3`,
            [primaryContactId, secondaryContactId, tenantId]
        );

        // Move conversations to primary contact
        await client.query(
            `UPDATE conversations SET contact_id = $1 WHERE contact_id = $2 AND tenant_id = $3`,
            [primaryContactId, secondaryContactId, tenantId]
        );

        // Log the merge
        await client.query(
            `INSERT INTO contact_merge_history (tenant_id, primary_contact_id, merged_contact_id, merged_data, merge_reason, merged_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, primaryContactId, secondaryContactId, JSON.stringify(secondary.rows[0]), 'manual', mergedBy]
        );

        // Delete secondary contact
        await client.query(
            `DELETE FROM contacts WHERE id = $1 AND tenant_id = $2`,
            [secondaryContactId, tenantId]
        );

        await client.query('COMMIT');

        return { success: true, mergedContactId: secondaryContactId };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Merge contacts error:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    // New functions (preferred)
    findContact,              // Lookup only - returns null if not found
    createContact,            // Explicit creation only
    
    // Legacy function (backward compatibility)
    findOrCreateContactLegacy,
    findOrCreateContact: findOrCreateContactLegacy, // Alias for existing code
    
    // Utility functions
    getContactIdentifiers,
    mergeContacts,
    normalizePhone
};
