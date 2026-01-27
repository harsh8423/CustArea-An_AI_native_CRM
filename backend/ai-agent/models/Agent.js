const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
    // Tenant reference (links to PostgreSQL tenant)
    tenantId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Agent identity
    name: {
        type: String,
        required: true,
        default: 'AI Assistant'
    },
    description: {
        type: String,
        default: ''
    },
    avatar: {
        type: String,
        default: null
    },

    // LLM Configuration
    llmProvider: {
        type: String,
        enum: ['openai', 'groq'],
        default: 'openai'
    },
    llmModel: {
        type: String,
        default: 'gpt-4o-mini'
    },
    temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2
    },
    maxTokens: {
        type: Number,
        default: 4096,
        min: 100,
        max: 16384
    },

    // System prompt (base instructions)
    systemPrompt: {
        type: String,
        default: `You are a helpful AI assistant. Your role is to assist customers with their queries professionally and accurately.

Key behaviors:
- Be concise and clear in your responses
- Ask clarifying questions when needed
- Escalate to a human agent when you cannot help
- Never make up information you don't know`
    },

    // Agent status
    isActive: {
        type: Boolean,
        default: false
    },

    // Channel configuration
    enabledChannels: {
        type: [String],
        enum: ['widget', 'whatsapp', 'email', 'phone'],
        default: ['widget']
    },

    // Behavior settings
    autoReply: {
        type: Boolean,
        default: true
    },
    welcomeMessage: {
        type: String,
        default: 'Hello! How can I help you today?'
    },
    fallbackMessage: {
        type: String,
        default: "I'm not sure how to help with that. Let me connect you with a human agent."
    },

    // Analytics
    totalConversations: {
        type: Number,
        default: 0
    },
    totalMessages: {
        type: Number,
        default: 0
    },
    resolutionRate: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

// Indexes
agentSchema.index({ tenantId: 1 });
agentSchema.index({ isActive: 1 });

const Agent = mongoose.model('Agent', agentSchema);

module.exports = Agent;
