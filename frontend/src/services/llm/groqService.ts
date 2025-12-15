import { ILLMService } from '../types';

export class GroqService implements ILLMService {
    async *generateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        try {
            const response = await fetch('/api/groq/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'You are a helpful AI assistant. Keep your responses concise and conversational.' },
                        { role: 'user', content: prompt }
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(`Groq API error: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const content = data.choices[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            console.warn('Failed to parse Groq chunk:', trimmed);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('GroqService error:', error);
            throw error;
        }
    }
}
