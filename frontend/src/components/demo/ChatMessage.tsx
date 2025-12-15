import { cn } from "@/lib/utils";

interface ChatMessageProps {
    role: 'user' | 'ai';
    content: string;
    isInterim?: boolean;
}

export function ChatMessage({ role, content, isInterim = false }: ChatMessageProps) {
    return (
        <div
            className={cn(
                "flex w-full mb-4",
                role === 'user' ? "justify-end" : "justify-start"
            )}
        >
            <div
                className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    role === 'user'
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none",
                    isInterim && "opacity-70 italic"
                )}
            >
                {content}
            </div>
        </div>
    );
}
