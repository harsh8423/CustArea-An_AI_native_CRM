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
  cors({})
);

// Module imports
const { authRoutes, newAuthRoutes } = require('./auth'); // Auth module
const { routes: emailRoutes, gmailOAuthRoutes, outlookOAuthRoutes } = require('./email'); // Email module
const bulkEmailRoutes = require('./email/routes/bulkEmailRoutes'); // Bulk email routes
const emailHistoryRoutes = require('./email/routes/emailHistoryRoutes'); // Email history routes
const { conversationRoutes, conversationEmailRoutes, messageRoutes } = require('./conversations'); // Conversations module

// Remaining individual routes
const importRoutes = require('./routes/importRoutes');
const contactRoutes = require('./routes/contactRoutes');
const contactGroupRoutes = require('./routes/contactGroupRoutes');
const leadRoutes = require('./routes/leadRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const bulkPhoneCallRoutes = require('./phone/routes/bulkPhoneCallRoutes'); // Bulk phone calling routes
const channelRoutes = require('./routes/channelRoutes');
const agentRoutes = require('./ai-agent/routes/agentRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const ticketTagRoutes = require('./routes/ticketTagRoutes');
const macroRoutes = require('./routes/macroRoutes');
const featureRoutes = require('./routes/featureRoutes');
const { routes: voiceAgentRoutes } = require('./voice-agents'); // Voice agent module

// MongoDB connection for AI Agent
const { connectMongoDB } = require('./config/mongodb');

// Routes
app.use('/api/auth', authRoutes); // Legacy auth (backward compatibility)
app.use('/api/v2/auth', newAuthRoutes); // New Supabase OTP auth
app.use('/api/settings/email/gmail', gmailOAuthRoutes); // Gmail OAuth
app.use('/oauth/google', gmailOAuthRoutes); // OAuth callback endpoint
app.use('/api/settings/email/outlook', outlookOAuthRoutes); // Outlook OAuth
app.use('/oauth/microsoft', outlookOAuthRoutes); // OAuth callback endpoint
app.use('/api/import', importRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/contact-groups', contactGroupRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/email', bulkEmailRoutes); // Bulk email endpoints
app.use('/api/email', emailHistoryRoutes); // Email history endpoints
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversation-email', conversationEmailRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/ai-agent', agentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ticket-tags', ticketTagRoutes);
app.use('/api/macros', macroRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/phone', bulkPhoneCallRoutes); // Bulk phone call endpoints
app.use('/api', voiceAgentRoutes); // Voice agents, phone numbers, models

// AI Processing routes (for Lambda integration)
const aiProcessingController = require('./controllers/aiProcessingController');
app.post('/api/ai/queue/:messageId', aiProcessingController.queueMessageForAI);

// Chat Widget routes (public API for embeddable widget)
const { routes: widgetRoutes } = require('./chat_widget');
app.use('/api/widget', widgetRoutes);

// Also mount webhooks at /webhook for Twilio compatibility
app.use('/webhook', webhookRoutes);
// Alias for /webhook/twilio/whatsapp -> /webhook/whatsapp
app.post('/webhook/twilio/whatsapp', async (req, res) => {
    const whatsappService = require('./whatsapp/services/whatsappService');

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

// Initialize Redis Streams and Workers from modules
const { initRedisStreams } = require('./config/redis');
const { runWhatsappOutboundWorker } = require('./whatsapp');
const { runEmailOutboundWorker } = require('./email');
const { runAiIncomingWorker } = require('./ai-agent');



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

    console.log('Starting workers...');
    runWhatsappOutboundWorker().catch(err => {
      console.error('WhatsApp worker error:', err);
    });
    runEmailOutboundWorker().catch(err => {
      console.error('Email worker error:', err);
    });
    runAiIncomingWorker().catch(err => {
      console.error('AI Incoming worker error:', err);
    });
    
    // Start bulk email worker
    const bulkEmailWorker = require('./email/workers/bulkEmailWorker');
    console.log('✓ Bulk email worker started');
    
    // Start bulk phone call worker
    const bulkPhoneCallWorker = require('./phone/workers/bulkCallWorker');
    console.log(' Bulk phone call worker started');

    console.log('✓ All workers started');
  } catch (err) {
    console.error('Failed to initialize workers:', err);
  }
});


// Phone module with AI Agent integration
const { setupLegacyHandler, setupRealtimeHandler, routes: phoneRoutes } = require('./phone');

const url = require('url');

// Phone Routes - mount at both /api/phone and /twiml for backwards compatibility with Twilio webhooks
app.use('/api/phone', phoneRoutes);
app.use('/twiml', phoneRoutes);  // Twilio webhook hits /twiml for inbound calls
app.use('/make-call', require('./routes/outbound'));

// Phone module WebSocket handlers (with AI Agent integration)
const phoneLegacyWss = setupLegacyHandler();
const phoneRealtimeWss = setupRealtimeHandler();


server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  const pathname = parsedUrl.pathname;

  // Phone module WebSocket routes (with AI Agent integration)
  // Use startsWith because path includes sessionId: /phone-ws/legacy/{sessionId}
  if (pathname.startsWith('/phone-ws/legacy/')) {
    phoneLegacyWss.handleUpgrade(request, socket, head, (ws) => {
      phoneLegacyWss.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/phone-ws/realtime/')) {
    phoneRealtimeWss.handleUpgrade(request, socket, head, (ws) => {
      phoneRealtimeWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
