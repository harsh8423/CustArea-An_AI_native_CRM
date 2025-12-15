// services/openaiRealtimeTwilioService.js
const WebSocket = require('ws');

const SYSTEM_MESSAGE = `
You are a concise, helpful AI phone agent. 
Respond clearly and naturally. Do not ramble.
`;
const VOICE = 'alloy';
const TEMPERATURE = 0.8;

// Optional: which OpenAI event types to log
const LOG_EVENT_TYPES = [
  'error',
  'response.content.done',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created',
  'session.updated',
  'response.output_audio.delta',
  'response.audio.delta',
];

function setupOpenAIRealtimeTwilio() {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (connection, req) => {
    console.log('Twilio media stream connected (OpenAI Realtime)');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Missing OPENAI_API_KEY');
      connection.close();
      return;
    }

    // One OpenAI Realtime WebSocket per phone call
    const openAiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=gpt-realtime-mini&temperature=${TEMPERATURE}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // For GA Realtime, this header is optional, but safe:
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    let streamSid = null;

    const sendSessionUpdate = () => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: SYSTEM_MESSAGE,
          voice: VOICE,
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

      console.log('Sending OpenAI session.update');
      openAiWs.send(JSON.stringify(sessionUpdate));
    };

    // OpenAI WS open
    openAiWs.on('open', () => {
      console.log('Connected to OpenAI Realtime for Twilio call');
      // Slight delay to avoid racing the connection establishment
      setTimeout(sendSessionUpdate, 250);
    });

    // Messages from OpenAI → Twilio
    openAiWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (LOG_EVENT_TYPES.includes(msg.type)) {
          console.log('OpenAI event:', msg.type);
          if (msg.type === 'error') {
            console.error('OpenAI Error Details:', JSON.stringify(msg, null, 2));
          }
          if (msg.type === 'response.done') {
            console.log('Response Done:', JSON.stringify(msg, null, 2));
          }
        }

        // Audio chunks from OpenAI back to caller
        if ((msg.type === 'response.audio.delta' || msg.type === 'response.output_audio.delta') && msg.delta) {
          // msg.delta is base64 PCMU data
          const audioDelta = {
            event: 'media',
            streamSid,
            media: {
              payload: msg.delta,
            },
          };
          connection.send(JSON.stringify(audioDelta));
        }
      } catch (err) {
        console.error('Error processing OpenAI message', err);
      }
    });

    openAiWs.on('error', (err) => {
      console.error('OpenAI WS error', err);
    });

    openAiWs.on('close', () => {
      console.log('OpenAI WS closed for call');
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    });

    // Messages from Twilio → OpenAI
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'start':
            streamSid = data.start.streamSid;
            console.log('Twilio stream started', streamSid);
            break;

          case 'media':
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                // Twilio media.payload is base64 PCMU; pass directly
                audio: data.media.payload,
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;

          case 'stop':
            console.log('Twilio stream stopped');
            if (openAiWs.readyState === WebSocket.OPEN) {
              openAiWs.close();
            }
            break;

          default:
            console.log('Twilio non-media event', data.event);
            break;
        }
      } catch (err) {
        console.error('Error parsing Twilio WS message', err);
      }
    });

    connection.on('close', () => {
      console.log('Twilio media stream disconnected');
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close();
      }
    });

    connection.on('error', (err) => {
      console.error('Twilio WS error', err);
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close();
      }
    });
  });

  return wss;
}

module.exports = { setupOpenAIRealtimeTwilio };
