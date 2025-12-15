const mongoose = require('mongoose');

const guidanceSchema = new mongoose.Schema({
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

    // Guidance category
    category: {
        type: String,
        enum: [
            'communication_style',     // Vocabulary, tone, language
            'context_clarification',   // Follow-up questions
            'content_sources',         // Specific articles to reference
            'spam'                     // Spam handling
        ],
        required: true
    },

    // Guidance content
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },

    // Examples (good and bad)
    examples: {
        good: [{ type: String }],
        bad: [{ type: String }]
    },

    // Audience targeting (optional)
    audience: {
        conditions: [{
            field: String,      // e.g., 'plan', 'country', 'newUser'
            operator: String,   // 'equals', 'contains', 'notEquals'
            value: String
        }]
    },

    // Priority (higher = applied first)
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
guidanceSchema.index({ tenantId: 1, category: 1 });
guidanceSchema.index({ tenantId: 1, isActive: 1 });
guidanceSchema.index({ agentId: 1, priority: -1 });

const Guidance = mongoose.model('Guidance', guidanceSchema);

module.exports = Guidance;
