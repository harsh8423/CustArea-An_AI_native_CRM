import { EmailThreadView } from "./EmailThreadView";
import { WhatsAppMessageView } from "./WhatsAppMessageView";
import { PhoneLogView } from "./PhoneLogView";

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    role: string;
    content_text: string;
    content_html?: string;
    created_at: string;
    status?: string;
    metadata?: any;
}

interface MessageRendererProps {
    conversation: any;
    messages: Message[];
}

export function MessageRenderer({ conversation, messages }: MessageRendererProps) {
    const channelType = conversation.channel;

    // Email channel - threaded view
    if (channelType === 'email') {
        return <EmailThreadView messages={messages} conversation={conversation} />;
    }

    // WhatsApp channel - bubble view
    if (channelType === 'whatsapp') {
        return <WhatsAppMessageView messages={messages} />;
    }

    // Phone channel - call log view
    if (channelType === 'phone') {
        return <PhoneLogView messages={messages} conversationId={conversation.id} />;
    }

    // Default fallback - simple message list
    return (
        <div className="space-y-4">
            {messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                return (
                    <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${isOutbound
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-800 border border-gray-200'
                            }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content_text}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
