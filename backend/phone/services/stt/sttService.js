const WebSocket = require('ws');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { streamChatCompletion: streamOpenAI } = require('../llm/openaiService');
const { streamChatCompletion: streamGroq } = require('../llm/groqService');
const { buildPrompt } = require('../../utils/promptBuilder');
const { AzureTTS } = require('../tts/ttsService');

function setupSttService() {
  const wss = new WebSocket.Server({ noServer: true });
  const tts = new AzureTTS();

  // Configuration: 'openai' or 'groq'
  const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
  const LLM_MODEL = process.env.LLM_MODEL; // Optional override

  wss.on('connection', (ws) => {
    console.log(`Client connected to STT WebSocket (LLM: ${LLM_PROVIDER})`);

    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      console.error('Speech key or region missing');
      ws.send(JSON.stringify({ type: 'error', detail: 'Server configuration error' }));
      return;
    }

    const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
    const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';

    // Fix for centralindia region DNS issues
    // Explicitly set the endpoint to the STT service URL
    const endpoint = `wss://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_Endpoint, endpoint);
    
    // Increase silence timeout to 3 seconds (3000ms)
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "3000");

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
      console.log('Recognizing:', e.result.text);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'interim', text: e.result.text }));
        // Send interrupt signal to stop playback
        ws.send(JSON.stringify({ type: 'interrupt' }));
      }
    };

    recognizer.recognized = async (s, e) => {
      console.log('Recognized:', e.result.text);
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const userText = e.result.text;
        if (ws.readyState === WebSocket.OPEN) {
          // Send STT result first
          ws.send(JSON.stringify({ type: 'transcript', text: userText }));
          
          // Trigger Chat Completion
          const messages = [
            { role: "system", content: buildPrompt() },
            { role: "user", content: userText }
          ];
          
          let buffer = "";
          
          const streamFunction = LLM_PROVIDER === 'groq' ? streamGroq : streamOpenAI;
          // Use undefined for modelName if not explicitly set, to allow service defaults to apply
          const modelName = LLM_MODEL || undefined;

          await streamFunction(
            messages,
            modelName,
            async (chunk) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'llm-chunk', content: chunk }));
                
                // Buffer for TTS
                buffer += chunk;
                // Simple sentence detection (split by punctuation)
                const sentenceMatch = buffer.match(/([.!?]+)\s+/);
                if (sentenceMatch) {
                  const sentence = buffer.substring(0, sentenceMatch.index + sentenceMatch[0].length);
                  buffer = buffer.substring(sentenceMatch.index + sentenceMatch[0].length);
                  
                  try {
                    const audioData = await tts.synthesizeToWavBytes(sentence);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'audio-meta', length: audioData.byteLength }));
                      ws.send(Buffer.from(audioData));
                    }
                  } catch (err) {
                    console.error('TTS Error:', err);
                  }
                }
              }
            },
            async () => {
              // Process remaining buffer
              if (buffer.trim()) {
                 try {
                    const audioData = await tts.synthesizeToWavBytes(buffer);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'audio-meta', length: audioData.byteLength }));
                      ws.send(Buffer.from(audioData));
                    }
                  } catch (err) {
                    console.error('TTS Error (Final):', err);
                  }
              }
              
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'llm-complete' }));
              }
            }
          );
        }
      } else if (e.result.reason === sdk.ResultReason.NoMatch) {
        console.log('NoMatch:', e.result.noMatchReason);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'nomatch' }));
        }
      }
    };

    recognizer.canceled = (s, e) => {
      console.error('Canceled:', e.reason, e.errorDetails);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', detail: e.reason + ': ' + e.errorDetails }));
      }
      recognizer.stopContinuousRecognitionAsync();
      pushStream.close();
    };

    recognizer.sessionStopped = (s, e) => {
      console.log('Session stopped event', e);
      recognizer.stopContinuousRecognitionAsync();
      pushStream.close();
    };

    recognizer.startContinuousRecognitionAsync(
      () => console.log('Recognition started'),
      (err) => console.error('Recognition start failed', err)
    );

    ws.on('message', (msg) => {
      if (typeof msg === 'string') {
        try {
          const ctrl = JSON.parse(msg);
          if (ctrl.type === 'end') {
            console.log('Received end command');
            pushStream.close();
          }
        } catch (e) {
          console.error('Error parsing control message', e);
        }
      } else {
        // console.log('Received audio chunk:', msg.length); // Uncomment to debug audio flow
        pushStream.write(Buffer.from(msg));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      pushStream.close();
      recognizer.stopContinuousRecognitionAsync();
    });
  });
  return wss;
}

module.exports = { setupSttService };
