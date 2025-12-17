/**
 * OpenAI Realtime Call Handler
 * Uses OpenAI's native audio-to-audio API for lowest latency
 */

const WebSocket = require('ws');
const callSessionManager = require('./callSessionManager');
const { appendTranscript, persistCallToDatabase } = require('./phoneStorageService');
const { buildSystemPrompt, getAgentForTenant } = require('../../ai-agent/services/agentService');

// OpenAI Realtime event types to log
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'response.done',
    'input_audio_buffer.speech_started',
    'input_audio_buffer.speech_stopped',
    'session.created',
    'session.updated',
];

/**
 * Setup OpenAI Realtime WebSocket handler
 */
function setupRealtimeHandler() {
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', async (twilioWs, req) => {
        const url = require('url');
        const parsedUrl = url.parse(req.url, true);
        
        // Extract sessionId from path: /phone-ws/realtime/{sessionId}
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const sessionId = pathParts[pathParts.length - 1]; // Last segment is sessionId

        // Get session
        const session = callSessionManager.get(sessionId);
        if (!session) {
            console.error('[Realtime] No session found for:', sessionId);
            twilioWs.close();
            return;
        }

        console.log(`[Realtime] Client connected - Session: ${sessionId}`);
        session.twilioWs = twilioWs;
        session.status = 'active';

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('[Realtime] OpenAI API key missing');
            twilioWs.close();
            return;
        }

        // Connect to OpenAI Realtime
        const openAiWs = new WebSocket(
            `wss://api.openai.com/v1/realtime?model=gpt-realtime-mini`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'OpenAI-Beta': 'realtime=v1',
                },
            }
        );
        session.openaiWs = openAiWs;

        // Send session update with AI Agent's system prompt
        const sendSessionUpdate = async () => {
            try {
                const agent = await getAgentForTenant(session.tenantId);
                const systemPrompt = await buildSystemPrompt(session.tenantId, agent._id);

                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        modalities: ['audio', 'text'],
                        instructions: systemPrompt,
                        voice: agent.realtimeVoice || 'coral',
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        input_audio_transcription: {
                            model: 'whisper-1',
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 200,
                        },
                    },
                };

                console.log('[Realtime] Sending session update');
                openAiWs.send(JSON.stringify(sessionUpdate));
            } catch (error) {
                console.error('[Realtime] Failed to build system prompt:', error);
            }
        };

        // OpenAI WebSocket open
        openAiWs.on('open', () => {
            console.log('[Realtime] Connected to OpenAI');
            setTimeout(sendSessionUpdate, 250);
        });

        // Handle OpenAI messages
        let isResponseActive = false; // Track if AI is currently generating a response
        openAiWs.on('message', async (data) => {
            try {
                const msg = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(msg.type)) {
                    console.log('[Realtime] OpenAI event:', msg.type);
                    if (msg.type === 'error') {
                        // Ignore response_cancel_not_active - it's harmless
                        if (msg.error?.code !== 'response_cancel_not_active') {
                            console.error('[Realtime] Error:', JSON.stringify(msg, null, 2));
                        }
                    }
                }

                // Track response state
                if (msg.type === 'response.created') {
                    isResponseActive = true;
                }
                if (msg.type === 'response.done') {
                    isResponseActive = false;
                }

                // === BARGE-IN HANDLING ===
                // When user starts speaking, cancel current response and clear audio
                if (msg.type === 'input_audio_buffer.speech_started') {
                    console.log('[Realtime] Barge-in detected - user started speaking');
                    
                    // Send clear event to Twilio to stop playing audio
                    if (twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
                        twilioWs.send(JSON.stringify({
                            event: 'clear',
                            streamSid: session.streamSid
                        }));
                    }
                    
                    // Only cancel if there's an active response
                    if (isResponseActive && openAiWs.readyState === WebSocket.OPEN) {
                        openAiWs.send(JSON.stringify({
                            type: 'response.cancel'
                        }));
                    }
                }

                // Forward audio to Twilio
                if ((msg.type === 'response.audio.delta' || msg.type === 'response.output_audio.delta') && msg.delta) {
                    if (twilioWs.readyState === WebSocket.OPEN) {
                        twilioWs.send(JSON.stringify({
                            event: 'media',
                            streamSid: session.streamSid,
                            media: {
                                payload: msg.delta,
                            },
                        }));
                    }
                }

                // Track transcripts for history + Redis cache
                if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                    session.addMessage('user', msg.transcript);
                    await appendTranscript(sessionId, 'user', msg.transcript);
                    console.log('[Realtime] User said:', msg.transcript);
                }

                if (msg.type === 'response.audio_transcript.done') {
                    session.addMessage('assistant', msg.transcript);
                    await appendTranscript(sessionId, 'assistant', msg.transcript);
                    console.log('[Realtime] Agent said:', msg.transcript);
                }

            } catch (err) {
                console.error('[Realtime] Error processing OpenAI message:', err);
            }
        });

        openAiWs.on('error', (err) => {
            console.error('[Realtime] OpenAI WebSocket error:', err);
        });

        openAiWs.on('close', () => {
            console.log('[Realtime] OpenAI WebSocket closed');
            if (twilioWs.readyState === WebSocket.OPEN) {
                twilioWs.close();
            }
        });

        // Handle Twilio messages
        let audioChunkCount = 0;
        twilioWs.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'start':
                        session.streamSid = data.start.streamSid;
                        callSessionManager.linkCallSid(sessionId, data.start.callSid);
                        console.log('[Realtime] Twilio stream started:', session.streamSid);
                        break;

                    case 'media':
                        audioChunkCount++;
                        if (audioChunkCount === 1 || audioChunkCount % 100 === 0) {
                            console.log(`[Realtime] Audio chunks sent to OpenAI: ${audioChunkCount}`);
                        }
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.send(JSON.stringify({
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload,
                            }));
                        } else {
                            console.log('[Realtime] OpenAI WS not open, cannot send audio. State:', openAiWs.readyState);
                        }
                        break;

                    case 'stop':
                        console.log(`[Realtime] Twilio stream stopped. Total audio chunks: ${audioChunkCount}`);
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.close();
                        }
                        // Persist call to database before ending session
                        try {
                            await persistCallToDatabase(session);
                        } catch (err) {
                            console.error('[Realtime] Error persisting call:', err);
                        }
                        callSessionManager.end(sessionId);
                        break;

                    default:
                        console.log('[Realtime] Twilio event:', data.event);
                        break;
                }
            } catch (err) {
                console.error('[Realtime] Error parsing Twilio message:', err);
            }
        });

        twilioWs.on('close', () => {
            console.log('[Realtime] Twilio WebSocket disconnected');
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            callSessionManager.end(sessionId);
        });

        twilioWs.on('error', (err) => {
            console.error('[Realtime] Twilio WebSocket error:', err);
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            callSessionManager.end(sessionId);
        });
    });

    return wss;
}

module.exports = { setupRealtimeHandler };
