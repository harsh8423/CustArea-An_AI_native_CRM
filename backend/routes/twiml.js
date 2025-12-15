const express = require('express');
const router = express.Router();

const WELCOME_GREETING = "Hello! I am your AI assistant. How can I help you today?";

function getWebSocketUrl(host, path = '/twilio-stream') {
  return `wss://${host}${path}`;
}

router.post('/', (req, res) => {
  res.type('text/xml');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const aiService = process.env.AI_SERVICE || 'openai-realtime';

  if (aiService === 'openai-realtime') {
    const wsUrl = getWebSocketUrl(host, '/twilio-stream-openai');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          Please wait while we connect your call to the AI assistant.
        </Say>
        <Pause length="1" />
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          You can start talking now.
        </Say>
        <Connect>
          <Stream url="${wsUrl}" />
        </Connect>
      </Response>`
    );
  } else if (aiService === 'legacy') {
    const wsUrl = getWebSocketUrl(host, '/twilio-stream-legacy');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          Connecting to legacy AI service.
        </Say>
        <Connect>
          <Stream url="${wsUrl}" />
        </Connect>
      </Response>`
    );
  } else {
    // Default to relay
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <ConversationRelay url="${getWebSocketUrl(process.env.HOST || host)}" welcomeGreeting="${WELCOME_GREETING}" />
        </Connect>
      </Response>`
    );
  }
});

// Also handle GET just in case
router.get('/', (req, res) => {
  res.type('text/xml');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const aiService = process.env.AI_SERVICE || 'openai-realtime';

  if (aiService === 'openai-realtime') {
    const wsUrl = getWebSocketUrl(host, '/twilio-stream-openai');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          Please wait while we connect your call to the AI assistant.
        </Say>
        <Pause length="1" />
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          You can start talking now.
        </Say>
        <Connect>
          <Stream url="${wsUrl}" />
        </Connect>
      </Response>`
    );
  } else if (aiService === 'legacy') {
    const wsUrl = getWebSocketUrl(host, '/twilio-stream-legacy');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Google.en-US-Chirp3-HD-Aoede">
          Connecting to legacy AI service.
        </Say>
        <Connect>
          <Stream url="${wsUrl}" />
        </Connect>
      </Response>`
    );
  } else {
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <ConversationRelay url="${getWebSocketUrl(process.env.HOST || host)}" welcomeGreeting="${WELCOME_GREETING}" />
        </Connect>
      </Response>`
    );
  }
});

module.exports = router;
