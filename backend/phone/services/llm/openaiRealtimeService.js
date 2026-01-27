const WebSocket = require('ws');
const { buildPrompt } = require('../../utils/promptBuilder');

function setupOpenAIRealtimeService() {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('Client connected to OpenAI Realtime WebSocket');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key missing');
      ws.send(JSON.stringify({ type: 'error', message: 'Server configuration error' }));
      ws.close();
      return;
    }

    // Connect to OpenAI Realtime API
    const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini";
    const openaiWs = new WebSocket(url, {
      headers: {
        Authorization: "Bearer " + apiKey,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on('open', () => {
      console.log('Connected to OpenAI Realtime API');
      
      // Send session update with system prompt and configuration
      const sessionUpdate = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: buildPrompt(),
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
              model: "whisper-1"
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        },
      };
      openaiWs.send(JSON.stringify(sessionUpdate));
    });

    openaiWs.on('message', (data) => {
      const msg = data.toString();
      try {
        const json = JSON.parse(msg);
        if (json.type === 'error') {
            console.error('OpenAI Error:', json);
        } else if (json.type === 'session.updated') {
            console.log('Session Updated:', json);
        } else if (json.type === 'response.created') {
            console.log('Response Created:', json);
        } else if (json.type === 'response.done') {
            console.log('Response Done:', JSON.stringify(json, null, 2));
        } else if (json.type === 'input_audio_buffer.speech_started') {
            console.log('Speech Started (Barge-in detected)');
            // Send interrupt signal to client to stop playback
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'interrupt' }));
            }
            // Cancel OpenAI response generation
            const cancelEvent = {
                type: 'response.cancel'
            };
            if (openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify(cancelEvent));
            }
        } else if (json.type === 'response.audio.delta') {
            // console.log('Received Audio Delta (Chunk)'); 
        } else if (json.type === 'response.audio_transcript.delta') {
            console.log('Received Transcript Delta:', json.delta);
        } else if (json.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('User Input Transcribed:', json.transcript);
        } else {
            console.log('Received Event:', json.type);
        }
      } catch (e) {
          console.error('Error parsing OpenAI message:', e);
      }

      // Relay message from OpenAI to Client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });

    openaiWs.on('error', (err) => {
      console.error('OpenAI WebSocket Error:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'OpenAI connection error' }));
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log(`OpenAI WebSocket closed. Code: ${code}, Reason: ${reason}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Relay messages from Client to OpenAI
    ws.on('message', (data) => {
      const msg = data.toString();
      // console.log('Received from Client:', msg.substring(0, 50)); // Debug log
      
      try {
        const json = JSON.parse(msg);
        if (json.type === 'end') {
            console.log('Received end command from client');
            if (openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.close();
            }
            return; // Do not relay 'end' to OpenAI
        }
      } catch (e) {
        // Not JSON or other error, ignore and relay if needed (though usually all are JSON)
      }

      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(msg);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from OpenAI Realtime');
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });

    ws.on('error', (err) => {
      console.error('Client WebSocket Error:', err);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });
  });
  return wss;
}

module.exports = { setupOpenAIRealtimeService };
