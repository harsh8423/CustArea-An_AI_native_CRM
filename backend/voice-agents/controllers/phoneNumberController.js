/**
 * Phone Number Controller
 * Handles phone number provisioning and management
 */

const { pool } = require('../../config/db');

/**
 * GET /api/phone-numbers
 * List all phone numbers for tenant (granted and pending)
 */
async function listPhoneNumbers(req, res) {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT 
                tap.*,
                tpc.id as voice_agent_id,
                tpc.voice_agent_name,
                tpc.is_active as agent_active
            FROM tenants_allowed_phones tap
            LEFT JOIN tenant_phone_config tpc ON tap.phone_number = tpc.phone_number
            WHERE tap.tenant_id = $1
            ORDER BY tap.created_at DESC
        `, [tenantId]);

        res.json({ phoneNumbers: result.rows });
    } catch (error) {
        console.error('[PhoneNumber] Error listing phone numbers:', error);
        res.status(500).json({ error: 'Failed to list phone numbers' });
    }
}

/**
 * GET /api/phone-numbers/available
 * Get phone numbers that are not linked to any voice agent
 */
async function getAvailablePhoneNumbers(req, res) {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(`
            SELECT tap.*
            FROM tenants_allowed_phones tap
            LEFT JOIN tenant_phone_config tpc ON tap.phone_number = tpc.phone_number
            WHERE tap.tenant_id = $1 
              AND tap.is_granted = true
              AND tpc.id IS NULL
            ORDER BY tap.created_at DESC
        `, [tenantId]);

        res.json({ phoneNumbers: result.rows });
    } catch (error) {
        console.error('[PhoneNumber] Error getting available phone numbers:', error);
        res.status(500).json({ error: 'Failed to get available phone numbers' });
    }
}

/**
 * GET /api/phone-numbers/pricing
 * Get pricing information for all countries
 */
async function getPhonePricing(req, res) {
    try {
        const result = await pool.query(`
            SELECT * FROM x_phone_pricing 
            WHERE is_active = true
            ORDER BY country_name ASC
        `);

        res.json({ pricing: result.rows });
    } catch (error) {
        console.error('[PhoneNumber] Error getting pricing:', error);
        res.status(500).json({ error: 'Failed to get pricing information' });
    }
}

/**
 * GET /api/phone-numbers/pricing/:country
 * Get pricing for specific country
 */
async function getCountryPricing(req, res) {
    const { country } = req.params;

    try {
        const result = await pool.query(`
            SELECT * FROM x_phone_pricing 
            WHERE country_code = $1 AND is_active = true
        `, [country.toUpperCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pricing not available for this country' });
        }

        res.json({ pricing: result.rows[0] });
    } catch (error) {
        console.error('[PhoneNumber] Error getting country pricing:', error);
        res.status(500).json({ error: 'Failed to get country pricing' });
    }
}

/**
 * POST /api/phone-numbers/request
 * Request a new phone number
 */
async function requestPhoneNumber(req, res) {
    const tenantId = req.user.tenantId;
    const { countryCode, phoneType, notes } = req.body;

    // Validation
    if (!countryCode || !phoneType) {
        return res.status(400).json({ error: 'Missing required fields: countryCode, phoneType' });
    }

    if (!['local', 'toll-free'].includes(phoneType)) {
        return res.status(400).json({ error: 'phoneType must be either "local" or "toll-free"' });
    }

    try {
        // Get pricing info
        const pricingResult = await pool.query(`
            SELECT * FROM x_phone_pricing WHERE country_code = $1 AND is_active = true
        `, [countryCode.toUpperCase()]);

        if (pricingResult.rows.length === 0) {
            return res.status(400).json({ error: 'Country not available for phone number provisioning' });
        }

        const pricing = pricingResult.rows[0];
        const monthlyCost = phoneType === 'toll-free' 
            ? pricing.tollfree_monthly_cost 
            : pricing.local_monthly_cost;

        if (monthlyCost === null) {
            return res.status(400).json({ error: `${phoneType} numbers not available for ${pricing.country_name}` });
        }

        // Generate a placeholder phone number (will be replaced when admin grants)
        const placeholderNumber = `+PENDING-${Date.now()}`;

        // Insert request
        const result = await pool.query(`
            INSERT INTO tenants_allowed_phones (
                tenant_id, phone_number, country_code, country_name, 
                phone_type, monthly_cost, is_granted, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, false, $7)
            RETURNING *
        `, [
            tenantId,
            placeholderNumber,
            countryCode.toUpperCase(),
            pricing.country_name,
            phoneType,
            monthlyCost,
            notes || null
        ]);

        console.log(`[PhoneNumber] Phone number requested for tenant ${tenantId}: ${phoneType} in ${pricing.country_name}`);
        res.status(201).json({ 
            phoneNumber: result.rows[0],
            message: 'Phone number request submitted. Please wait for admin approval.'
        });
    } catch (error) {
        console.error('[PhoneNumber] Error requesting phone number:', error);
        res.status(500).json({ error: 'Failed to request phone number' });
    }
}

/**
 * DELETE /api/phone-numbers/:id
 * Cancel phone number request (only if not granted or not in use)
 */
async function cancelPhoneNumberRequest(req, res) {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        // Check if phone number is in use by a voice agent
        const checkAgent = await pool.query(`
            SELECT tpc.id 
            FROM tenants_allowed_phones tap
            JOIN tenant_phone_config tpc ON tap.phone_number = tpc.phone_number
            WHERE tap.id = $1 AND tap.tenant_id = $2
        `, [id, tenantId]);

        if (checkAgent.rows.length > 0) {
            return res.status(400).json({ error: 'Cannot cancel: Phone number is in use by a voice agent' });
        }

        // Delete the request
        const result = await pool.query(`
            DELETE FROM tenants_allowed_phones 
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Phone number request not found' });
        }

        console.log(`[PhoneNumber] Cancelled phone number request ${id}`);
        res.json({ message: 'Phone number request cancelled', phoneNumber: result.rows[0] });
    } catch (error) {
        console.error('[PhoneNumber] Error cancelling phone number:', error);
        res.status(500).json({ error: 'Failed to cancel phone number request' });
    }
}

module.exports = {
    listPhoneNumbers,
    getAvailablePhoneNumbers,
    getPhonePricing,
    getCountryPricing,
    requestPhoneNumber,
    cancelPhoneNumberRequest
};
