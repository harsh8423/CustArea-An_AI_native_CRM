const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate embedding for a single text using Gemini embedding model
 * Returns 768-dimensional vector (text-embedding-004)
 */
async function generateEmbedding(text) {
    try {
        // Ensure text is a string
        if (typeof text !== 'string') {
            text = String(text || '');
        }
        
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        // Truncate if too long (Gemini has a limit)
        const truncatedText = text.slice(0, 10000);

        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: truncatedText,
        });

        const embedding = response.embeddings[0].values;

        if (!embedding || embedding.length === 0) {
            throw new Error('Empty embedding returned');
        }

        // Ensure 768 dimensions for MongoDB Atlas Vector Search
        if (embedding.length !== 768) {
            console.warn(`Warning: Expected 768 dimensions, got ${embedding.length}`);
        }

        return embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
async function generateBatchEmbeddings(texts) {
    try {
        if (!texts || texts.length === 0) {
            return [];
        }

        const results = [];
        
        // Process in batches of 100 to avoid rate limits
        const batchSize = 100;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (text) => {
                try {
                    return await generateEmbedding(text);
                } catch (err) {
                    console.error(`Error embedding text: ${text.substring(0, 50)}...`, err);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    } catch (error) {
        console.error('Error in batch embedding:', error);
        throw error;
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
    generateEmbedding,
    generateBatchEmbeddings,
    cosineSimilarity
};
