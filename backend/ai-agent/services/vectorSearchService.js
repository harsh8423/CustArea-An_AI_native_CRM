const KnowledgeChunk = require('../models/KnowledgeChunk');
const { generateEmbedding, cosineSimilarity } = require('./embeddingService');

/**
 * Search for similar content using MongoDB Atlas Vector Search
 * Requires vector search index named 'vector_index' on knowledgechunks collection
 */
async function vectorSearch(tenantId, query, options = {}) {
    const {
        limit = 5,
        minScore = 0.7
    } = options;

    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // Use MongoDB Atlas Vector Search
        const results = await KnowledgeChunk.aggregate([
            {
                $vectorSearch: {
                    index: 'vector_index',
                    path: 'embedding',
                    queryVector: queryEmbedding,
                    numCandidates: limit * 10,
                    limit: limit,
                    filter: {
                        tenantId: tenantId
                    }
                }
            },
            {
                $project: {
                    content: 1,
                    sourceId: 1,
                    chunkIndex: 1,
                    metadata: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ]);

        // Filter by minimum score
        const filteredResults = results.filter(r => r.score >= minScore);

        return filteredResults;
    } catch (error) {
        // If vector search fails (index not created), fallback to brute force
        console.warn('Vector search failed, using fallback:', error.message);
        return fallbackSearch(tenantId, query, { limit, minScore });
    }
}

/**
 * Fallback search using brute force similarity calculation
 * Used when Atlas Vector Search is not available
 */
async function fallbackSearch(tenantId, query, options = {}) {
    const { limit = 5, minScore = 0.7 } = options;

    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);

        // Fetch all chunks for tenant
        const chunks = await KnowledgeChunk.find({ tenantId })
            .select('content sourceId chunkIndex embedding metadata')
            .lean();

        if (chunks.length === 0) {
            return [];
        }

        // Calculate similarity for each chunk
        const scored = chunks.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sort by score descending and filter
        const results = scored
            .filter(r => r.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ embedding, ...rest }) => rest); // Remove embedding from result

        return results;
    } catch (error) {
        console.error('Fallback search failed:', error);
        throw error;
    }
}

/**
 * Get context from knowledge base for a given query
 * Returns formatted context string for LLM
 */
async function getKnowledgeContext(tenantId, query, options = {}) {
    const results = await vectorSearch(tenantId, query, options);

    if (results.length === 0) {
        return null;
    }

    // Format results as context
    const contextParts = results.map((r, i) => 
        `[Source ${i + 1}] (relevance: ${(r.score * 100).toFixed(1)}%)\n${r.content}`
    );

    return {
        context: contextParts.join('\n\n---\n\n'),
        sources: results.map(r => ({
            sourceId: r.sourceId,
            chunkIndex: r.chunkIndex,
            score: r.score
        }))
    };
}

/**
 * Check if vector search index exists
 */
async function checkVectorIndex() {
    try {
        // Try a simple vector search
        const result = await KnowledgeChunk.aggregate([
            {
                $vectorSearch: {
                    index: 'vector_index',
                    path: 'embedding',
                    queryVector: new Array(768).fill(0),
                    numCandidates: 1,
                    limit: 1
                }
            }
        ]);
        return true;
    } catch (error) {
        if (error.message.includes('index not found') || error.message.includes('$vectorSearch')) {
            return false;
        }
        throw error;
    }
}

module.exports = {
    vectorSearch,
    fallbackSearch,
    getKnowledgeContext,
    checkVectorIndex
};
