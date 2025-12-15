import OpenAI from "openai";
import { CONFIG } from "../config";
import type { MessageRecord } from "./messageService";

const openai = new OpenAI({
    apiKey: CONFIG.openAiApiKey,
});

export type LlmMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

export async function generateReply(
    siteId: string,
    conversationId: string,
    history: MessageRecord[],
    userMessage: string
): Promise<string> {
    // build prompt from history
    const llmMessages: LlmMessage[] = [
        {
            role: "system",
            content: "You are a helpful support chatbot for this website.",
        },
        ...history.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
        {
            role: "user",
            content: userMessage,
        },
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: llmMessages,
        });

        return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("OpenAI Error:", error);
        return "I'm currently experiencing issues connecting to my brain. Please try again later.";
    }
}
