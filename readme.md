# CustArea: AI-Native Customer Relationship Platform

> **An intelligent, omni-channel CRM platform that combines conversational AI, workflow automation, and modern customer engagement to deliver next-generation customer experience.**

---

## 1. Executive Overview

**CustArea** is a multi-tenant, AI-native Customer Relationship Management (CRM) platform designed to revolutionize how businesses manage customer interactions. The platform seamlessly integrates:

- **🤖 Conversational AI** — Intelligent agents with RAG (Retrieval-Augmented Generation), guardrails, and automated escalation
- **📱 Omni-Channel Messaging** — WhatsApp, Email, Phone (Voice), and Live Chat Widget
- **⚡ Workflow Automation** — Visual workflow builder with event-driven execution
- **📊 Sales Pipeline Management** — Contacts, leads, pipelines, and customer lifecycle tracking
- **🎫 Support Ticketing** — Full-featured ticketing system with macros and tags

### Key Differentiators

| Feature | Traditional CRM | CustArea |
|---------|-----------------|----------|
| AI Integration | Add-on/Limited | Native, configurable AI agents |
| Channel Support | Siloed | Unified omni-channel inbox |
| Automation | Rule-based | Graph-based workflow engine |
| Real-time Comm | Limited | WebSocket-powered voice & chat |
| Knowledge Base | Static FAQs | Vector-based semantic search |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```mermaid
flowchart TB
    subgraph External["External Channels"]
        WA[WhatsApp<br/>Twilio]
        Email[Email<br/>AWS SES]
        Phone[Phone<br/>Twilio Voice]
        Website[Website<br/>Chat Widget]
    end
    
    subgraph CustArea["CustArea Platform"]
        subgraph Frontend["Frontend Layer"]
            Client[Next.js Client<br/>Dashboard & UI]
            Widget[Chat Widget<br/>Embeddable JS]
        end
        
        subgraph Backend["Backend Services"]
            API[Express.js API<br/>Port 8000]
            WF[Workflow Service<br/>Port 8001]
        end
        
        subgraph Workers["Background Workers"]
            WAWorker[WhatsApp Worker]
            EmailWorker[Email Worker]
            AIWorker[AI Incoming Worker]
            EventWorker[Event Worker]
            SchedulerWorker[Scheduler Worker]
        end
        
        subgraph Data["Data Layer"]
            PG[(PostgreSQL<br/>Relational Data)]
            MongoDB[(MongoDB<br/>AI Agent Config)]
            Redis[(Redis Streams<br/>Message Queues)]
        end
        
        subgraph AI["AI Layer"]
            OpenAI[OpenAI GPT-4o]
            Groq[Groq LLaMA]
            VectorDB[Vector Embeddings]
        end
    end
    
    WA --> API
    Email --> API
    Phone --> API
    Website --> Widget
    Widget --> API
    
    Client --> API
    Client --> WF
    
    API <--> Redis
    WF <--> Redis
    
    Redis --> WAWorker
    Redis --> EmailWorker
    Redis --> AIWorker
    Redis --> EventWorker
    
    API <--> PG
    WF <--> PG
    API <--> MongoDB
    
    AIWorker --> OpenAI
    AIWorker --> Groq
    AIWorker --> VectorDB
```

### 2.2 Service Decomposition

| Service | Technology | Port | Responsibility |
|---------|------------|------|----------------|
| **Backend API** | Node.js + Express | 8000 | Core API, webhooks, WebSocket handlers |
| **Workflow Service** | Node.js + Express | 8001 | Workflow execution, scheduling, triggers |
| **Frontend Client** | Next.js + TypeScript | 3000 | Dashboard UI, workflow builder |
| **Chat Widget** | Vite + TypeScript | N/A | Embeddable customer chat |
| **PostgreSQL** | PostgreSQL 15+ | 5432 | Core relational data |
| **MongoDB** | MongoDB 6+ | 27017 | AI agent configuration |
| **Redis** | Redis 7+ | 6379 | Message queuing, pub/sub |

---

