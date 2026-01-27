// Polyfill DOMMatrix for pdfjs-dist in Node.js
if (typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
        setMatrixValue(str) {}
        translate(x, y) { return this; }
        scale(x, y, z) { return this; }
        rotate(x, y, z) { return this; }
        multiply(m) { return this; }
        transformPoint(p) { return p; }
        inverse() { return this; }
    };
}

// Try to load pdfjs-dist
let pdfjsLib;
try {
    // Try legacy build first (better for Node.js)
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e) {
    try {
        // Fallback to main package
        pdfjsLib = require('pdfjs-dist');
    } catch (e2) {
        console.error('Failed to load pdfjs-dist:', e2);
        // Don't throw here, just log. We will check pdfjsLib in extractPdfText
    }
}

const axios = require('axios');
const { generateEmbedding } = require('./embeddingService');
const KnowledgeSource = require('../models/KnowledgeSource');
const KnowledgeChunk = require('../models/KnowledgeChunk');

/**
 * Configuration for text chunking
 */
const DEFAULT_CHUNK_CONFIG = {
    chunkSize: 500,        // Target WORDS per chunk
    chunkOverlap: 50,      // Overlap in WORDS between chunks
    minChunkSize: 50,      // Minimum chunk size in WORDS
    separator: '\n\n'      // Primary separator
};

/**
 * Extract text from PDF buffer using pdfjs-dist
 */
async function extractPdfText(buffer) {
    try {
        // Convert buffer to Uint8Array if needed
        const data = new Uint8Array(buffer);
        
        // Load document
        const loadingTask = pdfjsLib.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0
        });
        
        const doc = await loadingTask.promise;
        const numPages = doc.numPages;
        let fullText = [];
        
        // Process pages sequentially to maintain order
        for (let i = 1; i <= numPages; i++) {
            try {
                const page = await doc.getPage(i);
                const content = await page.getTextContent();
                
                // Extract text items and join with space
                const pageText = content.items
                    .map(item => item.str)
                    .join(' ');
                
                if (pageText.trim()) {
                    fullText.push(pageText);
                }
                
                // Release page resources
                page.cleanup();
            } catch (pageError) {
                console.warn(`Error processing page ${i}:`, pageError);
                // Continue to next page
            }
        }
        
        // Join pages with double newline
        return {
            text: fullText.join('\n\n'),
            numPages: numPages,
            info: {}
        };

    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF document: ' + error.message);
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
 * Split text into overlapping chunks based on WORD count
 */
function chunkText(text, config = {}) {
    const {
        chunkSize = DEFAULT_CHUNK_CONFIG.chunkSize,          // words
        chunkOverlap = DEFAULT_CHUNK_CONFIG.chunkOverlap,    // words
        minChunkSize = DEFAULT_CHUNK_CONFIG.minChunkSize,    // words
        separator = DEFAULT_CHUNK_CONFIG.separator
    } = config;

    if (!text || text.trim().length === 0) {
        return [];
    }

    // Split text into words
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    
    if (words.length <= minChunkSize) {
        return [text.trim()];
    }

    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < words.length) {
        // Take chunkSize words
        const chunkWords = words.slice(currentIndex, currentIndex + chunkSize);
        chunks.push(chunkWords.join(' '));
        
        // Move forward by (chunkSize - chunkOverlap) to create overlap
        currentIndex += (chunkSize - chunkOverlap);
        
        // If remaining words are less than minChunkSize, break to avoid tiny chunks
        if (words.length - currentIndex < minChunkSize && words.length - currentIndex > 0) {
            // Append remaining words to last chunk
            const remainingWords = words.slice(currentIndex);
            chunks[chunks.length - 1] += ' ' + remainingWords.join(' ');
            break;
        }
    }

    return chunks.map(c => c.trim()).filter(c => c.length > 0);
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
