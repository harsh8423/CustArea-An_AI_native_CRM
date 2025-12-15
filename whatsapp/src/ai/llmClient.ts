import OpenAI from 'openai';
import { config } from '../config/env';

if (!config.openaiApiKey) {
    console.warn('OPENAI_API_KEY is not set. AI features will fail.');
}

export const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});
