require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Allow your Next.js origin in dev
app.use(
  cors({
    origin: ['http://localhost:3000'],
    credentials: true,
  })
);

const authRoutes = require('./routes/authRoutes');
const importRoutes = require('./routes/importRoutes');
const contactRoutes = require('./routes/contactRoutes');
const leadRoutes = require('./routes/leadRoutes');
const emailRoutes = require('./routes/emailRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const channelRoutes = require('./routes/channelRoutes');
const agentRoutes = require('./ai-agent/routes/agentRoutes');

// MongoDB connection for AI Agent
const { connectMongoDB } = require('./config/mongodb');

app.use('/api/auth', authRoutes);
app.use('/api/import', importRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/ai-agent', agentRoutes);

// Also mount webhooks at /webhook for Twilio compatibility
app.use('/webhook', webhookRoutes);
// Alias for /webhook/twilio/whatsapp -> /webhook/whatsapp
app.post('/webhook/twilio/whatsapp', async (req, res) => {
    const whatsappService = require('./services/whatsappService');
    try {
        await whatsappService.handleIncomingWebhook(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error('WhatsApp webhook error:', err);
        res.status(500).send('Error');
    }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/get-speech-token', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const speechKey = process.env.SPEECH_KEY;
  const speechRegion = process.env.SPEECH_REGION;

  if (!speechKey || !speechRegion || speechKey === 'your-speech-key-here') {
    return res
      .status(400)
      .send('You forgot to add your speech key or region to the .env file.');
  }

  const headers = {
    headers: {
      'Ocp-Apim-Subscription-Key': speechKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  try {
    const tokenResponse = await axios.post(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      null,
      headers
    );

    res.send({ token: tokenResponse.data, region: speechRegion });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(401).send('There was an error authorizing your speech key.');
  }
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize Redis Streams and Start Workers
const { initRedisStreams } = require('./config/redis');
const { runWhatsappOutboundWorker } = require('./workers/whatsappOutbound');
const { runEmailOutboundWorker } = require('./workers/emailOutbound');

const port = process.env.PORT || 8000;
const server = app.listen(port, async () => {
  console.log(`Express server is running on http://localhost:${port}`);

  // Initialize MongoDB for AI Agent
  try {
    console.log('Connecting to MongoDB...');
    await connectMongoDB();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
  }

  // Initialize Redis streams and start workers
  try {
    console.log('Initializing Redis streams...');
    await initRedisStreams();
    console.log('✓ Redis streams initialized');

    console.log('Starting outbound workers...');
    runWhatsappOutboundWorker().catch(err => {
      console.error('WhatsApp worker error:', err);
    });
    runEmailOutboundWorker().catch(err => {
      console.error('Email worker error:', err);
    });
    console.log('✓ Outbound workers started');
  } catch (err) {
    console.error('Failed to initialize workers:', err);
  }
});

// WebSocket Server Setup
const { setupSttService } = require('./services/stt/sttService');
const { setupOpenAIRealtimeService } = require('./services/llm/openaiRealtimeService');
const { setupTwilioWebSocket } = require('./services/twilioWebSocketService');
const { setupOpenAIRealtimeTwilio } = require('./services/openaiRealtimeTwilioService');
const { setupLegacyTwilioService } = require('./services/legacyTwilioService');
const twimlRoutes = require('./routes/twiml');
const url = require('url');

// Register TwiML route
// Register TwiML route
app.use('/twiml', twimlRoutes);
app.use('/make-call', require('./routes/outbound'));


const sttWss = setupSttService();
const realtimeWss = setupOpenAIRealtimeService();
const twilioWss = setupTwilioWebSocket();
const openaiTwilioWss = setupOpenAIRealtimeTwilio();
const legacyTwilioWss = setupLegacyTwilioService();

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/client-audio') {
    sttWss.handleUpgrade(request, socket, head, (ws) => {
      sttWss.emit('connection', ws, request);
    });
  } else if (pathname === '/openai-realtime') {
    realtimeWss.handleUpgrade(request, socket, head, (ws) => {
      realtimeWss.emit('connection', ws, request);
    });
  } else if (pathname === '/twilio-stream') {
    twilioWss.handleUpgrade(request, socket, head, (ws) => {
      twilioWss.emit('connection', ws, request);
    });
  } else if (pathname === '/twilio-stream-openai') {
    openaiTwilioWss.handleUpgrade(request, socket, head, (ws) => {
      openaiTwilioWss.emit('connection', ws, request);
    });
  } else if (pathname === '/twilio-stream-legacy') {
    legacyTwilioWss.handleUpgrade(request, socket, head, (ws) => {
      legacyTwilioWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
