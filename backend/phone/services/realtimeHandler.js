/**
 * OpenAI Realtime Call Handler - OPTIMIZED
 * Uses OpenAI's native audio-to-audio API for lowest latency
 * 
 * OPTIMIZATIONS:
 * - Parallel execution for config fetching and prompt building
 * - Dynamic voice agent config from PostgreSQL
 * - AI-first greeting with welcome message
 * - Function tools integration (7 tools)
 */

const WebSocket = require('ws');
const callSessionManager = require('./callSessionManager');
const { persistCallToDatabase, createConversationForCall } = require('./phoneStorageService');
const { buildSystemPrompt, getAgentForTenant } = require('../../ai-agent/services/agentService');
const { getVoiceAgentConfigFromSession, validateVoiceAgentConfig } = require('./voiceAgentConfigService');
const { VOICE_AGENT_TOOLS, executeVoiceAgentTool } = require('./voiceAgentTools');

// OpenAI Realtime event types to log
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'response.done',
    'input_audio_buffer.speech_started',
    'input_audio_buffer.speech_stopped',
    'session.created',
    'session.updated',
    'response.function_call_arguments.done',
];

/**
 * Build complete system prompt combining MongoDB Agent + PostgreSQL voice agent
 * @param {string} tenantId - Tenant ID
 * @param {object} voiceAgentConfig - Voice agent configuration from database
 * @param {string} perCallInstruction - Optional per-call custom instruction (takes priority)
 */
async function buildCompleteSystemPrompt(tenantId, voiceAgentConfig, perCallInstruction = null) {
    try {
        // Get MongoDB agent (for tenant-wide settings)
        const agent = await getAgentForTenant(tenantId);
        
        // Build base system prompt from MongoDB
        const basePrompt = await buildSystemPrompt(tenantId, agent._id);
        
        // Add voice agent specific instructions if available
        let completePrompt = basePrompt;
        
        // PRIORITY 1: Per-call custom instruction (if provided)
        if (perCallInstruction && perCallInstruction.trim()) {
            completePrompt += '\n\n## 🎯 PRIORITY INSTRUCTIONS FOR THIS CALL\n';
            completePrompt += perCallInstruction.trim();
            completePrompt += '\n\nThese instructions MUST be followed for this specific call and take priority over any other instructions below.';
        }
        
        // PRIORITY 2: Voice agent custom instructions (global for this tenant)
        if (voiceAgentConfig.customInstructions) {
            completePrompt += '\n\n## VOICE AGENT INSTRUCTIONS\n';
            completePrompt += voiceAgentConfig.customInstructions;
        }
        
        // Add phone call specific context
        completePrompt += '\n\n## CALL CONTEXT\n';
        completePrompt += `You are ${voiceAgentConfig.agentName}, a voice AI assistant handling a phone call.\n`;
        completePrompt += 'Respond naturally and conversationally. Keep responses concise for voice.\n';
        completePrompt += 'You have access to tools to help the customer - use them when appropriate.\n';
        
        return completePrompt;
    } catch (error) {
        console.error('[Realtime] Error building system prompt:', error);
        // Fallback to simple prompt
        return `You are ${voiceAgentConfig.agentName}, a helpful AI assistant. Be concise and natural in your responses.`;
    }
}

/**
 * Add transcript to session's in-memory array
 * Merges consecutive messages from same speaker
 * Actions are always kept separate
 */
function addTranscript(session, speaker, text, metadata = null) {
    if (!text || !text.trim()) return;  // Skip empty messages
    
    const now = new Date();
    const transcripts = session.transcripts || [];
    
    // Initialize sequence counter if not exists
    if (!session.transcriptSequence) {
        session.transcriptSequence = 0;
    }
    
    // Check if we can merge with previous message
    const canMerge = transcripts.length > 0 && 
                     session.lastSpeaker === speaker && 
                     speaker !== 'action';  // Never merge actions
    
    if (canMerge) {
        // Merge with previous message
        const lastTranscript = transcripts[transcripts.length - 1];
        lastTranscript.text = lastTranscript.text.trim() + ' ' + text.trim();
        lastTranscript.updated_at = now;
        console.log(`[Realtime] Merged ${speaker} message: "${text.substring(0, 50)}..."`);
    } else {
        // Add new message with sequence number for guaranteed ordering
        session.transcriptSequence++;
        transcripts.push({
            speaker: speaker,  // 'user', 'assistant', 'action'
            text: text.trim(),
            metadata: metadata,
            created_at: now,
            sequence: session.transcriptSequence  // Guaranteed order
        });
        session.lastSpeaker = speaker;
        
        if (speaker === 'action') {
            console.log(`[Realtime] Action logged: ${text}`);
        } else {
            console.log(`[Realtime] ${speaker === 'user' ? 'User' : 'Agent'} said: ${text.substring(0, 50)}..."`);
        }
    }
    
    session.transcripts = transcripts;
}

