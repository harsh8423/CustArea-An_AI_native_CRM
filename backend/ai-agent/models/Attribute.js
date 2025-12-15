const mongoose = require('mongoose');

const attributeValueSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    keywords: [{ type: String }],
    examples: [{ type: String }]
}, { _id: false });

const attributeSchema = new mongoose.Schema({
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

    // Attribute name
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },

    // Purpose of the attribute
    purpose: {
        type: String,
        enum: ['escalation', 'routing', 'filtering', 'reporting'],
        required: true
    },

    // Possible values
    values: [attributeValueSchema],

    // Detection configuration
    detectionMethod: {
        type: String,
        enum: ['llm', 'keyword', 'regex'],
        default: 'llm'
    },

    // Whether this attribute is required for every conversation
    isRequired: {
        type: Boolean,
        default: false
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
attributeSchema.index({ tenantId: 1, purpose: 1 });
attributeSchema.index({ agentId: 1 });

// Pre-defined attribute templates
const ATTRIBUTE_TEMPLATES = {
    sentiment: {
        name: 'Sentiment',
        description: 'Detect how happy or frustrated the customer is.',
        purpose: 'escalation',
        values: [
            { name: 'Positive', description: 'Customer is happy, satisfied, or grateful', keywords: ['thank you', 'great', 'awesome', 'perfect'] },
            { name: 'Neutral', description: 'Customer is neutral or just asking a question', keywords: [] },
            { name: 'Negative', description: 'Customer is unhappy, frustrated, or angry', keywords: ['frustrated', 'angry', 'upset', 'terrible', 'worst'] }
        ]
    },
    issueType: {
        name: 'Issue Type',
        description: 'Detect what the customer needs help with.',
        purpose: 'routing',
        values: [
            { name: 'Billing', description: 'Questions about payments, invoices, refunds', keywords: ['payment', 'invoice', 'refund', 'charge'] },
            { name: 'Technical', description: 'Technical issues, bugs, errors', keywords: ['error', 'bug', 'not working', 'broken'] },
            { name: 'Account', description: 'Account access, login, settings', keywords: ['login', 'password', 'account', 'settings'] },
            { name: 'General', description: 'General inquiries and questions', keywords: [] }
        ]
    },
    urgency: {
        name: 'Urgency',
        description: 'Detect how quickly the customer needs a response.',
        purpose: 'escalation',
        values: [
            { name: 'Low', description: 'No urgency, general question', keywords: [] },
            { name: 'Medium', description: 'Needs help soon but not critical', keywords: ['soon', 'quickly'] },
            { name: 'High', description: 'Urgent issue requiring immediate attention', keywords: ['urgent', 'asap', 'immediately', 'critical', 'emergency'] }
        ]
    },
    complexity: {
        name: 'Complexity',
        description: 'Detect how complex the customer query is.',
        purpose: 'escalation',
        values: [
            { name: 'Simple', description: 'Can be answered with standard information', keywords: [] },
            { name: 'Moderate', description: 'Requires some investigation or multiple steps', keywords: [] },
            { name: 'Complex', description: 'Requires specialized knowledge or escalation', keywords: [] }
        ]
    }
};

const Attribute = mongoose.model('Attribute', attributeSchema);

module.exports = { Attribute, ATTRIBUTE_TEMPLATES };
