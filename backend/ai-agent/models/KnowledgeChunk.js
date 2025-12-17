const mongoose = require('mongoose');

const knowledgeChunkSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true
    },
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeSource',
        required: true
    },

    // Chunk position
    chunkIndex: {
        type: Number,
        required: true
    },

    // Content
    content: {
        type: String,
        required: true
    },
    contentLength: {
        type: Number,
        default: 0
    },

    // Embedding vector (768 dimensions for Gemini text-embedding-004)
    embedding: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 768;
            },
            message: 'Embedding must be exactly 768 dimensions'
        }
    },

    // Metadata for context
    metadata: {
        pageNumber: { type: Number, default: null },
        section: { type: String, default: null },
        heading: { type: String, default: null }
    }

}, {
    timestamps: true
});

// Indexes for efficient querying
knowledgeChunkSchema.index({ tenantId: 1, sourceId: 1 });
knowledgeChunkSchema.index({ sourceId: 1, chunkIndex: 1 });

// NOTE: Vector search index must be created in MongoDB Atlas UI
// Index name: vector_index
// Configuration:
// {
//   "fields": [
//     { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
//     { "type": "filter", "path": "tenantId" }
//   ]
// }

const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);

module.exports = KnowledgeChunk;
