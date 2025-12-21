/**
 * AI Nodes - Intelligent processing using OpenAI
 */

const OpenAI = require('openai');

const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

// Intent Detection Node
const intent_detection = {
    async execute({ config, context, log }) {
        const { text, intents: rawIntents } = config;
        
        if (!text) {
            throw new Error('Intent detection requires text input');
        }

        // Handle both string (comma-separated) and array inputs
        let intents = rawIntents;
        if (typeof rawIntents === 'string') {
            intents = rawIntents.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(intents)) {
            intents = [];
        }

        if (intents.length === 0) {
            throw new Error('Intent detection requires a list of intents');
        }

        const prompt = `Analyze the following text and classify it into one of these intents: ${intents.join(', ')}.
        
Text: "${text}"

Respond with ONLY a JSON object in this exact format:
{"intent": "<one of the intents>", "confidence": <0.0 to 1.0>}`;

        await log('debug', 'Calling OpenAI for intent detection', { text: text.substring(0, 100) });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a text classifier. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 100
        });

        const content = response.choices[0].message.content.trim();
        
        try {
            const result = JSON.parse(content);
            await log('info', `Detected intent: ${result.intent}`, result);
            return {
                intent: result.intent,
                confidence: result.confidence || 0.5
            };
        } catch (e) {
            // Fallback: extract intent from text
            for (const intent of intents) {
                if (content.toLowerCase().includes(intent.toLowerCase())) {
                    return { intent, confidence: 0.5 };
                }
            }
            return { intent: intents[0], confidence: 0.1 };
        }
    }
};

// Sentiment Detection Node
const sentiment_detection = {
    async execute({ config, context, log }) {
        const { text } = config;
        
        if (!text) {
            throw new Error('Sentiment detection requires text input');
        }

        const prompt = `Analyze the sentiment of this text and respond with ONLY a JSON object:
        
Text: "${text}"

Format: {"sentiment": "positive|neutral|negative|frustrated", "score": <0.0 to 1.0>}`;

        await log('debug', 'Calling OpenAI for sentiment detection');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a sentiment analyzer. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 100
        });

        const content = response.choices[0].message.content.trim();
        
        try {
            const result = JSON.parse(content);
            await log('info', `Detected sentiment: ${result.sentiment}`, result);
            return {
                sentiment: result.sentiment,
                score: result.score || 0.5
            };
        } catch (e) {
            return { sentiment: 'neutral', score: 0.5 };
        }
    }
};

// Entity Extraction Node
const extract_entity = {
    async execute({ config, context, log }) {
        const { text, entities } = config;
        
        if (!text) {
            throw new Error('Entity extraction requires text input');
        }

        const entityList = (entities || []).map(e => `${e.name} (${e.type})`).join(', ');
        
        const prompt = `Extract these entities from the text: ${entityList}
        
Text: "${text}"

Respond with ONLY a JSON object where keys are entity names and values are the extracted values (or null if not found).`;

        await log('debug', 'Calling OpenAI for entity extraction');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an entity extractor. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 500
        });

        const content = response.choices[0].message.content.trim();
        
        try {
            const result = JSON.parse(content);
            await log('info', 'Extracted entities', result);
            return { entities: result };
        } catch (e) {
            return { entities: {} };
        }
    }
};

// LLM Agent Node - General purpose AI response
const llm_agent = {
    async execute({ config, context, log }) {
        const { prompt, message, max_tokens } = config;
        
        if (!message) {
            throw new Error('LLM Agent requires a message');
        }

        const tokens = Math.min(max_tokens || 500, 2000);

        await log('debug', 'Calling OpenAI LLM Agent');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: prompt || 'You are a helpful assistant.' },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: tokens
        });

        const aiResponse = response.choices[0].message.content;
        const tokensUsed = response.usage?.total_tokens || 0;

        await log('info', `LLM generated response (${tokensUsed} tokens)`, { 
            preview: aiResponse.substring(0, 100) 
        });

        return {
            response: aiResponse,
            tokens_used: tokensUsed
        };
    }
};

module.exports = {
    intent_detection,
    sentiment_detection,
    extract_entity,
    llm_agent
};
