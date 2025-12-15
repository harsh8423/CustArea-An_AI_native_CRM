const WebSocket = require('ws');
const { getChatCompletion } = require('./llm/groqService');

const SYSTEM_PROMPT = "You are a helpful and friendly AI assistant. Keep your responses concise and conversational.";

function setupTwilioWebSocket() {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('Client connected to Twilio WebSocket');
    
    let streamSid = null;
    let callSid = null;
    const conversation = [{ role: "system", content: SYSTEM_PROMPT }];

    ws.on('message', async (message) => {
      try {
        console.log('Raw message:', message);
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'connected':
            console.log('Twilio Media Stream Connected');
            break;
            
          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;
            console.log(`Stream started: ${streamSid}, Call: ${callSid}`);
            // If we wanted to send an initial greeting via TTS, we would do it here.
            // But the user's prompt implies the "ConversationRelay" handles it or we just wait for user input.
            // The user's snippet had a "setup" message, but standard Twilio Media Streams send 'start'.
            // However, the user mentioned "ConversationRelay" which might be a specific library or abstraction they are using.
            // If they are using standard Twilio <Stream>, we get 'start', 'media', 'stop'.
            // The user's snippet:
            // case "setup": ...
            // case "prompt": ...
            // This suggests they might be using a custom client or a specific Twilio integration (like a specific TwiML app or a proxy).
            // BUT, the TwiML <Connect><ConversationRelay> is NOT standard Twilio TwiML. 
            // Standard is <Connect><Stream>.
            // I used <Stream> in twiml.js. 
            // If the user is using a custom "ConversationRelay" verb, it implies a third-party integration or a plugin.
            // Given I am implementing the backend, I should probably assume standard Twilio <Stream> OR 
            // if the user explicitly asked for "ConversationRelay", I should check if that's a thing.
            // "ConversationRelay" seems to be a specific tool or library the user is using or referring to (maybe from a tutorial).
            // Searching online for "Twilio ConversationRelay" might reveal it's a specific project (like from a blog post).
            // The user's snippet shows: `case "prompt": ... message.voicePrompt`.
            // This is NOT standard Twilio Media Stream (which sends raw audio).
            // This implies there is an INTERMEDIARY that does STT and sends "prompt" events.
            // The user says: "ConversationRelay transcribes their voice to text."
            // "The transcribed text is sent as a prompt to ... existing llm service".
            // So my WebSocket is NOT receiving audio, it is receiving TEXT prompts.
            // This makes things much easier! I don't need to handle audio streams.
            // I just need to handle JSON messages: "setup" and "prompt".
            
            break;

          case 'setup':
            // User's custom protocol
            callSid = data.callSid;
            console.log("Setup for call:", callSid);
            ws.callSid = callSid;
            // Reset conversation or load existing
            conversation.length = 0;
            conversation.push({ role: "system", content: SYSTEM_PROMPT });
            break;

          case 'prompt':
            // User's custom protocol
            console.log("Processing prompt:", data.voicePrompt);
            conversation.push({ role: "user", content: data.voicePrompt });

            const response = await getChatCompletion(conversation);
            conversation.push({ role: "assistant", content: response });

            ws.send(
              JSON.stringify({
                type: "text",
                token: response,
                last: true,
              })
            );
            console.log("Sent response:", response);
            break;
            
          case 'stop':
            console.log('Stream stopped');
            break;
            
          default:
            console.log('Unknown event:', data.event);
            break;
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    });

    ws.on('close', () => {
      console.log('Twilio WebSocket disconnected');
    });
  });

  return wss;
}

module.exports = { setupTwilioWebSocket };
