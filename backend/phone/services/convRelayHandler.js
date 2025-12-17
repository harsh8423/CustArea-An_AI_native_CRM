/**
 * Conversational Relay Call Handler
 * Uses Twilio's ConversationRelay - receives text, returns text
 * Twilio handles STT/TTS
 */

const WebSocket = require('ws');
const callSessionManager = require('./callSessionManager');
const { chat, getAgentForTenant } = require('../../ai-agent/services/agentService');

/**
 * Setup ConversationRelay WebSocket handler
 */
function setupConvRelayHandler() {
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', async (ws, req) => {
        const url = require('url');
        const parsedUrl = url.parse(req.url, true);
        
        // Extract sessionId from path: /phone-ws/convrelay/{sessionId}
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const sessionId = pathParts[pathParts.length - 1]; // Last segment is sessionId

        // Get session
        const session = callSessionManager.get(sessionId);
        if (!session) {
            console.error('[ConvRelay] No session found for:', sessionId);
            ws.close();
            return;
        }

        console.log(`[ConvRelay] Client connected - Session: ${sessionId}`);
        session.twilioWs = ws;
        session.status = 'active';

        // Handle messages from Twilio ConversationRelay
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('[ConvRelay] Received:', data.type);

                switch (data.type) {
                    case 'setup':
                        // Call setup - initialize session
                        callSessionManager.linkCallSid(sessionId, data.callSid);
                        console.log('[ConvRelay] Setup for call:', data.callSid);

                        // Send initial greeting for outbound calls
                        if (session.direction === 'outbound') {
                            const agent = await getAgentForTenant(session.tenantId);
                            const greeting = agent.welcomeMessage || "Hello! How can I help you today?";
                            sendTextResponse(ws, greeting, true);
                            session.addMessage('assistant', greeting);
                        }
                        break;

                    case 'prompt':
                        // User spoke - process with AI Agent
                        const userText = data.voicePrompt;
                        console.log('[ConvRelay] User said:', userText);
                        session.addMessage('user', userText);

                        // Process with AI Agent
                        const result = await chat(
                            session.tenantId,
                            session.conversationId,
                            session.contactId,
                            userText,
                            session.getFormattedHistory().slice(0, -1)
                        );

                        const response = result.response;
                        session.addMessage('assistant', response);

                        // Send response back
                        sendTextResponse(ws, response, true);
                        console.log('[ConvRelay] Agent said:', response);

                        // Handle escalation
                        if (result.metadata?.escalate) {
                            console.log('[ConvRelay] Escalation triggered');
                            // TODO: Transfer to human agent
                        }
                        break;

                    case 'interrupt':
                        // User interrupted - acknowledge
                        console.log('[ConvRelay] User interrupted');
                        break;

                    case 'dtmf':
                        // DTMF tone pressed
                        console.log('[ConvRelay] DTMF:', data.digit);
                        break;

                    case 'end':
                        // Call ended
                        console.log('[ConvRelay] Call ended');
                        callSessionManager.end(sessionId);
                        break;

                    default:
                        console.log('[ConvRelay] Unknown event:', data.type);
                }
            } catch (e) {
                console.error('[ConvRelay] Error processing message:', e);
                sendTextResponse(ws, "I'm sorry, I encountered an error. Please try again.", true);
            }
        });

        ws.on('close', () => {
            console.log('[ConvRelay] WebSocket disconnected');
            callSessionManager.end(sessionId);
        });

        ws.on('error', (err) => {
            console.error('[ConvRelay] WebSocket error:', err);
            callSessionManager.end(sessionId);
        });
    });

    return wss;
}

/**
 * Send text response to ConversationRelay
 */
function sendTextResponse(ws, text, isLast = false) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // ConversationRelay expects streaming tokens
    // Send as single response with last=true for simplicity
    // Could be enhanced to stream word-by-word for faster TTS start
    ws.send(JSON.stringify({
        type: 'text',
        token: text,
        last: isLast
    }));
}

module.exports = { setupConvRelayHandler };
