/**
 * Twilio Service
 * 
 * Handles Twilio call initiation for bulk phone calling
 */

const twilio = require('twilio');
const { pool } = require('../../config/db');

/**
 * Make an outbound call via Twilio
 * @param {string} toNumber - Destination phone number
 * @param {string} fromNumber - Caller ID (tenant's Twilio number)
 * @param {string} sessionId - Call session ID for WebSocket URL
 * @param {string} tenantId - Tenant ID for config lookup
 * @returns {Promise<Object>} Twilio call object with sid
 */
async function makeCall(toNumber, fromNumber, sessionId, tenantId) {
    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
    }
    
    // Generate WebSocket URL for realtime session
    const host = process.env.HOST || 'localhost:8000';
    const wsPath = `/phone-ws/realtime/${sessionId}`;
    const wsUrl = `wss://${host}${wsPath}`;
    
    // Generate TwiML with Stream
    const twiml = `
        <Response>
            <Connect>
                <Stream url="${wsUrl}" />
            </Connect>
        </Response>
    `;
    
    // Create Twilio client and initiate call
    const client = twilio(accountSid, authToken);
    
    const call = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        twiml,
        statusCallback: `https://${host}/api/phone/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });
    
    console.log(`[TwilioService] Call initiated: ${call.sid} to ${toNumber}`);
    
    return call;
}

/**
 * Get Twilio configuration for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Config with accountSid, authToken, phoneNumber
 */
async function getTwilioConfig(tenantId) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured in environment');
    }
    
    // Get tenant's phone number from database
    const result = await pool.query(
        `SELECT phone_number FROM tenant_phone_config 
         WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
        [tenantId]
    );
    
    let phoneNumber = process.env.PHONE_NUMBER_FROM; // Fallback
    
    if (result.rows.length > 0) {
        phoneNumber = result.rows[0].phone_number;
    }
    
    return {
        accountSid,
        authToken,
        phoneNumber
    };
}

/**
 * End a Twilio call
 * @param {string} callSid - Twilio Call SID
 * @param {string} tenantId - Tenant ID
 */
async function endCall(callSid, tenantId) {
    const config = await getTwilioConfig(tenantId);
    const client = twilio(config.accountSid, config.authToken);
    
    await client.calls(callSid).update({ status: 'completed' });
    console.log(`[TwilioService] Call ended: ${callSid}`);
}

module.exports = {
    makeCall,
    getTwilioConfig,
    endCall
};
