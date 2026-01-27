import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    direction: "inbound" | "outbound";
    content_text: string;
    created_at: string;
    metadata?: any;
}

interface PhoneLogViewProps {
    messages: Message[];
}

export function PhoneLogView({ messages }: PhoneLogViewProps) {
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="space-y-3">
            {messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                const duration = metadata?.call_duration_seconds || 0;
                const status = metadata?.call_status || 'completed';
                const isMissed = status === 'busy' || status === 'failed' || status === 'no-answer';

                const getCallIcon = () => {
                    if (isMissed) return PhoneMissed;
                    return isOutbound ? PhoneOutgoing : PhoneIncoming;
                };

                const CallIcon = getCallIcon();

                return (
                    <div
                        key={msg.id}
                        className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "h-12 w-12 rounded-xl flex items-center justify-center shadow-sm",
                                isMissed
                                    ? "bg-gradient-to-br from-red-50 to-red-100 text-red-600"
                                    : isOutbound
                                        ? "bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600"
                                        : "bg-gradient-to-br from-green-50 to-emerald-100 text-green-600"
                            )}>
                                <CallIcon className="h-6 w-6" />
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-gray-900">
                                        {isOutbound ? 'Outgoing Call' : isMissed ? 'Missed Call' : 'Incoming Call'}
                                    </h4>
                                    <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-50 rounded-lg">
                                        {formatTime(msg.created_at)}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">
                                        {metadata?.from_number || metadata?.to_number || 'Unknown number'}
                                    </div>
                                    {duration > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Clock className="h-4 w-4 text-gray-400" />
                                            Duration: <span className="font-medium">{formatDuration(duration)}</span>
                                        </div>
                                    )}
                                    {!isMissed && metadata?.recording_url && (
                                        <div className="flex items-center gap-2 text-sm text-blue-600">
                                            <Mic className="h-4 w-4" />
                                            <span className="font-medium">Recording available</span>
                                        </div>
                                    )}
                                </div>

                                {msg.content_text && (
                                    <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-xl">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Call Notes</p>
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                            {msg.content_text}
                                        </p>
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
