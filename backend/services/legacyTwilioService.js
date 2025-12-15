// services/legacyTwilioService.js
const WebSocket = require('ws');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { streamChatCompletion: streamOpenAI } = require('./llm/openaiService');
const { streamChatCompletion: streamGroq } = require('./llm/groqService');
const { buildPrompt } = require('../utils/promptBuilder');
const { AzureTTS } = require('./tts/ttsService');
const mulaw = require('mu-law');

function setupLegacyTwilioService() {
  const wss = new WebSocket.Server({ noServer: true });
  const tts = new AzureTTS();

  // Configuration: 'openai' or 'groq'
  const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
  const LLM_MODEL = process.env.LLM_MODEL; // Optional override

  wss.on('connection', (ws, req) => {
    console.log(`Client connected to Legacy Twilio WebSocket (LLM: ${LLM_PROVIDER})`);

    const url = require('url');
    const query = url.parse(req.url, true).query;
    const isOutbound = query.direction === 'outbound';

    let streamSid = null;
    let pushStream = null;
    let recognizer = null;

    let isBargeIn = false;

    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      console.error('Speech key or region missing');
      ws.close();
      return;
    }

    // Setup Speech SDK
    // Twilio sends 8kHz audio. We decode mu-law to PCM 8kHz.
    const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(8000, 16, 1);
    pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';

    // Fix for centralindia region DNS issues
    const endpoint = `wss://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_Endpoint, endpoint);
    
    // Increase silence timeout
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "3000");

    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
      // console.log('Recognizing:', e.result.text);
      if (e.result.text && e.result.text.length > 0) {
        if (!isBargeIn) {
            console.log('Barge-in detected, clearing audio');
            isBargeIn = true;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    event: 'clear',
                    streamSid: streamSid
                }));
            }
        }
      }
    };

    recognizer.recognized = async (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const userText = e.result.text;
        console.log('Recognized:', userText);
        
        // Reset barge-in for the new turn
        isBargeIn = false;

        if (ws.readyState === WebSocket.OPEN) {
          // Trigger Chat Completion
          const messages = [
            { role: "system", content: buildPrompt() },
            { role: "user", content: userText }
          ];
          
          let buffer = "";
          const streamFunction = LLM_PROVIDER === 'groq' ? streamGroq : streamOpenAI;
          const modelName = LLM_MODEL || undefined;

          await streamFunction(
            messages,
            modelName,
            async (chunk) => {
              if (isBargeIn) return; // Stop processing if barge-in occurred
              buffer += chunk;
              const sentenceMatch = buffer.match(/([.!?]+)\s+/);
              if (sentenceMatch) {
                const sentence = buffer.substring(0, sentenceMatch.index + sentenceMatch[0].length);
                buffer = buffer.substring(sentenceMatch.index + sentenceMatch[0].length);
                await sendAudio(sentence);
              }
            },
            async () => {
              if (isBargeIn) return; // Stop processing if barge-in occurred
              if (buffer.trim()) {
                await sendAudio(buffer);
              }
            }
          );
        }
      }
    };

    recognizer.canceled = (s, e) => {
      console.error('Canceled:', e.reason, e.errorDetails);
    };

    recognizer.sessionStopped = (s, e) => {
      console.log('Session stopped');
      recognizer.stopContinuousRecognitionAsync();
    };

    recognizer.startContinuousRecognitionAsync(
      () => console.log('Legacy Recognition started'),
      (err) => console.error('Legacy Recognition start failed', err)
    );

    async function sendAudio(text) {
      if (isBargeIn) return; // Don't send audio if barge-in occurred
      try {
        console.log('Sending audio:', text);
        const wavData = await tts.synthesizeToWavBytes(text);
        if (isBargeIn) return; // Check again after await

        // wavData is ArrayBuffer containing WAV file (RIFF header + PCM data)
        // AzureTTS configured for Riff24Khz16BitMonoPcm (24kHz)
        
        // 1. Skip WAV header (44 bytes usually)
        const headerSize = 44;
        if (wavData.byteLength <= headerSize) return;

        const pcmData = new Int16Array(wavData.slice(headerSize));

        // 2. Downsample from 24kHz to 8kHz (Factor of 3)
        const downsampleFactor = 3;
        const downsampledLength = Math.floor(pcmData.length / downsampleFactor);
        const downsampledPcm = new Int16Array(downsampledLength);
        
        for (let i = 0; i < downsampledLength; i++) {
          downsampledPcm[i] = pcmData[i * downsampleFactor];
        }

        // 3. Encode to mu-law
        const mulawBuffer = encodeMuLaw(downsampledPcm);
        
        // 4. Send to Twilio
        const payload = mulawBuffer.toString('base64');
        
        const mediaMessage = {
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: payload
          }
        };
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(mediaMessage));
        }
      } catch (err) {
        console.error('TTS/Encoding Error:', err);
      }
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        switch (data.event) {
          case 'start':
            streamSid = data.start.streamSid;
            console.log('Twilio Legacy stream started', streamSid);
            if (isOutbound) {
                console.log('Outbound call detected, sending initial greeting');
                // Wait a bit for connection to stabilize
                setTimeout(() => {
                    sendAudio("Hello! I am calling from Custarea. How can I help you today?");
                }, 1000);
            }
            break;
          case 'media':
            if (data.media && data.media.payload) {
              // Twilio sends mu-law 8kHz base64
              const payload = data.media.payload;
              const mulawBytes = Buffer.from(payload, 'base64');
              
              // Decode mu-law to PCM 16-bit
              const pcmSamples = decodeMuLaw(mulawBytes);
              
              // Push to STT (expects PCM buffer)
              const buffer = Buffer.from(pcmSamples.buffer);
              pushStream.write(buffer);
            }
            break;
          case 'stop':
            console.log('Twilio Legacy stream stopped');
            if (recognizer) recognizer.stopContinuousRecognitionAsync();
            break;
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    });

    ws.on('close', () => {
      console.log('Legacy Twilio WebSocket disconnected');
      if (pushStream) pushStream.close();
      if (recognizer) recognizer.stopContinuousRecognitionAsync();
    });
  });

  return wss;
}

// Helper: Decode mu-law Buffer to Int16Array
function decodeMuLaw(buffer) {
  const samples = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    samples[i] = mulaw.decode(buffer[i]);
  }
  return samples;
}

// Helper: Encode Int16Array to mu-law Buffer
function encodeMuLaw(samples) {
  const buffer = Buffer.alloc(samples.length);
  for (let i = 0; i < samples.length; i++) {
    buffer[i] = mulaw.encode(samples[i]);
  }
  return buffer;
}

module.exports = { setupLegacyTwilioService };
