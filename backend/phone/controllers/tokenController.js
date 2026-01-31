/**
 * Token Controller
 * Generates Twilio Access Tokens for browser SDK
 * 
 * IMPORTANT: Twilio Voice SDK requires API Key credentials, NOT Account SID/Auth Token
 * Create an API Key at: https://console.twilio.com/us1/account/keys-credentials/api-keys
 */

const twilio = require('twilio');
const { pool } = require('../../config/db');

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * Get Twilio Access Token for browser calling
 * GET /api/phone/token
 * 
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_API_KEY: API Key SID (starts with SK...)
 * - TWILIO_API_SECRET: API Key Secret
 * - TWILIO_TWIML_APP_SID: TwiML App SID (starts with AP...)
 */
async function getAccessToken(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    try {
        // Account SID from environment variable (required)
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        if (!accountSid) {
            return res.status(400).json({ error: 'TWILIO_ACCOUNT_SID not configured in environment' });
        }

        // API Key and Secret are REQUIRED for Voice SDK tokens
        // These are different from Account SID and Auth Token!
        const apiKeySid = process.env.TWILIO_API_KEY;
        const apiKeySecret = process.env.TWILIO_API_SECRET;

        if (!apiKeySid || !apiKeySecret) {
            console.error('[Token] Missing TWILIO_API_KEY or TWILIO_API_SECRET');
            return res.status(400).json({ 
                error: 'API Key credentials not configured. Create an API Key at https://console.twilio.com/us1/account/keys-credentials/api-keys and add TWILIO_API_KEY and TWILIO_API_SECRET to your .env file.' 
            });
        }

        // TwiML App SID from environment variable
        const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
        if (!twimlAppSid) {
            return res.status(400).json({ 
                error: 'TwiML App SID not configured. Create a TwiML App in Twilio Console and add TWILIO_TWIML_APP_SID to your .env file.' 
            });
        }

        // Get tenant's phone number from tenant_phone_config (optional)
        let phoneNumber = null;
        const configResult = await pool.query(
            `SELECT phone_number FROM tenant_phone_config WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
            [tenantId]
        );
        
        if (configResult.rows.length > 0) {
            phoneNumber = configResult.rows[0].phone_number;
        } else {
            // Fallback to environment variable
            phoneNumber = process.env.PHONE_NUMBER_FROM;
        }

        // Create unique identity for this browser client
        // IMPORTANT: Must match the identity used in TwiML <Client> element
        const identity = `agent-${tenantId.replace(/-/g, '')}`;

        // Create access token using API Key credentials
        const accessToken = new AccessToken(
            accountSid,
            apiKeySid,
            apiKeySecret,
            { identity: identity, ttl: 3600 }
        );

        // Create voice grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twimlAppSid,
            incomingAllow: true
        });

        accessToken.addGrant(voiceGrant);

        // DEBUGGING - Log all important values
        console.log('[Token] ============================================');
        console.log('[Token] Generated access token for:', identity);
        console.log('[Token] Account SID:', accountSid);
        console.log('[Token] API Key SID:', apiKeySid);
        console.log('[Token] TwiML App SID:', twimlAppSid);
        console.log('[Token] incomingAllow: true');
        console.log('[Token] ============================================');

        res.json({
            token: accessToken.toJwt(),
            identity: identity,
            phoneNumber: phoneNumber
        });

    } catch (error) {
        console.error('[Token] Error generating access token:', error);
        res.status(500).json({ error: 'Failed to generate access token', details: error.message });
    }
}

module.exports = {
    getAccessToken
};
