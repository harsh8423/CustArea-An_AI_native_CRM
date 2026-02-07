'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Bot, Send, Loader2, MessageSquare, Mail, Phone, MessageCircle,
    User, AlertTriangle, Info, BookOpen, Trash2, Zap
} from 'lucide-react';

// Helper to format tool names nicely
function formatToolName(name: string): string {
    return name
        .replace(/([A-Z])/g, ' $1') // Add space before capitals
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .replace(/_/g, ' ') // Replace underscores
        .trim();
}

const API_BASE = 'http://localhost:8000/api/ai-agent';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
    detectedAttributes?: Record<string, string>;
    error?: boolean;
}

const CHANNELS = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'emerald', instruction: '' },
    { id: 'email', label: 'Email', icon: Mail, color: 'blue', instruction: 'Format your response as a professional email reply. Include a subject line if starting a new topic.' },
    { id: 'phone', label: 'Phone', icon: Phone, color: 'purple', instruction: 'This is a voice conversation. Keep your responses concise, conversational, and avoid markdown formatting. Do not use lists or complex structures that are hard to read aloud.' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'green', instruction: 'This is a WhatsApp message. Keep it casual, friendly, and concise. Emojis are encouraged.' },
];

export default function TestPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeChannel, setActiveChannel] = useState('chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function sendMessage() {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        const channelConfig = CHANNELS.find(c => c.id === activeChannel);

        try {
            const result = await fetchAPI('/chat', {
                method: 'POST',
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    channel: activeChannel,
                    instruction: channelConfig?.instruction
                })
            });

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.response,
                metadata: result.metadata,
                detectedAttributes: result.detectedAttributes
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Failed to get response. Make sure your API keys are configured.',
                error: true
            }]);
        } finally {
            setLoading(false);
        }
    }

    function clearChat() {
        setMessages([]);
    }

    const currentChannel = CHANNELS.find(c => c.id === activeChannel);

    return (
        <div className="h-full bg-[#eff0eb] p-4">
            <div className="h-full bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Bot className="w-6 h-6 text-emerald-500" />
                            Test Playground
                        </h1>
                        <p className="text-sm text-gray-500">Simulate interactions across different channels</p>
                    </div>
                    <button
                        onClick={clearChat}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Clear Chat"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Channel Tabs */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex p-1 bg-gray-100/80 rounded-xl">
                        {CHANNELS.map(channel => (
                            <button
                                key={channel.id}
                                onClick={() => setActiveChannel(channel.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeChannel === channel.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <channel.icon className={`w-4 h-4 ${activeChannel === channel.id ? `text-${channel.color}-500` : ''
                                    }`} />
                                {channel.label}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 px-1">
                        <p className="text-xs text-center text-gray-400">
                            {currentChannel?.instruction ? `Context: "${currentChannel.instruction}"` : 'Standard chat mode'}
                        </p>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <div className={`w-16 h-16 rounded-2xl bg-${currentChannel?.color}-100 flex items-center justify-center mb-4`}>
                                {currentChannel && <currentChannel.icon className={`w-8 h-8 text-${currentChannel.color}-500`} />}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Start Testing {currentChannel?.label}</h3>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
                                Send a message to see how your agent responds in this channel context.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-100 shadow-sm'} rounded-2xl px-5 py-4`}>
                                <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase tracking-wider font-semibold">
                                    {msg.role === 'user' ? (
                                        <>
                                            <span>You</span>
                                            <User className="w-3 h-3" />
                                        </>
                                    ) : (
                                        <>
                                            <Bot className="w-3 h-3" />
                                            <span>Agent</span>
                                        </>
                                    )}
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {msg.content}
                                </div>

                                {msg.role === 'assistant' && !msg.error && msg.metadata && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                        {msg.metadata.knowledgeUsed && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                                                <BookOpen className="w-3 h-3" />
                                                Knowledge Used
                                            </span>
                                        )}
                                        {msg.metadata.guardrailTriggered && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">
                                                <AlertTriangle className="w-3 h-3" />
                                                Guardrail: {msg.metadata.guardrail}
                                            </span>
                                        )}
                                        {msg.metadata.escalate && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-medium">
                                                <AlertTriangle className="w-3 h-3" />
                                                Escalated to {msg.metadata.targetTeam}
                                            </span>
                                        )}
                                        {msg.metadata.toolsUsed && msg.metadata.toolsUsed.map((tool: string, idx: number) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">
                                                <Zap className="w-3 h-3" />
                                                Action: {formatToolName(tool)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-4 flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                                <span className="text-sm text-gray-500">Agent is thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-gray-100">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder={`Message as ${currentChannel?.label}...`}
                            className="flex-1 px-4 py-3 bg-gray-50 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-gray-400"
                            disabled={loading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className={`px-5 py-3 rounded-xl text-white shadow-lg shadow-${currentChannel?.color}-500/20 transition-all ${loading || !input.trim()
                                ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none'
                                : `bg-gradient-to-r from-${currentChannel?.color}-500 to-${currentChannel?.color}-600 hover:scale-[1.02] active:scale-[0.98]`
                                }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
