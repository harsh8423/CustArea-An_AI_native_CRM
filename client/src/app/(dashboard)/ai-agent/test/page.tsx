'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Bot, Send, Loader2, RefreshCw, BookOpen, AlertTriangle,
    CheckCircle, XCircle, Info, Play, Square, Trash2, Phone, PhoneOff, PhoneCall
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/ai-agent';
const PHONE_API = 'http://localhost:8000/api/phone';

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

async function phoneAPI(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${PHONE_API}${endpoint}`, {
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

export default function TestPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [agent, setAgent] = useState<any>(null);
    const [status, setStatus] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Phone dialer state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [callMethod, setCallMethod] = useState<'realtime' | 'legacy' | 'convrelay'>('realtime');
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'active' | 'ended'>('idle');
    const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const callTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadAgent();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Call duration timer
    useEffect(() => {
        if (callStatus === 'active') {
            callTimerRef.current = setInterval(() => {
                setCallDuration(d => d + 1);
            }, 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
            if (callStatus === 'idle') {
                setCallDuration(0);
            }
        }
        return () => {
            if (callTimerRef.current) clearInterval(callTimerRef.current);
        };
    }, [callStatus]);

    async function loadAgent() {
        try {
            const [agentData, statusData] = await Promise.all([
                fetchAPI('/'),
                fetchAPI('/status')
            ]);
            setAgent(agentData);
            setStatus(statusData);
        } catch (err) {
            console.error('Failed to load:', err);
        }
    }

    async function sendMessage() {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const result = await fetchAPI('/chat', {
                method: 'POST',
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
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

    // Phone functions
    async function initiateCall() {
        if (!phoneNumber.trim()) {
            alert('Please enter a phone number');
            return;
        }

        setCallStatus('calling');
        try {
            const result = await phoneAPI('/call', {
                method: 'POST',
                body: JSON.stringify({
                    to: phoneNumber,
                    method: callMethod
                })
            });
            setCurrentCallSid(result.callSid);
            setCallStatus('active');
        } catch (err) {
            console.error('Call failed:', err);
            setCallStatus('idle');
            alert('Failed to initiate call');
        }
    }

    async function endCall() {
        if (!currentCallSid) return;

        try {
            await phoneAPI(`/calls/${currentCallSid}/end`, { method: 'POST' });
        } catch (err) {
            console.error('Failed to end call:', err);
        }
        setCallStatus('ended');
        setTimeout(() => {
            setCallStatus('idle');
            setCurrentCallSid(null);
        }, 2000);
    }

    function formatDuration(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">Test Playground</h1>
                            <p className="text-xs text-gray-500">Test your AI agent's responses in real-time</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${agent?.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${agent?.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {agent?.isActive ? 'Agent Active' : 'Agent Inactive'}
                        </div>
                        <button
                            onClick={clearChat}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex gap-4">
                {/* Messages */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-20">
                                <Bot className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Testing</h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto">
                                    Send a message to test how your AI agent responds. You'll see detected attributes,
                                    knowledge sources used, and other metadata.
                                </p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                                    <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                                        : msg.error
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    {msg.role === 'assistant' && !msg.error && msg.metadata && (
                                        <div className="mt-2 flex flex-wrap gap-2 px-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                <Info className="w-3 h-3" />
                                                {msg.metadata.provider}/{msg.metadata.model}
                                            </span>
                                            {msg.metadata.knowledgeUsed && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                                    <BookOpen className="w-3 h-3" />
                                                    Knowledge Used
                                                </span>
                                            )}
                                            {msg.metadata.escalate && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Escalation Triggered
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {msg.detectedAttributes && Object.keys(msg.detectedAttributes).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1 px-1">
                                            {Object.entries(msg.detectedAttributes).map(([k, v]) => (
                                                <span key={k} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                                    {k}: {v}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                    <span className="text-sm text-gray-500">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="Type a test message..."
                                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                                disabled={loading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={loading || !input.trim()}
                                className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar - Status */}
                <div className="w-80 bg-white rounded-2xl shadow-sm p-4 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Agent Status</h3>

                    <div className="space-y-4">
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Agent Name</p>
                            <p className="font-medium text-gray-900">{agent?.name || 'AI Assistant'}</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">LLM Provider</p>
                            <p className="font-medium text-gray-900">{agent?.llmProvider || 'openai'} / {agent?.llmModel || 'gpt-4o-mini'}</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Temperature</p>
                            <p className="font-medium text-gray-900">{agent?.temperature || 0.7}</p>
                        </div>

                        <hr className="border-gray-100" />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-indigo-50 rounded-xl text-center">
                                <p className="text-2xl font-bold text-indigo-600">{status?.stats?.knowledgeSources || 0}</p>
                                <p className="text-xs text-indigo-600">Sources</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-xl text-center">
                                <p className="text-2xl font-bold text-purple-600">{status?.stats?.knowledgeChunks || 0}</p>
                                <p className="text-xs text-purple-600">Chunks</p>
                            </div>
                            <div className="p-3 bg-amber-50 rounded-xl text-center">
                                <p className="text-2xl font-bold text-amber-600">{status?.stats?.guidances || 0}</p>
                                <p className="text-xs text-amber-600">Guidance</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-xl text-center">
                                <p className="text-2xl font-bold text-red-600">{status?.stats?.guardrails || 0}</p>
                                <p className="text-xs text-red-600">Guardrails</p>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        <div>
                            <p className="text-xs text-gray-500 mb-2">Vector Index</p>
                            <div className={`flex items-center gap-2 text-sm ${status?.vectorIndex === 'ready' ? 'text-green-600' : 'text-yellow-600'
                                }`}>
                                {status?.vectorIndex === 'ready' ? (
                                    <CheckCircle className="w-4 h-4" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                )}
                                {status?.vectorIndex === 'ready' ? 'Ready' : 'Not configured'}
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Phone Dialer Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-sm font-semibold text-gray-900">Test Outbound Call</h4>
                            </div>

                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+1234567890"
                                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                disabled={callStatus !== 'idle'}
                            />

                            <select
                                value={callMethod}
                                onChange={(e) => setCallMethod(e.target.value as any)}
                                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={callStatus !== 'idle'}
                            >
                                <option value="realtime">OpenAI Realtime (Fastest)</option>
                                <option value="legacy">Legacy (Azure STT/TTS)</option>
                                <option value="convrelay">Conversational Relay</option>
                            </select>

                            {callStatus === 'active' && (
                                <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg">
                                    <PhoneCall className="w-4 h-4 text-green-600 animate-pulse" />
                                    <span className="text-sm font-medium text-green-700">
                                        {formatDuration(callDuration)}
                                    </span>
                                </div>
                            )}

                            {callStatus === 'idle' ? (
                                <button
                                    onClick={initiateCall}
                                    className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Phone className="w-4 h-4" />
                                    Call Now
                                </button>
                            ) : callStatus === 'calling' ? (
                                <button
                                    disabled
                                    className="w-full py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Connecting...
                                </button>
                            ) : callStatus === 'active' ? (
                                <button
                                    onClick={endCall}
                                    className="w-full py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-rose-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <PhoneOff className="w-4 h-4" />
                                    End Call
                                </button>
                            ) : (
                                <div className="text-center py-2 text-sm text-gray-500">
                                    Call ended
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
