const pdfParse = require('pdf-parse');
const axios = require('axios');
const { generateEmbedding } = require('./embeddingService');
const KnowledgeSource = require('../models/KnowledgeSource');
const KnowledgeChunk = require('../models/KnowledgeChunk');

/**
 * Configuration for text chunking
 */
const DEFAULT_CHUNK_CONFIG = {
    chunkSize: 500,        // Target characters per chunk
    chunkOverlap: 50,      // Overlap between chunks
    minChunkSize: 100,     // Minimum chunk size
    separator: '\n\n'      // Primary separator
};

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(buffer) {
    try {
        const data = await pdfParse(buffer);
        return {
            text: data.text,
            numPages: data.numpages,
            info: data.info
        }
        ;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF document');
    }
}

/**
 * Fetch and extract text from URL
 */
async function fetchUrlContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)'
            }
        });

        // Simple HTML to text conversion
        let text = response.data;
        
        if (typeof text === 'string') {
            // Remove script and style tags
            text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            // Remove HTML tags
            text = text.replace(/<[^>]+>/g, ' ');
            // Decode HTML entities
            text = text.replace(/&nbsp;/g, ' ')
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"');
            // Clean up whitespace
            text = text.replace(/\s+/g, ' ').trim();
        }

        return {
            text,
            url,
            contentType: response.headers['content-type']
        };
    } catch (error) {
        console.error('Error fetching URL:', error);
        throw new Error(`Failed to fetch content from URL: ${error.message}`);
    }
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text, config = {}) {
    const {
        chunkSize = DEFAULT_CHUNK_CONFIG.chunkSize,
        chunkOverlap = DEFAULT_CHUNK_CONFIG.chunkOverlap,
        minChunkSize = DEFAULT_CHUNK_CONFIG.minChunkSize,
        separator = DEFAULT_CHUNK_CONFIG.separator
    } = config;

    if (!text || text.length < minChunkSize) {
        return text ? [text] : [];
    }

    const chunks = [];
    
    // First, split by paragraphs
    const paragraphs = text.split(separator);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara) continue;

        // If adding this paragraph exceeds chunk size
        if (currentChunk.length + trimmedPara.length > chunkSize) {
            if (currentChunk.length >= minChunkSize) {
                chunks.push(currentChunk.trim());
                
                // Keep overlap from end of current chunk
                const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
                currentChunk = currentChunk.slice(overlapStart) + '\n\n' + trimmedPara;
            } else {
                currentChunk += '\n\n' + trimmedPara;
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
        }
    }

    // Add remaining text
    if (currentChunk.trim().length >= minChunkSize) {
        chunks.push(currentChunk.trim());
    } else if (chunks.length > 0 && currentChunk.trim()) {
        // Append to last chunk if too small
        chunks[chunks.length - 1] += '\n\n' + currentChunk.trim();
    } else if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Process a knowledge source: extract text, chunk, embed, and store
 */
async function processKnowledgeSource(sourceId, contentBuffer = null) {
    const source = await KnowledgeSource.findById(sourceId);
    if (!source) {
        throw new Error('Knowledge source not found');
    }

    try {
        // Update status to processing
        source.status = 'processing';
        await source.save();

        let text = '';

        // Extract text based on type
        switch (source.type) {
            case 'pdf':
                if (!contentBuffer) {
                    throw new Error('PDF buffer required for processing');
                }
                const pdfData = await extractPdfText(contentBuffer);
                text = pdfData.text;
                source.metadata = { ...source.metadata, numPages: pdfData.numPages };
                break;

            case 'url':
                if (!source.sourceUrl) {
                    throw new Error('URL required for URL source');
                }
                const urlData = await fetchUrlContent(source.sourceUrl);
                text = urlData.text;
                break;

            case 'article':
            case 'text':
                // Text content should be in metadata or passed directly
                text = source.metadata?.content || '';
                break;

            default:
                throw new Error(`Unknown source type: ${source.type}`);
        }

        if (!text || text.trim().length === 0) {
            throw new Error('No text content extracted');
        }

        // Chunk the text
        const chunks = chunkText(text);
        console.log(`Created ${chunks.length} chunks from source ${sourceId}`);

        // Delete existing chunks for this source
        await KnowledgeChunk.deleteMany({ sourceId: source._id });

        // Generate embeddings and store chunks
        let successCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await generateEmbedding(chunks[i]);
                
                await KnowledgeChunk.create({
                    tenantId: source.tenantId,
                    sourceId: source._id,
                    chunkIndex: i,
                    content: chunks[i],
                    contentLength: chunks[i].length,
                    embedding: embedding
                });
                
                successCount++;
                
                // Rate limiting - pause between embeddings
                if (i % 10 === 9) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (err) {
                console.error(`Failed to process chunk ${i}:`, err);
            }
        }

        // Update source with stats
        source.status = 'processed';
        source.totalChunks = successCount;
        source.totalCharacters = text.length;
        source.processedAt = new Date();
        source.errorMessage = null;
        await source.save();

        console.log(`✓ Processed source ${sourceId}: ${successCount}/${chunks.length} chunks`);
        return { success: true, chunks: successCount };

    } catch (error) {
        console.error(`Failed to process source ${sourceId}:`, error);
        
        source.status = 'failed';
        source.errorMessage = error.message;
        await source.save();

        throw error;
    }
}

module.exports = {
    extractPdfText,
    fetchUrlContent,
    chunkText,
    processKnowledgeSource,
    DEFAULT_CHUNK_CONFIG
};
