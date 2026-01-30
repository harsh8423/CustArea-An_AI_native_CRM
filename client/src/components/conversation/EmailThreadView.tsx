import { Mail, User, Clock } from "lucide-react";

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    content_text: string;
    content_html?: string;
    created_at: string;
    metadata?: any;
}

interface EmailThreadViewProps {
    messages: Message[];
    conversation: any;
}

export function EmailThreadView({ messages, conversation }: EmailThreadViewProps) {
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            {messages.map((msg, index) => {
                const isOutbound = msg.direction === "outbound";
                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

                return (
                    <div
                        key={msg.id}
                        className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                    >
                        {/* Email Header */}
                        <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm ${isOutbound
                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                        : 'bg-gradient-to-br from-purple-500 to-purple-600'
                                        }`}>
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-semibold text-gray-900">
                                                {isOutbound ? metadata?.from || 'Me' : (conversation.contact_name || metadata?.from || 'Customer')}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">
                                                {formatTime(msg.created_at)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            To: <span className="text-gray-700 font-medium">
                                                {isOutbound
                                                    ? (metadata?.to?.[0]?.email || metadata?.to || conversation.contact_email || 'Customer')
                                                    : (metadata?.to?.[0]?.email || metadata?.to_addresses?.[0]?.email || metadata?.to || 'Me')}
                                            </span>
                                        </div>
                                        {(metadata?.subject || (index === 0 && conversation.subject)) && (
                                            <div className="text-sm font-semibold text-gray-800 mt-2 flex items-center gap-1.5">
                                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                                                {metadata?.subject || conversation.subject}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Email Body */}
                        <div className="p-5">
                            {msg.content_html ? (
                                <div
                                    className="text-sm text-gray-800 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: msg.content_html }}
                                />
                            ) : (
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {msg.content_text}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
