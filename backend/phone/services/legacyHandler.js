/**
 * Legacy Call Handler
 * Uses Azure STT + AI Agent LLM + Azure TTS
 * Supports sentence-level streaming for low latency
 */

const WebSocket = require('ws');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const callSessionManager = require('./callSessionManager');
const { appendTranscript, persistCallToDatabase } = require('./phoneStorageService');
const { chat, buildSystemPrompt, getAgentForTenant } = require('../../ai-agent/services/agentService');

// Audio codec utilities
const mulaw = require('mu-law');

/**
 * Setup Legacy WebSocket handler
 */
function setupLegacyHandler() {
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', async (ws, req) => {
        const url = require('url');
        const parsedUrl = url.parse(req.url, true);
        
        // Extract sessionId from path: /phone-ws/legacy/{sessionId}
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const sessionId = pathParts[pathParts.length - 1]; // Last segment is sessionId

        // Get session
        const session = callSessionManager.get(sessionId);
        if (!session) {
            console.error('[Legacy] No session found for:', sessionId);
            ws.close();
            return;
        }

        console.log(`[Legacy] Client connected - Session: ${sessionId}`);
        session.twilioWs = ws;
        session.status = 'active';

        // Speech config
        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        if (!speechKey || !speechRegion) {
            console.error('[Legacy] Azure Speech credentials missing');
            ws.close();
            return;
        }

        // Setup Azure STT
        const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(8000, 16, 1);
        session.pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
        const audioConfig = sdk.AudioConfig.fromStreamInput(session.pushStream);
        const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
        speechConfig.speechRecognitionLanguage = 'en-US';

        // Configure endpoint for region
        const endpoint = `wss://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_Endpoint, endpoint);
        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "3000");

        session.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        // Barge-in detection
        session.recognizer.recognizing = (s, e) => {
            if (e.result.text && e.result.text.length > 0 && !session.isBargeIn) {
                console.log('[Legacy] Barge-in detected');
                session.isBargeIn = true;
                if (ws.readyState === WebSocket.OPEN && session.streamSid) {
                    ws.send(JSON.stringify({
                        event: 'clear',
                        streamSid: session.streamSid
                    }));
                }
            }
        };

        // Final recognition - process with AI Agent
        session.recognizer.recognized = async (s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                const userText = e.result.text;
                console.log('[Legacy] Recognized:', userText);

                session.isBargeIn = false;

                if (ws.readyState === WebSocket.OPEN) {
                    await processWithAIAgent(session, userText, ws);
                }
            }
        };

        session.recognizer.canceled = (s, e) => {
            console.error('[Legacy] Recognition canceled:', e.reason, e.errorDetails);
        };

        session.recognizer.sessionStopped = () => {
            console.log('[Legacy] Recognition session stopped');
        };

        // Start recognition
        session.recognizer.startContinuousRecognitionAsync(
            () => console.log('[Legacy] Recognition started'),
            (err) => console.error('[Legacy] Recognition start failed:', err)
        );

        // Handle Twilio messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'start':
                        session.streamSid = data.start.streamSid;
                        callSessionManager.linkCallSid(sessionId, data.start.callSid);
                        console.log('[Legacy] Stream started:', session.streamSid);

                        // Send greeting for outbound calls
                        if (session.direction === 'outbound') {
                            setTimeout(async () => {
                                const agent = await getAgentForTenant(session.tenantId);
                                const greeting = agent.welcomeMessage || "Hello! How can I help you today?";
                                await synthesizeAndSend(session, greeting, ws);
                            }, 500);
                        }
                        break;

                    case 'media':
                        if (data.media && data.media.payload) {
                            const mulawBytes = Buffer.from(data.media.payload, 'base64');
                            const pcmSamples = decodeMuLaw(mulawBytes);
                            const buffer = Buffer.from(pcmSamples.buffer);
                            session.pushStream.write(buffer);
                        }
                        break;

                    case 'stop':
                        console.log('[Legacy] Stream stopped');
                        // Persist call to database before ending session
                        try {
                            await persistCallToDatabase(session);
                        } catch (err) {
                            console.error('[Legacy] Error persisting call:', err);
                        }
                        callSessionManager.end(sessionId);
                        break;
                }
            } catch (e) {
                console.error('[Legacy] Error processing message:', e);
            }
        });

        ws.on('close', () => {
            console.log('[Legacy] WebSocket disconnected');
            callSessionManager.end(sessionId);
        });

        ws.on('error', (err) => {
            console.error('[Legacy] WebSocket error:', err);
            callSessionManager.end(sessionId);
        });
    });

    return wss;
}

/**
 * Process user message with AI Agent using streaming for low latency
 */
async function processWithAIAgent(session, userText, ws) {
    try {
        // Add to history and Redis cache
        session.addMessage('user', userText);
        await appendTranscript(session.id, 'user', userText);

        // Call AI Agent
        const result = await chat(
            session.tenantId,
            session.conversationId,
            session.contactId,
            userText,
            session.getFormattedHistory().slice(0, -1) // Exclude current message
        );

        const response = result.response;
        session.addMessage('assistant', response);
        await appendTranscript(session.id, 'assistant', response);

        // Check for escalation
        if (result.metadata?.escalate) {
            await synthesizeAndSend(session, response, ws);
            // TODO: Hand off to human agent
            return;
        }

        // Stream TTS in sentence chunks for low latency
        await streamTTSResponse(session, response, ws);

    } catch (error) {
        console.error('[Legacy] AI Agent error:', error);
        await synthesizeAndSend(session, "I apologize, but I'm having trouble processing your request.", ws);
    }
}

/**
 * Stream TTS response in sentence chunks
 */
async function streamTTSResponse(session, text, ws) {
    // Split into sentences for faster first response
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    for (const sentence of sentences) {
        if (session.isBargeIn) {
            console.log('[Legacy] Barge-in, stopping TTS');
            break;
        }
        await synthesizeAndSend(session, sentence.trim(), ws);
    }
}

/**
 * Synthesize text to audio and send to Twilio
 */
async function synthesizeAndSend(session, text, ws) {
    if (!text || session.isBargeIn || ws.readyState !== WebSocket.OPEN) return;

    try {
        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
        speechConfig.speechSynthesisVoiceName = process.env.AZURE_TTS_VOICE || 'en-US-JennyNeural';
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

        const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

        return new Promise((resolve, reject) => {
            synthesizer.speakTextAsync(
                text,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        const wavData = result.audioData;
                        
                        // Skip WAV header (44 bytes)
                        const headerSize = 44;
                        if (wavData.byteLength <= headerSize) {
                            resolve();
                            return;
                        }

                        const pcmData = new Int16Array(wavData.slice(headerSize));

                        // Downsample from 24kHz to 8kHz
                        const downsampleFactor = 3;
                        const downsampledLength = Math.floor(pcmData.length / downsampleFactor);
                        const downsampledPcm = new Int16Array(downsampledLength);

                        for (let i = 0; i < downsampledLength; i++) {
                            downsampledPcm[i] = pcmData[i * downsampleFactor];
                        }

                        // Encode to mu-law
                        const mulawBuffer = encodeMuLaw(downsampledPcm);

                        // Send to Twilio
                        if (!session.isBargeIn && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                event: 'media',
                                streamSid: session.streamSid,
                                media: {
                                    payload: mulawBuffer.toString('base64')
                                }
                            }));
                        }
                        resolve();
                    } else {
                        console.error('[Legacy] TTS failed:', result.errorDetails);
                        reject(new Error(result.errorDetails));
                    }
                    synthesizer.close();
                },
                (err) => {
                    console.error('[Legacy] TTS error:', err);
                    synthesizer.close();
                    reject(err);
                }
            );
        });
    } catch (error) {
        console.error('[Legacy] synthesizeAndSend error:', error);
    }
}

/**
 * Decode mu-law to PCM
 */
function decodeMuLaw(buffer) {
    const samples = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        samples[i] = mulaw.decode(buffer[i]);
    }
    return samples;
}

/**
 * Encode PCM to mu-law
 */
function encodeMuLaw(samples) {
    const buffer = Buffer.alloc(samples.length);
    for (let i = 0; i < samples.length; i++) {
        buffer[i] = mulaw.encode(samples[i]);
    }
    return buffer;
}

module.exports = { setupLegacyHandler };
