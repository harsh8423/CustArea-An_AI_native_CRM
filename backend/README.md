# Backend Architecture Documentation

## Overview

The CustArea backend is built with Express.js and follows a modular microservices-inspired architecture. Each major feature (email, WhatsApp, conversations, auth, phone, AI agent, chat widget) is organized as a self-contained module with its own controllers, routes, services, and workers.

---

## Directory Structure

```
backend/
├── index.js                    # Main application entry point
├── config/                     # Application configuration
│   ├── db.js                  # PostgreSQL connection pool
│   ├── mongodb.js             # MongoDB connection (for AI Agent)
│   └── redis.js               # Redis configuration and streams
├── middleware/                 # Shared middleware (auth, validation)
├── utils/                      # Shared utility functions
├── services/                   # Shared/cross-module services
│   ├── contactResolver.js     # Contact management across channels
│   └── workflowCheckService.js # Workflow trigger checking
├── controllers/                # Shared controllers
│   ├── agentDeploymentController.js
│   ├── aiProcessingController.js
│   ├── channelController.js
│   ├── contactController.js
│   ├── featureController.js
│   ├── importController.js
│   ├── leadController.js
│   └── ticketController.js
├── routes/                     # Shared routes
│   ├── channelRoutes.js
│   ├── contactRoutes.js
│   ├── webhookRoutes.js (shared webhooks)
│   └── ... (other shared routes)
├── workers/                    # Shared workers
│   └── aiIncomingWorker.js    # AI message processing for all channels
│
├── email/                      # Email Module
│   ├── index.js               # Module entry point
│   ├── controllers/           # Email controllers
│   │   ├── emailController.js
│   │   ├── gmailOAuthController.js
│   │   └── outlookOAuthController.js
│   ├── routes/               # Email routes
│   │   ├── emailRoutes.js
│   │   ├── gmailOAuth.js
│   │   └── outlookOAuth.js
│   ├── services/             # Email services
│   │   ├── baseEmailProvider.js
│   │   ├── emailProviderFactory.js
│   │   ├── gmailProvider.js
│   │   ├── outlookProvider.js
│   │   ├── sesProvider.js
│   │   ├── sesIdentityService.js
│   │   └── sesSendService.js
│   └── workers/              # Email workers
│       └── emailOutbound.js   # Outbound email processing
│
├── whatsapp/                   # WhatsApp Module
│   ├── index.js               # Module entry point
│   ├── services/
│   │   └── whatsappService.js # Twilio WhatsApp integration
│   └── workers/
│       └── whatsappOutbound.js # Outbound WhatsApp messages
│
├── conversations/              # Conversations Module
│   ├── index.js               # Module entry point
│   ├── controllers/
│   │   ├── conversationController.js
│   │   ├── conversationEmailController.js
│   │   └── messageController.js
│   └── routes/
│       ├── conversationRoutes.js
│       ├── conversationEmailRoutes.js
│       └── messageRoutes.js
│
├── auth/                       # Authentication Module
│   ├── index.js               # Module entry point
│   ├── controllers/
│   │   └── authController.js
│   ├── routes/
│   │   ├── authRoutes.js     # Legacy password-based auth
│   │   └── auth.js           # Supabase OTP auth
│   └── middleware/           # Auth-specific middleware
│
├── phone/                      # Phone Module
│   ├── index.js               # Module entry point
│   ├── controllers/
│   │   ├── phoneController.js
│   │   └── tokenController.js
│   ├── routes/
│   │   └── phoneRoutes.js
│   └── services/
│       ├── callSessionManager.js
│       ├── phoneStorageService.js
│       ├── legacyHandler.js  # Azure STT/TTS + AI Agent
│       ├── realtimeHandler.js # OpenAI Realtime API
│       └── convRelayHandler.js
│
├── ai-agent/                   # AI Agent Module
│   ├── index.js               # Module entry point
│   ├── controllers/
│   │   └── agentController.js
│   ├── routes/
│   │   └── agentRoutes.js
│   ├── services/
│   │   ├── agentService.js
│   │   ├── documentProcessor.js
│   │   ├── embeddingService.js
│   │   ├── functionTools.js
│   │   └── vectorSearchService.js
│   └── models/               # MongoDB models
│
└── chat_widget/                # Chat Widget Module
    ├── index.js               # Module entry point
    ├── controllers/
    │   └── widgetController.js
    ├── routes/
    │   └── widgetRoutes.js
    ├── services/
    │   └── widgetService.js
    └── middleware/
```

