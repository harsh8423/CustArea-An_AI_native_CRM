/**
 * Phone Controller
 * Handles call management, TwiML generation, and status callbacks
 */

const twilio = require('twilio');
const { pool } = require('../../config/db');
const callSessionManager = require('../services/callSessionManager');
const { getCallsForTenant, getCallBySid, persistMissedCall } = require('../services/phoneStorageService');
const { findOrCreateContact } = require('../../services/contactResolver');
const { shouldAgentRespond } = require('../../controllers/agentDeploymentController');

/**
 * Initiate an outbound call
 * POST /api/phone/call
 */
async function initiateCall(req, res) {
    const tenantId = req.user.tenantId;
    const { to, contactId, greeting, customInstruction } = req.body;
    // NOTE: method is no longer accepted from request body - it comes from database

    if (!to) {
        return res.status(400).json({ error: 'Phone number (to) is required' });
    }

    try {
        // Get tenant's Twilio credentials and voice agent method from database
        const twilioConfig = await getTwilioConfig(tenantId);
        if (!twilioConfig) {
            return res.status(400).json({ error: 'Twilio not configured for this tenant' });
        }

        // Use method from database (tenant_phone_config.default_method)
        const method = twilioConfig.method || 'realtime';
        
        console.log(`[Phone] Outbound call using method from database: ${method}`);

        // Validate method - currently only realtime is supported
        if (method === 'legacy') {
            return res.status(400).json({ 
                error: 'Legacy method is currently disabled. Please update your voice agent to use realtime method in voice agent settings.',
                hint: 'Go to Voice Agents settings and change the method to Realtime'
            });
        }

        // Create call session with phone numbers to prevent race condition
        const session = callSessionManager.create(
            tenantId, 
            contactId, 
            method, 
            'outbound',
            twilioConfig.phoneNumber,  // fromNumber
            to,                         // toNumber
            customInstruction           // customInstruction (new parameter)
        );

        // Generate WebSocket URL (always realtime)
        const host = process.env.HOST || 'localhost:8000';
        const wsPath = `/phone-ws/realtime/${session.id}`;
        const wsUrl = `wss://${host}${wsPath}`;

        // Generate TwiML - Standard Stream for both legacy and realtime
        const greetingText = greeting || 'Hello, please hold while we connect you.';
        const twiml = `
            <Response>
                <Say voice="Google.en-US-Chirp3-HD-Leda">${greetingText}</Say>
                <Connect>
                    <Stream url="${wsUrl}" />
                </Connect>
            </Response>
        `;

        // Initiate call via Twilio
        const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
        const call = await client.calls.create({
            to,
            from: twilioConfig.phoneNumber,
            twiml,
            statusCallback: `https://${host}/api/phone/status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        });

        // Link call SID to session
        callSessionManager.linkCallSid(session.id, call.sid);

        console.log(`[Phone] Outbound call initiated: ${call.sid} (method: ${method})`);

        res.json({
            success: true,
            callSid: call.sid,
            sessionId: session.id,
            method
        });

    } catch (error) {
        console.error('[Phone] Error initiating call:', error);
        res.status(500).json({ error: 'Failed to initiate call', details: error.message });
    }
}

/**
 * Handle inbound call webhook
 * GET/POST /twiml or /api/phone/inbound
 * 
 * Routing Logic:
 * - If AI phone deployment is ACTIVE + within schedule → Route to AI Agent
 * - Otherwise → Route to browser client for human agent
 */
async function handleInbound(req, res) {
    // Twilio sends params in query (GET) or body (POST)
    const params = { ...req.query, ...req.body };
    const { From, To, CallSid } = params;

    console.log(`[Phone] Inbound call from ${From} to ${To}`);

    try {
        // Resolve tenant by phone number
        const tenant = await getTenantByPhone(To);
        if (!tenant) {
            console.error('[Phone] Unknown phone number:', To);
            return res.type('text/xml').send(`
                <Response>
                    <Say>Sorry, this number is not configured. Goodbye.</Say>
                    <Hangup />
                </Response>
            `);
        }

        // Find or create contact
        const { contact } = await findOrCreateContact(
            tenant.id,
            { phone: From },
            { source: 'phone' }
        );

        // Check if AI should handle this call
        const aiShouldHandle = await shouldAgentRespond(tenant.id, 'phone');
        console.log(`[Phone] AI should handle: ${aiShouldHandle} for tenant ${tenant.id}`);

        if (aiShouldHandle) {
            // Route to AI Agent
            return await routeToAI(req, res, tenant, contact, From, To, CallSid);
        } else {
            // Route to browser client for human agent
            return await routeToBrowserClient(req, res, tenant, contact, From, To, CallSid);
        }

    } catch (error) {
        console.error('[Phone] Error handling inbound:', error);
        res.type('text/xml').send(`
            <Response>
                <Say>Sorry, we encountered an error. Please try again later.</Say>
                <Hangup />
            </Response>
        `);
    }
}

/**
 * Route inbound call to AI Agent
 */
async function routeToAI(req, res, tenant, contact, From, To, CallSid) {
    // Get configured method for tenant (default: realtime)
    const method = tenant.default_method || 'realtime';

    // Validate method - currently only realtime is supported
    if (method === 'legacy') {
        console.error('[Phone] Legacy method not supported for inbound calls');
        return res.type('text/xml').send(`
            <Response>
                <Say>Sorry, this voice agent is configured with an unsupported method. Please contact support.</Say>
                <Hangup />
            </Response>
        `);
    }

    // Create session with phone numbers to prevent race condition
    const session = callSessionManager.create(
        tenant.id, 
        contact.id, 
        method, 
        'inbound',
        From,  // fromNumber
        To     // toNumber
    );
    callSessionManager.linkCallSid(session.id, CallSid);

    // Generate WebSocket URL
    const host = process.env.HOST || 'localhost:8000';
    const wsPath = `/phone-ws/realtime/${session.id}`;  // Always realtime now

    const wsUrl = `wss://${host}${wsPath}`;

    // Generate TwiML - Standard Stream
    const twiml = `
        <Response>
            <Connect>
                <Stream url="${wsUrl}" />
            </Connect>
        </Response>
    `;

    console.log(`[Phone] Inbound call routed to AI: ${CallSid} (method: ${method})`);
    res.type('text/xml').send(twiml);
}

/**
 * Route inbound call to browser client for human agent
 */
async function routeToBrowserClient(req, res, tenant, contact, From, To, CallSid) {
    // The browser client identity - simplified format without dashes
    const clientIdentity = `agent-${tenant.id.replace(/-/g, '')}`;

    // Log this call for tracking (in case it's missed)
    await pool.query(`
        INSERT INTO phone_calls (
            tenant_id, contact_id, call_sid, direction, status,
            from_number, to_number, method, started_at
        ) VALUES ($1, $2, $3, 'inbound', 'ringing', $4, $5, 'browser', now())
        ON CONFLICT (call_sid) DO NOTHING
    `, [tenant.id, contact.id, CallSid, From, To]);

    // SIMPLIFIED TwiML - no action URL for debugging
    // This should just ring the browser client for 30 seconds
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Dial callerId="${To}" timeout="30">
<Client>${clientIdentity}</Client>
</Dial>
<Say>The call was not answered. Goodbye.</Say>
</Response>`;

    console.log('[Phone] ============================================');
    console.log('[Phone] Inbound call routed to browser client');
    console.log('[Phone] Client identity:', clientIdentity);
    console.log('[Phone] TwiML being sent:');
    console.log(twiml);
    console.log('[Phone] ============================================');
    
    res.type('text/xml').send(twiml);
}

/**
 * Handle call status callback
 * POST /api/phone/status
 */
async function handleStatusCallback(req, res) {
    const { CallSid, CallStatus, CallDuration } = req.body;

    console.log(`[Phone] Status callback: ${CallSid} - ${CallStatus}`);

    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'canceled') {
        const session = callSessionManager.getByCallSid(CallSid);
        if (session) {
            callSessionManager.end(session.id);

            // TODO: Save call record to database
            // await saveCallRecord(session, CallDuration);
        }
    }

    res.status(200).send('OK');
}

/**
 * List active calls
 * GET /api/phone/calls/active
 */
async function getActiveCalls(req, res) {
    const tenantId = req.user.tenantId;

    const activeSessions = callSessionManager.getActiveSessions()
        .filter(s => s.tenantId === tenantId)
        .map(s => ({
            sessionId: s.id,
            callSid: s.callSid,
            method: s.method,
            direction: s.direction,
            duration: s.getDuration(),
            status: s.status
        }));

    res.json({ calls: activeSessions, count: activeSessions.length });
}

/**
 * List call history
 * GET /api/phone/calls
 */
async function getCallHistory(req, res) {
    const tenantId = req.user.tenantId;
    const { limit = 50, offset = 0, status, direction } = req.query;

    try {
        const calls = await getCallsForTenant(tenantId, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            status,
            direction
        });

        res.json({ calls, count: calls.length });
    } catch (error) {
        console.error('[Phone] Error getting call history:', error);
        res.status(500).json({ error: 'Failed to get call history' });
    }
}

/**
 * Get call details with transcript
 * GET /api/phone/calls/:callSid
 */
async function getCallDetails(req, res) {
    const tenantId = req.user.tenantId;
    const { callSid } = req.params;

    try {
        const call = await getCallBySid(callSid);
        
        if (!call || call.tenant_id !== tenantId) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Get transcript messages
        const messagesResult = await pool.query(`
            SELECT m.*, mpm.from_number, mpm.to_number
            FROM messages m
            LEFT JOIN message_phone_metadata mpm ON mpm.message_id = m.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
        `, [call.conversation_id]);

        res.json({
            call,
            messages: messagesResult.rows
        });
    } catch (error) {
        console.error('[Phone] Error getting call details:', error);
        res.status(500).json({ error: 'Failed to get call details' });
    }
}

/**
 * End a call
 * POST /api/phone/calls/:callSid/end
 */
async function endCall(req, res) {
    const tenantId = req.user.tenantId;
    const { callSid } = req.params;

    try {
        const session = callSessionManager.getByCallSid(callSid);
        if (!session || session.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Get Twilio config and hang up
        const twilioConfig = await getTwilioConfig(tenantId);
        if (twilioConfig) {
            const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
            await client.calls(callSid).update({ status: 'completed' });
        }

        callSessionManager.end(session.id);

        res.json({ success: true, message: 'Call ended' });

    } catch (error) {
        console.error('[Phone] Error ending call:', error);
        res.status(500).json({ error: 'Failed to end call' });
    }
}

// ========== Helper Functions ==========

/**
 * Get Twilio config for tenant
 * Credentials come from environment variables
 * Phone number comes from tenant_phone_config
 */
async function getTwilioConfig(tenantId) {
    // Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
        console.error('[Phone] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in environment');
        return null;
    }

    // Query tenant_phone_config for phone number and voice settings
    const result = await pool.query(
        `SELECT phone_number, default_method 
         FROM tenant_phone_config 
         WHERE tenant_id = $1 AND is_active = true 
         LIMIT 1`,
        [tenantId]
    );

    if (result.rows.length > 0) {
        return {
            accountSid,
            authToken,
            phoneNumber: result.rows[0].phone_number,
            method: result.rows[0].default_method || 'realtime'
        };
    }

    // Fallback to environment variables
    if (process.env.PHONE_NUMBER_FROM) {
        return {
            accountSid,
            authToken,
            phoneNumber: process.env.PHONE_NUMBER_FROM,
            method: 'realtime'
        };
    }

    return null;
}

/**
 * Get tenant by phone number
 */
async function getTenantByPhone(phoneNumber) {
    const result = await pool.query(
        `SELECT t.*, tpc.phone_number as configured_phone, tpc.default_method
         FROM tenants t
         JOIN tenant_phone_config tpc ON tpc.tenant_id = t.id
         WHERE tpc.phone_number = $1 AND tpc.is_active = true
         LIMIT 1`,
        [phoneNumber]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Fallback: check if env phone matches
    if (phoneNumber === process.env.PHONE_NUMBER_FROM) {
        // Return a default tenant (first active tenant)
        const fallback = await pool.query(`SELECT * FROM tenants LIMIT 1`);
        return fallback.rows[0] || null;
    }

    return null;
}

/**
 * Handle missed call (Dial action callback)
 * POST /api/phone/missed
 */
async function handleMissedCall(req, res) {
    const params = { ...req.query, ...req.body };
    const { CallSid, DialCallStatus, TenantId } = params;

    console.log(`[Phone] Call ${CallSid} ended with status: ${DialCallStatus}`);

    try {
        // If the call was not answered, mark it as missed
        if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || DialCallStatus === 'failed') {
            // Update phone_calls record to missed status
            await pool.query(`
                UPDATE phone_calls 
                SET status = 'missed', ended_at = now()
                WHERE call_sid = $1
            `, [CallSid]);

            // Create a conversation record for the missed call
            const callResult = await pool.query(
                `SELECT * FROM phone_calls WHERE call_sid = $1`,
                [CallSid]
            );

            if (callResult.rows.length > 0) {
                const call = callResult.rows[0];
                
                // Create conversation with missed call message
                const convResult = await pool.query(`
                    INSERT INTO conversations (
                        tenant_id, contact_id, channel, channel_contact_id, 
                        status, subject, ai_enabled
                    ) VALUES ($1, $2, 'phone', $3, 'open', $4, false)
                    RETURNING id
                `, [
                    call.tenant_id,
                    call.contact_id,
                    call.from_number,
                    `Missed Call - ${new Date().toLocaleDateString()}`
                ]);

                // Add a system message about the missed call
                await pool.query(`
                    INSERT INTO messages (
                        tenant_id, conversation_id, direction, role, channel,
                        content_text, status, sent_at
                    ) VALUES ($1, $2, 'inbound', 'system', 'phone', $3, 'delivered', now())
                `, [
                    call.tenant_id,
                    convResult.rows[0].id,
                    `📞 Missed call from ${call.from_number}. Call duration: 0 seconds.`
                ]);

                // Link conversation to phone call
                await pool.query(`
                    UPDATE phone_calls SET conversation_id = $1 WHERE call_sid = $2
                `, [convResult.rows[0].id, CallSid]);

                console.log(`[Phone] Created missed call record for ${CallSid}`);
            }
        } else if (DialCallStatus === 'completed') {
            // Call was answered and completed
            await pool.query(`
                UPDATE phone_calls SET status = 'completed', ended_at = now() WHERE call_sid = $1
            `, [CallSid]);
        }

        // Return empty TwiML to end the call
        res.type('text/xml').send('<Response></Response>');

    } catch (error) {
        console.error('[Phone] Error handling missed call:', error);
        res.type('text/xml').send('<Response></Response>');
    }
}

/**
 * Handle browser outbound call (TwiML App callback)
 * POST /api/phone/browser-outbound
 */
async function handleBrowserOutbound(req, res) {
    const params = { ...req.query, ...req.body };
    const { To, From } = params;

    console.log(`[Phone] Browser outbound call to ${To} from ${From}`);

    try {
        // The "From" here is the client identity (agent-{tenantId})
        // We need to get the actual phone number to use as caller ID
        const tenantMatch = From?.match(/agent-(.+)/);
        let callerNumber = process.env.PHONE_NUMBER_FROM;

        if (tenantMatch) {
            const tenantId = tenantMatch[1];
            const configResult = await pool.query(
                `SELECT phone_number FROM tenant_phone_config WHERE tenant_id = $1 AND is_active = true`,
                [tenantId]
            );
            if (configResult.rows.length > 0) {
                callerNumber = configResult.rows[0].phone_number;
            }
        }

        // TwiML to dial the destination number
        const twiml = `
            <Response>
                <Dial callerId="${callerNumber}">
                    <Number>${To}</Number>
                </Dial>
            </Response>
        `;

        res.type('text/xml').send(twiml);

    } catch (error) {
        console.error('[Phone] Error handling browser outbound:', error);
        res.type('text/xml').send(`
            <Response>
                <Say>Sorry, we could not connect your call. Please try again.</Say>
                <Hangup />
            </Response>
        `);
    }
}

module.exports = {
    initiateCall,
    handleInbound,
    handleStatusCallback,
    handleMissedCall,
    handleBrowserOutbound,
    getActiveCalls,
    getCallHistory,
    getCallDetails,
    endCall
};