## 3. Database Architecture

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    TENANTS ||--o{ USERS : has
    TENANTS ||--o{ CONTACTS : owns
    TENANTS ||--o{ PIPELINES : manages
    TENANTS ||--o{ LEADS : tracks
    TENANTS ||--o{ CONVERSATIONS : maintains
    TENANTS ||--o{ TICKETS : handles
    TENANTS ||--o{ WORKFLOWS : automates
    
    CONTACTS ||--o{ LEADS : becomes
    CONTACTS ||--o{ ACCOUNTS : converts_to
    CONTACTS ||--o{ CONVERSATIONS : participates
    
    PIPELINES ||--|{ PIPELINE_STAGES : contains
    PIPELINE_STAGES ||--o{ LEADS : holds
    
    LEADS }o--|| USERS : assigned_to
    CONVERSATIONS ||--|{ MESSAGES : contains
    
    WORKFLOWS ||--|{ WORKFLOW_VERSIONS : versioned_by
    WORKFLOWS ||--o{ WORKFLOW_RUNS : executes
    WORKFLOW_RUNS ||--|{ WORKFLOW_RUN_NODES : tracks
    
    TENANTS {
        uuid id PK
        string name
        string status
        string plan
        boolean ai_enabled
        string ai_mode
    }
    
    CONTACTS {
        uuid id PK
        uuid tenant_id FK
        string name
        string email
        string phone
        string source
    }
    
    LEADS {
        uuid id PK
        uuid tenant_id FK
        uuid contact_id FK
        uuid pipeline_id FK
        uuid stage_id FK
        uuid owner_id FK
        string status
        int score
    }
    
    CONVERSATIONS {
        uuid id PK
        uuid tenant_id FK
        uuid contact_id FK
        string channel
        string status
        string ai_mode
    }
    
    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        string direction
        string role
        string channel
        text content_text
        string status
    }
    
    WORKFLOWS {
        uuid id PK
        uuid tenant_id FK
        string name
        boolean is_active
    }
    
    TICKETS {
        uuid id PK
        uuid tenant_id FK
        uuid contact_id FK
        string subject
        string status
        string priority
    }
```

### 3.2 Multi-Tenancy Model

CustArea implements a **shared database, shared schema** multi-tenancy model with tenant isolation enforced at the application layer:

- Every table includes `tenant_id` foreign key
- Row-level filtering applied to all queries
- Tenant-specific configurations stored in `tenant_settings`
- Per-tenant WhatsApp/Email credentials in dedicated tables

---

## 4. Core Modules

### 4.1 Omni-Channel Messaging

```mermaid
flowchart LR
    subgraph Inbound["Inbound Messages"]
        WA_IN[WhatsApp Webhook]
        EMAIL_IN[Email Webhook]
        PHONE_IN[Phone Call]
        WIDGET_IN[Chat Widget]
    end
    
    subgraph Processing["Message Processing"]
        RESOLVER[Contact Resolver<br/>Cross-channel ID]
        CONV[Conversation Manager<br/>Thread continuity]
        QUEUE[Redis Queue]
    end
    
    subgraph Routes["Routing Decision"]
        WF_CHECK{Has Active<br/>Workflow?}
        AI_CHECK{AI Agent<br/>Enabled?}
    end
    
    subgraph Actions["Action Handlers"]
        WF_ENGINE[Workflow Engine]
        AI_AGENT[AI Agent Service]
        HUMAN[Human Agent Queue]
    end
    
    WA_IN --> RESOLVER
    EMAIL_IN --> RESOLVER
    PHONE_IN --> RESOLVER
    WIDGET_IN --> RESOLVER
    
    RESOLVER --> CONV
    CONV --> QUEUE
    QUEUE --> WF_CHECK
    
    WF_CHECK -->|Yes| WF_ENGINE
    WF_CHECK -->|No| AI_CHECK
    AI_CHECK -->|Yes| AI_AGENT
    AI_CHECK -->|No| HUMAN
```

**Channels Supported:**
- **WhatsApp Business** — Via Twilio API with message status tracking
- **Email** — AWS SES for sending, webhook for receiving
- **Phone/Voice** — Twilio Voice with real-time AI conversation
- **Live Chat Widget** — Embeddable JavaScript widget for websites

### 4.2 AI Agent System

The AI Agent module provides intelligent, configurable conversational AI with enterprise-grade controls:

```mermaid
flowchart TB
    subgraph Input["Incoming Message"]
        MSG[User Message]
    end
    
    subgraph Safety["Safety Layer"]
        GUARD_IN[Input Guardrails<br/>Keyword/Regex filters]
    end
    
    subgraph Intelligence["Intelligence Layer"]
        ATTR[Attribute Detection<br/>Sentiment, Intent, Urgency]
        ESC[Escalation Rules<br/>Condition matching]
        KB[Knowledge Base<br/>Vector Search RAG]
        CONTEXT[Context Builder<br/>Contact + History]
    end
    
    subgraph Generation["Response Generation"]
        PROMPT[System Prompt Builder<br/>Guidance + Guardrails]
        LLM[LLM Provider<br/>OpenAI / Groq]
        TOOLS[Function Calling<br/>CRM Actions]
    end
    
    subgraph Output["Output"]
        GUARD_OUT[Output Guardrails]
        RESPONSE[Final Response]
        ESCALATE[Escalate to Human]
    end
    
    MSG --> GUARD_IN
    GUARD_IN -->|Pass| ATTR
    GUARD_IN -->|Block| RESPONSE
    
    ATTR --> ESC
    ESC -->|Match| ESCALATE
    ESC -->|No Match| KB
    
    KB --> CONTEXT
    CONTEXT --> PROMPT
    PROMPT --> LLM
    LLM --> TOOLS
    TOOLS --> GUARD_OUT
    GUARD_OUT --> RESPONSE
```

**AI Agent Features:**

| Feature | Description |
|---------|-------------|
| **Multi-LLM Support** | OpenAI GPT-4o/4o-mini, Groq LLaMA 3.1 |
| **Knowledge Base RAG** | Document ingestion with vector embeddings for semantic search |
| **Guidance System** | Configurable tone, style, and response patterns |
| **Guardrails** | Input/output filtering with keyword, regex, and AI-based detection |
| **Attribute Detection** | Automatic sentiment, intent, and urgency classification |
| **Escalation Rules** | Condition-based routing to human agents |
| **Function Calling** | CRM actions (create ticket, update lead, etc.) via tool use |

### 4.3 Workflow Automation Engine

The visual workflow builder enables no-code automation with event-driven execution:

```mermaid
flowchart TB
    subgraph Triggers["Trigger Nodes"]
        T1[WhatsApp Message]
        T2[Email Received]
        T3[New Contact]
        T4[Lead Stage Change]
        T5[Scheduled Time]
    end
    
    subgraph Logic["Logic Nodes"]
        L1[If/Else Branch]
        L2[Switch Case]
        L3[Delay/Wait]
    end
    
    subgraph AI["AI Nodes"]
        A1[AI Response<br/>Generate text]
        A2[Classify Intent]
        A3[Extract Data]
    end
    
    subgraph Actions["Output Nodes"]
        O1[Send WhatsApp]
        O2[Send Email]
        O3[Create Lead]
        O4[Create Ticket]
        O5[Assign User]
    end
    
    T1 --> L1
    T2 --> L1
    L1 -->|Condition A| A1
    L1 -->|Condition B| L3
    
    A1 --> O1
    L3 --> O2
    
    T3 --> O3
    T4 --> L2
    L2 --> O4
    L2 --> O5
```

**Workflow Engine Architecture:**

```mermaid
sequenceDiagram
    participant Trigger as Trigger Event
    participant Redis as Redis Stream
    participant Worker as Event Worker
    participant Executor as Workflow Executor
    participant DB as PostgreSQL
    participant Nodes as Node Handlers
    
    Trigger->>Redis: Publish trigger event
    Redis->>Worker: Consume event
    Worker->>DB: Find matching workflows
    Worker->>DB: Create workflow_run
    Worker->>Executor: executeRun(runId)
    
    loop Each Node
        Executor->>DB: Create node_run record
        Executor->>Nodes: Execute node handler
        Nodes-->>Executor: Return output
        Executor->>Executor: Add to context
        Executor->>Executor: Find next node
    end
    
    alt Delay Node
        Executor->>DB: Schedule resume job
        Executor->>DB: Set status = 'waiting'
    else Completion
        Executor->>DB: Set status = 'completed'
    end
```

**Node Categories:**

| Category | Nodes |
|----------|-------|
| **Triggers** | WhatsApp Message, Email Received, New Contact, Scheduled |
| **Logic** | If/Else, Switch, Delay, Stop |
| **AI** | AI Response, Classify, Extract |
| **Output** | Send WhatsApp, Send Email, Create Lead, Create Ticket, Assign User |

### 4.4 Sales CRM

```mermaid
flowchart LR
    subgraph Acquisition["Acquisition"]
        C1[Import CSV]
        C2[WhatsApp Inbound]
        C3[Email Inbound]
        C4[Widget Chat]
        C5[Manual Entry]
    end
    
    subgraph Management["Contact Management"]
        CONTACT[Contact<br/>Identity wrapper]
        DEDUP[Cross-channel<br/>Deduplication]
    end
    
    subgraph Pipeline["Sales Pipeline"]
        LEAD[Lead Created]
        S1[Stage 1: New]
        S2[Stage 2: Qualified]
        S3[Stage 3: Proposal]
        S4[Stage 4: Closed]
    end
    
    subgraph Outcome["Outcome"]
        WON[Account/Customer]
        LOST[Lost/Archived]
    end
    
    C1 --> CONTACT
    C2 --> CONTACT
    C3 --> CONTACT
    C4 --> CONTACT
    C5 --> CONTACT
    
    CONTACT --> DEDUP
    DEDUP --> LEAD
    
    LEAD --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    
    S4 -->|Won| WON
    S4 -->|Lost| LOST
```

**CRM Features:**
- **Contact Management** — Unified contact identity across channels
- **Lead Board** — Kanban-style pipeline visualization
- **Pipeline Customization** — Custom stages and multiple pipelines
- **Assignment** — Manual and round-robin user assignment
- **Activity Tracking** — Complete interaction history

### 4.5 Support Ticketing

```mermaid
stateDiagram-v2
    [*] --> New: Ticket Created
    New --> Open: Agent Views
    Open --> Pending: Awaiting Customer
    Pending --> Open: Customer Replies
    Open --> Resolved: Issue Fixed
    Resolved --> Open: Reopened
    Resolved --> Closed: Auto-close after N days
    Closed --> [*]
    
    note right of New: Auto-created from<br/>workflow or AI
    note right of Open: SLA timer active
    note right of Pending: SLA paused
```

**Ticketing Features:**
- **Auto-creation** — Tickets from workflows, AI, or manual
- **Priority Levels** — Urgent, High, Normal, Low
- **Tags** — Custom categorization and filtering
- **Macros** — Pre-defined response templates
- **Assignment** — Individual or team assignment
- **SLA Tracking** — Response and resolution timers

---

## 5. Technical Workflows

### 5.1 Inbound WhatsApp Message Flow

```mermaid
sequenceDiagram
    participant User as Customer
    participant Twilio as Twilio
    participant Webhook as Backend Webhook
    participant ContactRes as Contact Resolver
    participant ConvMgr as Conversation Manager
    participant Redis as Redis Queue
    participant WFCheck as Workflow Check
    participant WFService as Workflow Service
    participant AIAgent as AI Agent
    participant OutWorker as Outbound Worker
    
    User->>Twilio: Send WhatsApp Message
    Twilio->>Webhook: POST /webhook/twilio/whatsapp
    
    Webhook->>ContactRes: findOrCreateContact(phone)
    ContactRes-->>Webhook: {contact, isNew}
    
    Webhook->>ConvMgr: getOrCreateConversation()
    ConvMgr-->>Webhook: conversation
    
    Webhook->>Webhook: Create message record
    
    Webhook->>WFCheck: hasTriggerWorkflow?
    
    alt Has Active Workflow
        WFCheck-->>Webhook: true
        Webhook->>Redis: Queue with trigger_data
        Redis->>WFService: Event Worker picks up
        WFService->>WFService: Execute workflow nodes
        WFService->>Redis: Queue outbound message
    else No Workflow, AI Enabled
        WFCheck-->>Webhook: false
        Webhook->>Redis: Queue for AI
        Redis->>AIAgent: AI Worker picks up
        AIAgent->>AIAgent: RAG + LLM processing
        AIAgent->>Redis: Queue response
    end
    
    Redis->>OutWorker: WhatsApp outbound worker
    OutWorker->>Twilio: Send message
    Twilio->>User: Deliver response
```

### 5.2 Workflow Execution Lifecycle

```mermaid
sequenceDiagram
    participant Event as Trigger Event
    participant EW as Event Worker
    participant DB as PostgreSQL
    participant Pool as Executor Pool
    participant Exec as Executor
    participant Registry as Node Registry
    participant Handler as Node Handler
    
    Event->>EW: Trigger data received
    EW->>DB: Find workflows by trigger_type
    
    loop Each Matching Workflow
        EW->>DB: Create workflow_run (pending)
        EW->>Pool: Enqueue runId
    end
    
    Pool->>Exec: new Executor(run, version, tenant)
    Exec->>Exec: updateRunStatus('running')
    
    Exec->>Exec: findTriggerNode()
    
    loop While currentNode exists
        Exec->>DB: Create node_run record
        Exec->>Registry: getHandler(node.type)
        Registry-->>Exec: handler
        
        Exec->>Exec: resolveConfig(config, context)
        Exec->>Handler: handler.execute({config, context, ...})
        Handler-->>Exec: output
        
        Exec->>Exec: addToContext(nodeId, output)
        Exec->>DB: Update node_run (completed)
        Exec->>Exec: findNextNodes()
        
        alt Output is 'wait'
            Exec->>DB: Create scheduled_job
            Exec->>DB: Set run status = 'waiting'
            Exec-->>Pool: Return {waiting}
        else Output is 'stop'
            Exec->>DB: Set run status = 'completed'
            Exec-->>Pool: Return {stopped}
        end
    end
    
    Exec->>DB: Set run status = 'completed'
```

### 5.3 AI Agent Chat Processing

```mermaid
sequenceDiagram
    participant Worker as AI Worker
    participant Agent as Agent Service
    participant Guardrails as Guardrails Check
    participant AttrDet as Attribute Detector
    participant EscRules as Escalation Rules
    participant KB as Knowledge Base
    participant LLM as LLM Provider
    
    Worker->>Agent: chat(tenantId, convId, message)
    Agent->>Agent: getAgentForTenant()
    
    Agent->>Guardrails: checkInputGuardrails()
    
    alt Guardrail Triggered
        Guardrails-->>Agent: {blocked, response}
        Agent-->>Worker: Return guardrail response
    end
    
    Agent->>AttrDet: detectAttributes(message)
    AttrDet-->>Agent: {Sentiment, Intent, Urgency...}
    
    Agent->>EscRules: checkEscalationRules(attributes)
    
    alt Escalation Matched
        EscRules-->>Agent: {shouldEscalate, team, priority}
        Agent-->>Worker: Return escalation response
    end
    
    Agent->>KB: getKnowledgeContext(query)
    KB-->>Agent: Relevant documents
    
    Agent->>Agent: buildSystemPrompt()
    Agent->>Agent: buildConversationContext()
    
    Agent->>LLM: chat.completions.create(messages, tools)
    LLM-->>Agent: Response (possibly with tool_calls)
    
    alt Has Tool Calls
        Agent->>Agent: executeTool() for each
        Agent->>LLM: Follow-up completion
        LLM-->>Agent: Final response
    end
    
    Agent->>Guardrails: checkOutputGuardrails()
    Agent-->>Worker: Final response
```

---

## 6. Technology Stack

### 6.1 Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **React Flow** | Visual workflow builder |
| **Zustand** | State management |

### 6.2 Backend

| Technology | Purpose |
|------------|---------|
| **Node.js 20+** | Runtime environment |
| **Express.js** | HTTP server framework |
| **PostgreSQL** | Primary relational database |
| **MongoDB** | AI agent configuration store |
| **Redis Streams** | Message queue and pub/sub |
| **WebSocket (ws)** | Real-time communication |

### 6.3 AI/ML Stack

| Technology | Purpose |
|------------|---------|
| **OpenAI API** | GPT-4o, GPT-4o-mini LLMs |
| **Groq API** | LLaMA 3.1 for fast inference |
| **OpenAI Embeddings** | text-embedding-3-small |
| **Vector Search** | Semantic document retrieval |
| **Azure Speech** | Speech-to-Text / Text-to-Speech |

### 6.4 External Integrations

| Service | Purpose |
|---------|---------|
| **Twilio** | WhatsApp Business API, Voice |
| **AWS SES** | Email sending |
| **Azure Cognitive** | Speech services |

---

## 7. Security & Compliance

### 7.1 Access Control

```mermaid
flowchart TD
    subgraph Auth["Authentication"]
        JWT[JWT Token Auth]
        PWD[Password Hashing<br/>bcrypt]
    end
    
    subgraph Roles["Role-Based Access"]
        OWNER[Owner<br/>Full access]
        ADMIN[Admin<br/>Tenant config]
        MANAGER[Manager<br/>Team oversight]
        AGENT[Agent<br/>Daily operations]
    end
    
    subgraph Isolation["Tenant Isolation"]
        FILTER[Row-level filtering]
        CREDS[Per-tenant credentials]
    end
    
    JWT --> OWNER
    JWT --> ADMIN
    JWT --> MANAGER
    JWT --> AGENT
    
    OWNER --> FILTER
    ADMIN --> FILTER
    MANAGER --> FILTER
    AGENT --> FILTER
```

### 7.2 Security Features

| Feature | Implementation |
|---------|----------------|
| **Authentication** | JWT-based stateless auth |
| **Password Security** | bcrypt hashing |
| **API Security** | Helmet.js, CORS configuration |
| **Tenant Isolation** | Application-level row filtering |
| **Credential Storage** | Per-tenant encrypted API keys |
| **Input Validation** | Request sanitization |
| **AI Guardrails** | Content filtering for AI responses |

---

## 8. Real-Time Capabilities

### 8.1 WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/client-audio` | Browser STT streaming |
| `/openai-realtime` | OpenAI Realtime API |
| `/twilio-stream` | Twilio Media Streams |
| `/phone-ws/legacy/*` | Legacy voice handler |
| `/phone-ws/realtime/*` | Realtime AI voice |
| `/phone-ws/convrelay/*` | Conversation relay |

### 8.2 Voice AI Architecture

```mermaid
flowchart LR
    subgraph Caller["Phone Call"]
        PHONE[Inbound Call]
    end
    
    subgraph Twilio["Twilio Voice"]
        VOICE[Voice Webhook]
        STREAM[Media Stream<br/>WebSocket]
    end
    
    subgraph Backend["CustArea Backend"]
        WS[WebSocket Handler]
        STT[Speech-to-Text]
        LLM[LLM Processing]
        TTS[Text-to-Speech]
    end
    
    subgraph AI["AI Providers"]
        AZURE[Azure Speech]
        OPENAI[OpenAI/Groq]
    end
    
    PHONE --> VOICE
    VOICE --> STREAM
    STREAM <--> WS
    
    WS --> STT
    STT --> AZURE
    AZURE --> LLM
    LLM --> OPENAI
    OPENAI --> TTS
    TTS --> AZURE
    AZURE --> WS
    WS --> STREAM
```

---

## 9. Observability

### 9.1 Logging & Monitoring

| Component | Tool |
|-----------|------|
| **HTTP Logging** | Morgan (dev format) |
| **Custom Logger** | Winston-compatible module |
| **Workflow Logs** | `workflow_run_logs` table |
| **Node Execution** | `workflow_run_nodes` with timing |

### 9.2 Workflow Observability

```mermaid
flowchart TB
    subgraph Execution["Workflow Execution"]
        RUN[workflow_runs<br/>Status, context, timing]
        NODES[workflow_run_nodes<br/>Per-node execution]
        LOGS[workflow_run_logs<br/>Debug traces]
    end
    
    subgraph Metrics["Available Metrics"]
        M1[Execution Time]
        M2[Node Count]
        M3[Success/Failure Rate]
        M4[Queue Depth]
    end
    
    RUN --> M1
    RUN --> M3
    NODES --> M2
    NODES --> M1
```

---

## 10. Project Structure

```
CustArea/
├── backend/                    # Main API Server (Port 8000)
│   ├── ai-agent/              # AI Agent Module
│   │   ├── models/            # Mongoose models (Agent, Guidance, etc.)
│   │   ├── services/          # Core AI services
│   │   │   ├── agentService.js        # Main chat processing
│   │   │   ├── embeddingService.js    # Vector embeddings
│   │   │   ├── vectorSearchService.js # RAG retrieval
│   │   │   └── functionTools.js       # LLM tool definitions
│   │   └── routes/            # AI Agent API routes
│   ├── controllers/           # Request handlers
│   │   ├── authController.js
│   │   ├── contactController.js
│   │   ├── conversationController.js
│   │   ├── leadController.js
│   │   ├── messageController.js
│   │   └── ticketController.js
│   ├── services/              # Business logic
│   │   ├── whatsappService.js
│   │   ├── contactResolver.js
│   │   └── workflowCheckService.js
│   ├── workers/               # Background processors
│   │   ├── whatsappOutbound.js
│   │   ├── emailOutbound.js
│   │   └── aiIncomingWorker.js
│   ├── phone/                 # Voice/Phone module
│   └── chat_widget/           # Widget backend
│
├── workflow-service/          # Workflow Engine (Port 8001)
│   ├── engine/               # Core execution
│   │   ├── executor.js       # Main workflow runner
│   │   ├── context.js        # Expression resolution
│   │   ├── graphTraversal.js # Node navigation
│   │   └── scheduler.js      # Delayed execution
│   ├── nodes/                # Node type handlers
│   │   ├── triggers/         # Trigger nodes
│   │   ├── logic/            # If/Else, Switch, Delay
│   │   ├── ai/               # AI response nodes
│   │   ├── output/           # WhatsApp, Email, etc.
│   │   └── registry.js       # Node type registry
│   ├── workers/              # Event processing
│   │   ├── eventWorker.js
│   │   └── schedulerWorker.js
│   └── routes/               # Workflow API
│
├── client/                   # Next.js Frontend
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/  # Protected routes
│       │   │   ├── ai-agent/ # AI configuration
│       │   │   ├── campaign/ # Marketing campaigns
│       │   │   ├── conversation/ # Inbox
│       │   │   ├── dashboard/   # Overview
│       │   │   ├── sales/       # CRM module
│       │   │   ├── settings/    # Configuration
│       │   │   ├── tickets/     # Support tickets
│       │   │   └── workflow/    # Workflow builder
│       │   └── (public)/     # Auth pages
│       └── components/       # Shared UI
│
├── chat-widget/              # Embeddable Widget
│   └── widget/              # Vite + TypeScript
│
└── db/                       # Database
    ├── schema.sql           # Core schema
    └── migrations/          # Schema changes
```

---

## 11. Key Innovations

### 11.1 Cross-Channel Contact Resolution

The platform implements intelligent contact deduplication across all channels:

```mermaid
flowchart TD
    subgraph Input["Incoming Identifiers"]
        WA[WhatsApp: +1234567890]
        EMAIL[Email: john@example.com]
        WIDGET[Widget Session]
    end
    
    subgraph Resolver["Contact Resolver"]
        PHONE_MATCH[Phone Match?]
        EMAIL_MATCH[Email Match?]
        CREATE[Create New]
    end
    
    subgraph Output["Result"]
        CONTACT[Unified Contact<br/>Single identity]
    end
    
    WA --> PHONE_MATCH
    EMAIL --> EMAIL_MATCH
    WIDGET --> PHONE_MATCH
    
    PHONE_MATCH -->|Found| CONTACT
    PHONE_MATCH -->|Not Found| EMAIL_MATCH
    EMAIL_MATCH -->|Found| CONTACT
    EMAIL_MATCH -->|Not Found| CREATE
    CREATE --> CONTACT
```

### 11.2 Workflow Context System

The workflow engine maintains a rich execution context that flows through all nodes:

```javascript
context = {
    trigger: {
        trigger_type: 'whatsapp_message',
        sender: { phone: '+1234567890', name: 'John' },
        message: { body: 'Hello!', id: 'msg_123' },
        contact_id: 'contact_uuid',
        conversation_id: 'conv_uuid'
    },
    nodes: {
        'node_1': { /* output from node 1 */ },
        'node_2': { /* output from node 2 */ }
    }
}
```

Expression resolution allows dynamic references:
- `{{trigger.sender.phone}}` → `+1234567890`
- `{{nodes.ai_response.output.text}}` → AI-generated text

### 11.3 AI Safety Architecture

Multi-layered safety controls ensure responsible AI usage:

1. **Input Guardrails** — Block harmful inputs before processing
2. **Guidance System** — Steer AI behavior with configurable prompts
3. **Attribute Detection** — Classify message characteristics
4. **Escalation Rules** — Route to humans based on conditions
5. **Output Guardrails** — Filter AI-generated responses
6. **Knowledge Grounding** — RAG reduces hallucination

---

## 12. Summary

CustArea represents a modern approach to customer relationship management, combining:

- **Unified Customer View** — Single contact identity across all channels
- **AI-First Design** — Intelligent automation with human oversight
- **Visual Automation** — No-code workflow builder for business users
- **Enterprise Controls** — Guardrails, escalation, and audit trails
- **Real-Time Engagement** — WebSocket-powered voice and chat
- **Scalable Architecture** — Microservices with event-driven processing

The platform is built for extensibility, allowing easy addition of new channels, AI capabilities, and workflow nodes as customer needs evolve.

---

*Document generated: December 2024*
