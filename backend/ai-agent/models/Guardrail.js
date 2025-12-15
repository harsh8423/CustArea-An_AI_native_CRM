const mongoose = require('mongoose');

const guardrailSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },

    // Guardrail type
    type: {
        type: String,
        enum: [
            'content_filter',       // Block inappropriate content
            'topic_restriction',    // Limit to certain topics
            'pii_protection',       // Prevent PII disclosure
            'response_limit',       // Max response length
            'forbidden_actions',    // Actions agent must never take
            'custom'                // Custom guardrail
        ],
        required: true
    },

    // Guardrail name and description
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },

    // Condition for guardrail (in natural language or structured)
    condition: {
        type: {
            type: String,
            enum: ['keyword', 'regex', 'llm_check', 'always'],
            default: 'always'
        },
        patterns: [{ type: String }],   // Keywords or regex patterns
        llmPrompt: { type: String }     // Prompt for LLM-based checking
    },

    // Action to take when triggered
    action: {
        type: String,
        enum: ['block', 'warn', 'redirect', 'modify'],
        default: 'block'
    },

    // Response when triggered
    triggerResponse: {
        type: String,
        default: "I'm not able to help with that request. Is there something else I can assist you with?"
    },

    // Redirect target (if action is 'redirect')
    redirectTo: {
        type: String,
        default: null
    },

    // Priority (higher = checked first)
    priority: {
        type: Number,
        default: 0
    },

    // Active status
    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

// Indexes
guardrailSchema.index({ tenantId: 1, type: 1 });
guardrailSchema.index({ agentId: 1, priority: -1 });

// Pre-defined guardrail templates
const GUARDRAIL_TEMPLATES = {
    noCompetitorDiscussion: {
        name: 'No Competitor Discussion',
        type: 'topic_restriction',
        description: 'Prevent the agent from discussing competitors',
        condition: {
            type: 'keyword',
            patterns: []  // Tenant fills in competitor names
        },
        action: 'redirect',
        triggerResponse: "I focus on helping with our products and services. How can I assist you with that?"
    },
    noPriceNegotiation: {
        name: 'No Price Negotiation',
        type: 'forbidden_actions',
        description: 'Agent cannot negotiate prices or offer discounts',
        condition: {
            type: 'keyword',
            patterns: ['discount', 'lower price', 'negotiate', 'deal', 'cheaper']
        },
        action: 'redirect',
        triggerResponse: "For pricing discussions, I'd recommend speaking with our sales team. Would you like me to connect you?"
    },
    noPiiDisclosure: {
        name: 'No PII Disclosure',
        type: 'pii_protection',
        description: 'Never share personal identifiable information',
        condition: {
            type: 'llm_check',
            llmPrompt: 'Check if the response contains any personal identifiable information like SSN, credit card numbers, full addresses, or passwords'
        },
        action: 'modify',
        triggerResponse: null // Modify response instead
    },
    profanityFilter: {
        name: 'Profanity Filter',
        type: 'content_filter',
        description: 'Block profane or inappropriate content',
        condition: {
            type: 'keyword',
            patterns: [] // Tenant can add
        },
        action: 'block',
        triggerResponse: "I'm here to help in a respectful manner. How can I assist you today?"
    }
};

const Guardrail = mongoose.model('Guardrail', guardrailSchema);

module.exports = { Guardrail, GUARDRAIL_TEMPLATES };