---

## Module Descriptions

### Email Module (`/email`)
Handles all email-related functionality including inbound/outbound emails, OAuth integration with Gmail and Outlook, and SES configuration.

**Key Files:**
- `services/emailProviderFactory.js` - Factory pattern for different email providers (SES, Gmail, Outlook)
- `services/sesProvider.js` - Amazon SES integration
- `services/gmailProvider.js` - Gmail API integration with OAuth
- `services/outlookProvider.js` - Outlook/Microsoft Graph API integration
- `workers/emailOutbound.js` - Redis stream worker for outbound email processing

**Routes:**
- `/api/email` - Email configuration and management
- `/api/settings/email/gmail` - Gmail OAuth setup
- `/api/settings/email/outlook` - Outlook OAuth setup
- `/oauth/google` - Gmail OAuth callback
- `/oauth/microsoft` - Outlook OAuth callback

---

### WhatsApp Module (`/whatsapp`)
Manages WhatsApp messaging via Twilio integration.

**Key Files:**
- `services/whatsappService.js` - Twilio WhatsApp API integration, webhook handling, message sending
- `workers/whatsappOutbound.js` - Redis stream worker for outbound WhatsApp messages

**Routes:**
- Webhooks handled in `/api/webhooks` (shared webhook routes)

**Features:**
- Inbound message handling with contact resolution
- Outbound message queue processing
- Workflow trigger integration
- AI agent integration for auto-responses

---

### Conversations Module (`/conversations`)
Centralized conversation and message management across all channels (email, WhatsApp, widget, phone).

**Key Files:**
- `controllers/conversationController.js` - CRUD operations for conversations
- `controllers/messageController.js` - Message operations
- `controllers/conversationEmailController.js` - Email-specific conversation features

**Routes:**
- `/api/conversations` - Conversation management
- `/api/messages` - Message operations
- `/api/conversation-email` - Email conversation features

**Features:**
- Multi-channel conversation threads
- Message status tracking (sent, delivered, read)
- Contact linking and unknown sender handling

---

### Auth Module (`/auth`)
Authentication and authorization for the platform.

**Key Files:**
- `controllers/authController.js` - User authentication logic
- `routes/authRoutes.js` - Legacy password-based authentication
- `routes/auth.js` - New Supabase OTP authentication

**Routes:**
- `/api/auth` - Legacy authentication endpoints
- `/api/v2/auth` - New Supabase authentication endpoints

**Features:**
- Two authentication systems (legacy + Supabase)
- JWT token management
- User session handling

---

### Phone Module (`/phone`)
Voice call handling with AI-powered conversations using Twilio and Azure/OpenAI services.

**Key Files:**
- `controllers/phoneController.js` - Phone call operations and Tw iML generation
- `services/callSessionManager.js` - Manages active call sessions
- `services/legacyHandler.js` - Azure STT + AI Agent + Azure TTS (sentence streaming)
- `services/realtimeHandler.js` - OpenAI Realtime API (lowest latency)
- `services/convRelayHandler.js` - Custom conversation relay handler
- `services/phoneStorageService.js` - Call persistence and transcripts

**Routes:**
- `/api/phone` - Phone API endpoints
- `/twiml` - Twilio webhook endpoints (for inbound calls)
- `/phone-ws/legacy/{sessionId}` - WebSocket for legacy mode
- `/phone-ws/realtime/{sessionId}` - WebSocket for OpenAI Realtime mode
- `/phone-ws/convrelay/{sessionId}` - WebSocket for ConvRelay mode

**Features:**
- Inbound and outbound calls
- Real-time voice AI conversations
- Multiple AI backends (Azure STT/TTS, OpenAI Realtime)
- Call recording and transcription
- Contact and conversation integration

---

### AI Agent Module (`/ai-agent`)
Intelligent conversational AI agent with knowledge base, function calling, and vector search.

**Key Files:**
- `services/agentService.js` - Core AI logic, conversation handling
- `services/vectorSearchService.js` - Vector database search (MongoDB Atlas)
- `services/embeddingService.js` - Text embeddings for semantic search
- `services/documentProcessor.js` - Document ingestion and chunking
- `services/functionTools.js` - AI function calling tools

**Routes:**
- `/api/ai-agent` - Agent configuration and management