/**
 * Send initial greeting message to make AI speak first
 * FIXED: Simplified approach that triggers response with instruction
 */
function sendInitialGreeting(openAiWs, welcomeMessage) {
    if (!welcomeMessage || welcomeMessage.trim() === '') {
        welcomeMessage = 'Hello! How can I help you today?';
    }

    console.log('[Realtime] Triggering initial greeting:', welcomeMessage);

    // Simply trigger a response.create with the greeting in the instructions
    // OpenAI will generate the audio naturally this way
    openAiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
            modalities: ['audio', 'text'],
            instructions: `Start this conversation by saying: "${welcomeMessage}"`
        }
    }));

    console.log('[Realtime] Initial greeting triggered');
}

/**
 * Setup OpenAI Realtime WebSocket handler
 */
function setupRealtimeHandler() {
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', async (twilioWs, req) => {
        const startTime = Date.now();
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
        console.log(`[Realtime] DEBUG Session properties:`, {
            toNumber: session.toNumber,
            fromNumber: session.fromNumber,
            method: session.method,
            direction: session.direction,
            tenantId: session.tenantId
        });
        session.twilioWs = twilioWs;
        session.status = 'active';
        
        // Initialize in-memory transcript storage
        session.transcripts = [];
        session.lastSpeaker = null;
        session.transcriptSequence = 0;  // For guaranteed ordering

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('[Realtime] OpenAI API key missing');
            twilioWs.close();
            return;
        }

        // === CRITICAL: REGISTER TWILIO HANDLER FIRST ===
        // Must register BEFORE any async work to catch the 'start' event
        let audioChunkCount = 0;
        let voiceAgentConfig, systemPrompt, openAiWs;
        
        twilioWs.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                // Log ALL events from Twilio for debugging
                if (data.event !== 'media') {
                    console.log('[Realtime] Twilio event received:', data.event, JSON.stringify(data).substring(0, 200));
                }

                switch (data.event) {
                    case 'start':
                        session.streamSid = data.start.streamSid;
                        callSessionManager.linkCallSid(sessionId, data.start.callSid);
                        console.log('[Realtime] Twilio stream started:', session.streamSid);
                        
                        // === AI-FIRST GREETING ===
                        // Send greeting if config is already loaded (may take 500ms+ to fetch)
                        setTimeout(async () => {
                            if (openAiWs && openAiWs.readyState === WebSocket.OPEN && voiceAgentConfig) {
                                console.log('[Realtime] Sending greeting (config loaded before start event)');
                                sendInitialGreeting(openAiWs, voiceAgentConfig.welcomeMessage);
                                // Greeting will be captured via response.audio_transcript.done event
                            } else {
                                console.log('[Realtime] Config not ready yet, greeting will be sent after config loads');
                            }
                        }, 500);
                        break;

                    case 'media':
                        audioChunkCount++;
                        if (audioChunkCount === 1 || audioChunkCount % 100 === 0) {
                            console.log(`[Realtime] Audio chunks sent to OpenAI: ${audioChunkCount}`);
                        }
                        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.send(JSON.stringify({
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload,
                            }));
                        }
                        break;

                    case 'stop':
                        console.log(`[Realtime] Twilio stream stopped. Total audio chunks: ${audioChunkCount}`);
                        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.close();
                        }
                        // NOTE: persistCallToDatabase moved to OpenAI WebSocket close handler
                        // to ensure all final transcripts are received before persisting
                        break;
                }

            } catch (err) {
                console.error('[Realtime] Error processing Twilio message:', err);
            }
        });

        twilioWs.on('close', async () => {
            console.log('[Realtime] Twilio WebSocket disconnected');
            session.end();
            if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
        });

        // === OPTIMIZATION: FETCH CONFIG FIRST ===
        // Need to get config before creating WebSocket to use correct model
        
        try {
            console.log('[Realtime] Fetching voice agent config...');
            const configStart = Date.now();
            
            // Fetch voice agent config first to get model name
            voiceAgentConfig = await getVoiceAgentConfigFromSession(session);
            
            if (!voiceAgentConfig) {
                console.error('[Realtime] No voice agent config found for phone:', session.toNumber);
                twilioWs.close();
                return;
            }

            // Validate config
            validateVoiceAgentConfig(voiceAgentConfig);
            
            console.log('[Realtime] Config fetched in', Date.now() - configStart, 'ms');
            console.log('[Realtime] Using model:', voiceAgentConfig.realtimeModel.modelName);
            
            // Now connect to OpenAI with the correct model from database
            const wsStart = Date.now();
            openAiWs = await new Promise((resolve, reject) => {
                const ws = new WebSocket(
                    `wss://api.openai.com/v1/realtime?model=${voiceAgentConfig.realtimeModel.modelName}`,
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'OpenAI-Beta': 'realtime=v1',
                        },
                    }
                );
                ws.on('open', () => {
                    console.log('[Realtime] OpenAI WebSocket connected with model:', voiceAgentConfig.realtimeModel.modelName);
                    resolve(ws);
                });
                ws.on('error', reject);
            });
            
            session.openaiWs = openAiWs;
            session.voiceAgentConfig = voiceAgentConfig;

            // Build system prompt (this can happen after WebSocket is connected)
            systemPrompt = await buildCompleteSystemPrompt(
                voiceAgentConfig.tenantId, 
                voiceAgentConfig,
                session.customInstruction  // Pass per-call custom instruction
            );

            const setupTime = Date.now() - startTime;
            console.log(`[Realtime] Setup completed in ${setupTime}ms`);

            // === CREATE CONVERSATION IMMEDIATELY ===
            // Create conversation NOW (synchronously) so tools have valid conversationId
            // This MUST happen before session update (before AI can call tools)
            try {
                const conversationId = await createConversationForCall(session);
                if (conversationId) {
                    session.conversationId = conversationId;
                    console.log('[Realtime] Conversation created for call:', conversationId);
                } else {
                    console.warn('[Realtime] Conversation creation failed, will retry at end');
                }
            } catch (err) {
                console.error('[Realtime] Failed to create conversation at call start:', err);
                // Continue - will fallback to creating at end
            }

            // === SESSION UPDATE WITH VOICE AGENT CONFIG ===
            // WebSocket is already open, send session update immediately
            try {
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        modalities: ['audio', 'text'],
                        instructions: systemPrompt,
                        voice: voiceAgentConfig.realtimeModel.voiceName || 'sage',
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
                        tools: VOICE_AGENT_TOOLS,
                        tool_choice: 'auto'
                    },
                };

                console.log('[Realtime] Sending session update with voice:', voiceAgentConfig.realtimeModel.voiceName);
                console.log('[Realtime] Tools available:', VOICE_AGENT_TOOLS.length);
                openAiWs.send(JSON.stringify(sessionUpdate));

                // === SEND GREETING IF STREAM IS ALREADY STARTED ===
                // If Twilio 'start' event already fired (streamSid set), send greeting now
                // Otherwise, it will be sent when 'start' event fires
                setTimeout(async () => {
                    if (session.streamSid && openAiWs.readyState === WebSocket.OPEN) {
                        console.log('[Realtime] Sending greeting (streamSid already available)');
                        sendInitialGreeting(openAiWs, voiceAgentConfig.welcomeMessage);
                        // Greeting will be captured via response.audio_transcript.done event
                    } else {
                        console.log('[Realtime] Waiting for Twilio start event to send greeting...');
                    }
                }, 500);

            } catch (error) {
                console.error('[Realtime] Failed to send session update:', error);
            }

        } catch (error) {
            console.error('[Realtime] Error in parallel setup:', error);
            twilioWs.close();
            if (openAiWs) openAiWs.close();
            return;
        }

        // Handle OpenAI messages (register after session setup)

        // Handle OpenAI messages
        let isResponseActive = false; // Track if AI is currently generating a response
        let currentToolCall = null; // Track ongoing tool call
        
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

                // === FUNCTION TOOL CALLING ===
                // Handle function call arguments accumulation
                if (msg.type === 'response.function_call_arguments.delta') {
                    if (!currentToolCall) {
                        currentToolCall = {
                            call_id: msg.call_id,
                            name: msg.name,
                            arguments: ''
                        };
                    }
                    currentToolCall.arguments += msg.delta;
                }

                // Handle function call completion
                if (msg.type === 'response.function_call_arguments.done') {
                    console.log('[Realtime] Function call completed:', msg.name);
                    
                    try {
                        const args = JSON.parse(msg.arguments);
                        const toolContext = {
                            conversationId: session.conversationId,
                            contactId: session.contactId,
                            sessionId: session.sessionId
                        };

                        // Execute tool
                        const result = await executeVoiceAgentTool(
                            voiceAgentConfig.tenantId,
                            msg.name,
                            args,
                            toolContext
                        );

                        // Send tool result back to OpenAI
                        openAiWs.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'function_call_output',
                                call_id: msg.call_id,
                                output: JSON.stringify(result)
                            }
                        }));

                        // Trigger response with tool result
                        openAiWs.send(JSON.stringify({
                            type: 'response.create'
                        }));

                        console.log('[Realtime] Tool result sent to OpenAI');
                        
                        // Log function call as action in transcripts
                        addTranscript(session, 'action', msg.name, {
                            tool: msg.name,
                            args: args,
                            result: result
                        });

                    } catch (error) {
                        console.error('[Realtime] Error executing tool:', error);
                        
                        // Send error back to OpenAI
                        openAiWs.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'function_call_output',
                                call_id: msg.call_id,
                                output: JSON.stringify({
                                    error: true,
                                    message: 'I encountered an error executing that action.'
                                })
                            }
                        }));
                    }

                    currentToolCall = null;
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
                if (msg.type === 'response.audio.delta' && msg.delta) {
                    if (twilioWs.readyState === WebSocket.OPEN) {
                        if (!session.streamSid) {
                            console.error('[Realtime] Cannot forward audio - streamSid not set!');
                        } else {
                            twilioWs.send(JSON.stringify({
                                event: 'media',
                                streamSid: session.streamSid,
                                media: {
                                    payload: msg.delta,
                                },
                            }));
                        }
                    }
                }

                // Track transcripts for history
                if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                    session.addMessage('user', msg.transcript);
                    addTranscript(session, 'user', msg.transcript);
                    console.log('[Realtime] User said:', msg.transcript);
                }

                if (msg.type === 'response.audio_transcript.done') {
                    session.addMessage('assistant', msg.transcript);
                    addTranscript(session, 'assistant', msg.transcript);
                    console.log('[Realtime] Agent said:', msg.transcript);
                }

            } catch (err) {
                console.error('[Realtime] Error processing OpenAI message:', err);
            }
        });

        openAiWs.on('error', (err) => {
            console.error('[Realtime] OpenAI WebSocket error:', err);
        });

        openAiWs.on('close', async () => {
            console.log('[Realtime] OpenAI WebSocket closed');
            
            // Wait for final transcript events to process
            // Terminal logs show transcripts arrive 2-3 seconds after close event
            setTimeout(async () => {
                // Persist call to database after all transcripts are received
                try {
                    console.log('[Realtime] Persisting call to database...');
                    await persistCallToDatabase(session);
                } catch (err) {
                    console.error('[Realtime] Error persisting call:', err);
                }
            }, 3000); // 3 second delay to ensure ALL async transcript events are processed
            
            if (twilioWs.readyState === WebSocket.OPEN) {
                twilioWs.close();
            }
        });
    });

    return wss;
}

module.exports = { setupRealtimeHandler };
