const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

router.post('/', async (req, res) => {
  const { to } = req.body;
  const { PHONE_NUMBER_FROM, HOST, AI_SERVICE } = process.env;

  if (!to) {
    return res.status(400).json({ message: 'Missing "to" phone number' });
  }

  try {
    let wsUrl;
    if (AI_SERVICE === 'openai-realtime') {
        wsUrl = `wss://${HOST}/twilio-stream-openai`;
    } else if (AI_SERVICE === 'legacy') {
        wsUrl = `wss://${HOST}/twilio-stream-legacy?direction=outbound`;
    } else {
        wsUrl = `wss://${HOST}/twilio-stream`; // relay
    }

    const twiml = `
      <Response>
      <Say voice="Google.en-US-Chirp3-HD-Aoede">
          Hii, Ansul i am speeking from harward school of business.
        </Say>
        <Connect>
          <Stream url="${wsUrl}" />
        </Connect>
      </Response>
    `;

    const call = await client.calls.create({
      to,
      from: PHONE_NUMBER_FROM,
      twiml,
    });

    console.log(`Outbound call initiated: ${call.sid}`);
    res.send({ message: 'Call initiated', callSid: call.sid });
  } catch (error) {
    console.error('Error initiating outbound call:', error);
    res.status(500).json({ message: 'Error initiating call', error: error.message });
  }
});

module.exports = router;