**Features:**
- Context-aware conversations
- Knowledge base integration
- Function calling (create tickets, schedule tasks, etc.)
- Multi-turn conversation memory
- Semantic search over documents

**Database:**
- MongoDB for knowledge base and vector embeddings
- PostgreSQL for agent configuration and deployment settings

---

### Chat Widget Module (`/chat_widget`)
Embeddable website chat widget for customer support.

**Key Files:**
- `controllers/widgetController.js` - Widget initialization and messaging
- `services/widgetService.js` - Widget configuration, visitor tracking, JWT tokens
- `middleware/` - Widget-specific middleware (CORS, domain validation)

**Routes:**
- `/api/widget` - Widget API (public, no auth required)

**Features:**
- Embeddable JavaScript widget
- Domain whitelisting
- Visitor tracking and session management
- Anonymous and authenticated chat
- AI agent integration

---

## Shared Services

### Contact Resolver (`/services/contactResolver.js`)
Centralized service for finding or creating contacts with cross-channel deduplication.

**Functions:**
- `findContact(tenantId, identifiers)` - Lookup only, returns null if not found
- `createContact(tenantId, identifiers, metadata)` - Explicit contact creation
- `getContactIdentifiers(tenantId, contactId)` - Retrieve all identifiers for a contact
- `mergeContacts(tenantId, primaryId, secondaryId)` - Merge duplicate contacts

**Used by:**
- Email service (inbound email handling)
- WhatsApp service (inbound message handling)
- Phone service (call handling)
- Widget service (visitor to contact linking)

---

### Workflow Check Service (`/services/workflowCheckService.js`)
Checks if tenant has active workflows with specific trigger types.

**Functions:**
- `hasTriggerWorkflow(tenantId, triggerType)` - Check for active workflow
- `getTriggerType(channel, eventType)` - Get trigger type for channel event
- `clearTriggerCache(tenantId)` - Clear cache when workflows updated

**Used by:**
- WhatsApp service (check for workflow triggers)
- Email service (check for workflow triggers)
- Message controller (routing logic)

---

## Workers (Background Jobs)

### AI Incoming Worker (`/workers/aiIncomingWorker.js`)
Processes incoming messages from all channels and generates AI responses.

**Redis Stream:** `incoming-messages`  
**Consumer Group:** `ai-workers`

**Processing:**
1. Fetch message and conversation from database
2. Build conversation context and history
3. Query knowledge base (vector search)
4. Call AI agent service
5. Queue outbound message response
6. Update message status

---

### Email Outbound Worker (`/email/workers/emailOutbound.js`)
Sends outbound emails via configured provider (SES, Gmail, Outlook).

**Redis Stream:** `outgoing-email`  
**Consumer Group:** `email-workers`

---

### WhatsApp Outbound Worker (`/whatsapp/workers/whatsappOutbound.js`)
Sends outbound WhatsApp messages via Twilio.

**Redis Stream:** `outgoing-whatsapp`  
**Consumer Group:** `whatsapp-workers`

---

## Shared Controllers

### Agent Deployment Controller (`/controllers/agentDeploymentController.js`)
Manages AI agent deployment settings per tenant and channel.

**Key Function:**
- `shouldAgentRespond(tenantId, channel)` - Determines if AI should auto-respond

---

### AI Processing Controller (`/controllers/aiProcessingController.js`)
Queue interface for Lambda or external AI processing.

**Route:**
- `POST /api/ai/queue/:messageId` - Queue message for AI processing

---

### Channel Controller (`/controllers/channelController.js`)
Cross-channel configuration management (email, WhatsApp, widget).

---

## Configuration Files

### Database (`/config/db.js`)
PostgreSQL connection pool using `pg` library.

**Environment Variables:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

---

### MongoDB (`/config/mongodb.js`)
MongoDB connection for AI Agent knowledge base.

**Environment Variables:**
- `MONGODB_URI`

---

### Redis (`/config/redis.js`)
Redis client and stream configuration.

**Environment Variables:**
- `REDIS_HOST`, `REDIS_PORT`

**Stream Names:**
- `incoming-messages` - Inbound messages for AI processing
- `outgoing-email` - Outbound email queue
- `outgoing-whatsapp` - Outbound WhatsApp queue
- `workflow-triggers` - Workflow trigger events

---

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=custarea
DB_USER=postgres
DB_PASSWORD=your_password

