import { openai } from './llmClient';
import { Tenant, Conversation, Message } from '../types';

type HistoryMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

export const Agent = {
    async generateReply({ tenant, conversation, history }: {
        tenant: Tenant;
        conversation: Conversation;
        history: Message[];
    }): Promise<string | null> {
        // Build a simple conversation context
        const systemPrompt = `
You are an AI assistant for business "${tenant.name}" talking over WhatsApp.
Be concise and helpful. Do not hallucinate facts. If you don't know, ask clarifying questions.
`;

        const messages: HistoryMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({
                role: (m.direction === 'IN' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: m.content || ''
            }))
        ];

        // Ensure the last message was from the user to avoid AI replying to itself in a loop
        // (Though the worker logic should prevent this by only triggering on IN messages)
        const lastUserMessage = history[history.length - 1];
        if (lastUserMessage && lastUserMessage.direction !== 'IN') {
            // If the last message in history is OUT, it means we might be re-processing or something.
            // But usually 'history' includes the trigger message at the end.
        }

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-5-mini', // or gpt-3.5-turbo
                messages: messages as any,
            });

            const reply = completion.choices[0]?.message?.content?.trim();
            return reply || null;
        } catch (error) {
            console.error('Error generating AI reply:', error);
            return null;
        }
    }
};
