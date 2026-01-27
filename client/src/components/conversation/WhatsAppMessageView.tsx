import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    content_text: string;
    created_at: string;
    status?: string;
}

interface WhatsAppMessageViewProps {
    messages: Message[];
}

export function WhatsAppMessageView({ messages }: WhatsAppMessageViewProps) {
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-3">
            {messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";

                return (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex",
                            isOutbound ? "justify-end" : "justify-start"
                        )}
                    >
                        <div className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                            isOutbound
                                ? "bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-sm"
                                : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"
                        )}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                                {msg.content_text}
                            </p>
                            <div className={cn(
                                "flex items-center gap-1.5 mt-1.5 justify-end",
                            )}>
                                <span className={cn(
                                    "text-[10px] font-medium",
                                    isOutbound ? "text-green-100" : "text-gray-400"
                                )}>
                                    {formatTime(msg.created_at)}
                                </span>
                                {isOutbound && msg.status === "delivered" && (
                                    <Check className="h-3 w-3 text-green-100" />
                                )}
                                {isOutbound && msg.status === "read" && (
                                    <div className="flex -space-x-1">
                                        <Check className="h-3 w-3 text-green-100" />
                                        <Check className="h-3 w-3 text-green-100" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