# MongoDB (AI Agent)
MONGODB_URI=mongodb://localhost:27017/custarea

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Azure Speech Services (for Phone)
SPEECH_KEY=your_azure_key
SPEECH_REGION=centralindia
AZURE_TTS_VOICE=en-US-JennyNeural

# OpenAI
OPENAI_API_KEY=your_openai_key

# AWS SES (for Email)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1

# Twilio (for Phone & WhatsApp)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Widget
WIDGET_JWT_SECRET=your_widget_secret

# Supabase (for Auth)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Legacy login
- `POST /api/auth/register` - Legacy registration
- `POST /api/v2/auth/otp/send` - Send OTP (Supabase)
- `POST /api/v2/auth/otp/verify` - Verify OTP (Supabase)

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations` - Create conversation
- `PATCH /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation

### Messages
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message
- `GET /api/messages/:id` - Get message details

### Email
- `GET /api/email/accounts` - List email accounts
- `POST /api/email/accounts` - Add email account
- `GET /api/settings/email/gmail/auth` - Initiate Gmail OAuth
- `GET /api/settings/email/outlook/auth` - Initiate Outlook OAuth

### Phone
- `POST /api/phone/calls` - Make outbound call
- `GET /api/phone/calls/:id` - Get call details
- `POST /twiml/voice` - Twilio inbound voice webhook
- `POST /twiml/status` - Twilio status callback

### AI Agent
- `GET /api/ai-agent` - List AI agents
- `POST /api/ai-agent` - Create AI agent
- `PATCH /api/ai-agent/:id` - Update AI agent
- `POST /api/ai-agent/:id/documents` - Upload knowledge base documents

### Widget
- `POST /api/widget/init` - Initialize widget session
- `POST /api/widget/message` - Send widget message

### Webhooks
- `POST /api/webhooks/twilio/whatsapp` - WhatsApp inbound messages
- `POST /api/webhooks/twilio/phone` - Phone webhooks
- `POST /api/webhooks/gmail` - Gmail push notifications

---

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Server runs on http://localhost:8000
```

### Worker Management

Workers are automatically started when the server starts:
- AI Incoming Worker
- Email Outbound Worker
- WhatsApp Outbound Worker

They run in the background and process Redis streams.

---

## Architecture Decisions

### Modular Design
Each channel/feature is a self-contained module with clear boundaries. This enables:
- Independent development and testing
- Easy addition of new channels
- Clear separation of concerns
- Reduced merge conflicts

### Shared Services Pattern
Common functionality (contact resolution, workflow checking) is extracted to shared services to avoid duplication.

### Worker Pattern
Background jobs use Redis Streams with consumer groups for reliable, distributed processing.

### Multi-Provider Support
Email and auth support multiple providers via factory and strategy patterns.

---

## Future Improvements

1. **Extract Ticketing Module** - Move ticketing to its own module like other features
2. **Add SMS Module** - Create dedicated SMS module (currently in webhooks)
3. **Webhook Router** - Centralize webhook routing logic
4. **Shared Types** - Add TypeScript or JSDoc for better IDE support
5. **Testing** - Add unit and integration tests for each module

---

## Testing

### Manual Testing Checklist

**Email:**
- [ ] Send outbound email via SES
- [ ] Receive inbound email
- [ ] Gmail OAuth flow
- [ ] Outlook OAuth flow

**WhatsApp:**
- [ ] Send outbound WhatsApp message
- [ ] Receive inbound WhatsApp message
- [ ] Verify status callbacks

**Phone:**
- [ ] Make outbound call
- [ ] Receive inbound call
- [ ] Test AI conversation (legacy mode)
- [ ] Test AI conversation (realtime mode)

**Widget:**
- [ ] Initialize widget on webpage
- [ ] Send message from widget
- [ ] Receive AI response

**Auth:**
- [ ] Legacy login/register
- [ ] Supabase OTP flow

---

## Troubleshooting

### Common Issues

**Worker not processing:**
- Check Redis connection
- Verify consumer group exists
- Check worker logs

**WebSocket connection fails:**
- Verify firewall allows WS connections
- Check server upgrade handler in index.js
- Verify client connects to correct path

**Email not sending:**
- Check SES identity verification
- Verify AWS credentials
- Check email provider configuration

**Phone calls failing:**
- Verify Twilio credentials
- Check TwiML webhook URLs
- Ensure Azure Speech Services key is valid

---

## Support

For questions or issues, please contact the development team or refer to the project wiki.
