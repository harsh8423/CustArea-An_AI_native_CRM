const mongoose = require('mongoose');

// Escalation Rule (deterministic, attribute-based)
const escalationRuleSchema = new mongoose.Schema({
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

    // Rule name
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },

    // Conditions (all must match = AND logic)
    conditions: [{
        attributeName: { type: String, required: true },
        operator: { 
            type: String, 
            enum: ['equals', 'notEquals', 'contains', 'in'],
            default: 'equals'
        },
        value: { type: mongoose.Schema.Types.Mixed, required: true }
    }],

    // Match mode
    matchMode: {
        type: String,
        enum: ['all', 'any'],  // all = AND, any = OR
        default: 'all'
    },

    // Action
    action: {
        type: String,
        enum: ['escalate', 'route', 'tag', 'priority'],
        default: 'escalate'
    },

    // Action config
    targetTeam: {
        type: String,
        default: 'support'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    tags: [{ type: String }],

    // Message to show when escalating
    escalationMessage: {
        type: String,
        default: "I'll connect you with a member of our team who can help further."
    },

    // Rule priority
    rulePriority: {
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

// Escalation Guidance (natural language, flexible)
const escalationGuidanceSchema = new mongoose.Schema({
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

    // Guidance title and content
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },

    // Examples of when to apply
    examples: [{
        scenario: String,
        action: String
    }],

    // Priority
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
escalationRuleSchema.index({ tenantId: 1, isActive: 1 });
escalationRuleSchema.index({ agentId: 1, rulePriority: -1 });

escalationGuidanceSchema.index({ tenantId: 1, isActive: 1 });
escalationGuidanceSchema.index({ agentId: 1, priority: -1 });

const EscalationRule = mongoose.model('EscalationRule', escalationRuleSchema);
const EscalationGuidance = mongoose.model('EscalationGuidance', escalationGuidanceSchema);

module.exports = { EscalationRule, EscalationGuidance };
