const mongoose = require('mongoose');

const knowledgeSourceSchema = new mongoose.Schema({
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

    // Source type
    type: {
        type: String,
        enum: ['pdf', 'article', 'url', 'text', 'faq'],
        required: true
    },

    // Source info
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    sourceUrl: {
        type: String,
        default: null
    },
    filename: {
        type: String,
        default: null
    },
    fileSize: {
        type: Number,
        default: 0
    },
    mimeType: {
        type: String,
        default: null
    },

    // Processing status
    status: {
        type: String,
        enum: ['pending', 'processing', 'processed', 'failed'],
        default: 'pending'
    },
    errorMessage: {
        type: String,
        default: null
    },

    // Processing stats
    totalChunks: {
        type: Number,
        default: 0
    },
    totalCharacters: {
        type: Number,
        default: 0
    },
    processedAt: {
        type: Date,
        default: null
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Priority for retrieval
    priority: {
        type: Number,
        default: 0
    },

    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

// Indexes
knowledgeSourceSchema.index({ tenantId: 1, status: 1 });
knowledgeSourceSchema.index({ tenantId: 1, type: 1 });
knowledgeSourceSchema.index({ agentId: 1 });

const KnowledgeSource = mongoose.model('KnowledgeSource', knowledgeSourceSchema);

module.exports = KnowledgeSource;
