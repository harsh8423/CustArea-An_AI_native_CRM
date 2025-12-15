'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Send, Bot, User, Settings, BookOpen, Shield, AlertTriangle,
    MessageSquare, Upload, Link, FileText, Plus, Trash2, Check, X,
    ChevronDown, ChevronRight, Loader2
} from 'lucide-react';

// API base
const API_BASE = 'http://localhost:8000/api/ai-agent';

// Fetch helper
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

// Tab components
const TABS = [
    { id: 'chat', label: 'Test Chat', icon: MessageSquare },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'guidance', label: 'Guidance', icon: Settings },
    { id: 'guardrails', label: 'Guardrails', icon: Shield },
    { id: 'escalation', label: 'Escalation', icon: AlertTriangle },
    { id: 'config', label: 'Config', icon: Settings },
];

export default function AIAgentPage() {
    const [activeTab, setActiveTab] = useState('chat');
    const [agent, setAgent] = useState<any>(null);
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [agentData, statusData] = await Promise.all([
                fetchAPI('/'),
                fetchAPI('/status')
            ]);
            setAgent(agentData);
            setStatus(statusData);
        } catch (err) {
            console.error('Failed to load agent:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                {agent?.name || 'AI Agent'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {agent?.isActive ? '🟢 Active' : '🔴 Inactive'} • {agent?.llmProvider || 'openai'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                        <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full">
                            {status?.stats?.knowledgeSources || 0} sources
                        </span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                            {status?.stats?.knowledgeChunks || 0} chunks
                        </span>
                        <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
                            {status?.stats?.guidances || 0} guidance
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
                <div className="flex border-b border-gray-100">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
                                ${activeTab === tab.id
                                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
                {activeTab === 'chat' && <ChatTab />}
                {activeTab === 'knowledge' && <KnowledgeTab onUpdate={loadData} />}
                {activeTab === 'guidance' && <GuidanceTab onUpdate={loadData} />}
                {activeTab === 'guardrails' && <GuardrailsTab onUpdate={loadData} />}
                {activeTab === 'escalation' && <EscalationTab onUpdate={loadData} />}
                {activeTab === 'config' && <ConfigTab agent={agent} onUpdate={loadData} />}
            </div>
        </div>
    );
}

// Chat Tab
function ChatTab() {
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                content: 'Error: Failed to get response',
                error: true
            }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 mt-20">
                        <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation to test your AI Agent</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                ? 'bg-purple-600 text-white'
                                : msg.error
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-gray-100 text-gray-800'
                            }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.metadata && (
                                <div className="mt-2 pt-2 border-t border-gray-200/50 text-xs opacity-75">
                                    Model: {msg.metadata.model} | KB: {msg.metadata.knowledgeUsed ? '✓' : '✗'}
                                </div>
                            )}
                            {msg.detectedAttributes && Object.keys(msg.detectedAttributes).length > 0 && (
                                <div className="mt-1 flex gap-1 flex-wrap">
                                    {Object.entries(msg.detectedAttributes).map(([k, v]) => (
                                        <span key={k} className="px-2 py-0.5 bg-white/20 rounded text-xs">
                                            {k}: {String(v)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl px-4 py-3">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Knowledge Tab
function KnowledgeTab({ onUpdate }: { onUpdate: () => void }) {
    const [sources, setSources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [addType, setAddType] = useState<'url' | 'text'>('url');
    const [formData, setFormData] = useState({ title: '', sourceUrl: '', content: '' });

    useEffect(() => {
        loadSources();
    }, []);

    async function loadSources() {
        try {
            const data = await fetchAPI('/knowledge');
            setSources(data);
        } catch (err) {
            console.error('Failed to load sources:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addSource() {
        try {
            await fetchAPI('/knowledge', {
                method: 'POST',
                body: JSON.stringify({
                    type: addType,
                    title: formData.title,
                    sourceUrl: addType === 'url' ? formData.sourceUrl : undefined,
                    content: addType === 'text' ? formData.content : undefined
                })
            });
            setShowAdd(false);
            setFormData({ title: '', sourceUrl: '', content: '' });
            loadSources();
            onUpdate();
        } catch (err) {
            console.error('Failed to add source:', err);
        }
    }

    async function deleteSource(id: string) {
        try {
            await fetchAPI(`/knowledge/${id}`, { method: 'DELETE' });
            loadSources();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Knowledge Base</h2>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                    <Plus className="w-4 h-4" />
                    Add Source
                </button>
            </div>

            {showAdd && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setAddType('url')}
                            className={`px-3 py-1 rounded ${addType === 'url' ? 'bg-purple-600 text-white' : 'bg-white'}`}
                        >
                            URL
                        </button>
                        <button
                            onClick={() => setAddType('text')}
                            className={`px-3 py-1 rounded ${addType === 'text' ? 'bg-purple-600 text-white' : 'bg-white'}`}
                        >
                            Text
                        </button>
                    </div>
                    <input
                        placeholder="Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 mb-2 border rounded-lg"
                    />
                    {addType === 'url' ? (
                        <input
                            placeholder="https://..."
                            value={formData.sourceUrl}
                            onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                            className="w-full px-3 py-2 mb-2 border rounded-lg"
                        />
                    ) : (
                        <textarea
                            placeholder="Content..."
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-3 py-2 mb-2 border rounded-lg h-32"
                        />
                    )}
                    <button onClick={addSource} className="px-4 py-2 bg-purple-600 text-white rounded-lg">
                        Add
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2">
                {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" />
                ) : sources.length === 0 ? (
                    <p className="text-center text-gray-400 mt-10">No knowledge sources yet</p>
                ) : (
                    sources.map(source => (
                        <div key={source._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {source.type === 'pdf' ? <FileText className="w-5 h-5 text-red-500" /> :
                                    source.type === 'url' ? <Link className="w-5 h-5 text-blue-500" /> :
                                        <FileText className="w-5 h-5 text-gray-500" />}
                                <div>
                                    <p className="font-medium">{source.title}</p>
                                    <p className="text-xs text-gray-500">
                                        {source.status} • {source.totalChunks || 0} chunks
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => deleteSource(source._id)} className="p-2 hover:bg-red-50 rounded">
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Guidance Tab
function GuidanceTab({ onUpdate }: { onUpdate: () => void }) {
    const [guidances, setGuidances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAPI('/guidance').then(setGuidances).finally(() => setLoading(false));
    }, []);

    return (
        <div className="h-full p-4">
            <h2 className="text-lg font-semibold mb-4">Guidance Rules</h2>
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /> :
                guidances.length === 0 ? <p className="text-center text-gray-400 mt-10">No guidance rules yet</p> :
                    <div className="space-y-2">
                        {guidances.map(g => (
                            <div key={g._id} className="p-3 bg-gray-50 rounded-lg">
                                <p className="font-medium">{g.title}</p>
                                <p className="text-sm text-gray-500">{g.category} • {g.content.substring(0, 100)}...</p>
                            </div>
                        ))}
                    </div>
            }
        </div>
    );
}

// Guardrails Tab
function GuardrailsTab({ onUpdate }: { onUpdate: () => void }) {
    const [guardrails, setGuardrails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAPI('/guardrails').then(setGuardrails).finally(() => setLoading(false));
    }, []);

    return (
        <div className="h-full p-4">
            <h2 className="text-lg font-semibold mb-4">Guardrails</h2>
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /> :
                guardrails.length === 0 ? <p className="text-center text-gray-400 mt-10">No guardrails yet</p> :
                    <div className="space-y-2">
                        {guardrails.map(g => (
                            <div key={g._id} className="p-3 bg-gray-50 rounded-lg">
                                <p className="font-medium">{g.name}</p>
                                <p className="text-sm text-gray-500">{g.type} • {g.action}</p>
                            </div>
                        ))}
                    </div>
            }
        </div>
    );
}

// Escalation Tab
function EscalationTab({ onUpdate }: { onUpdate: () => void }) {
    const [rules, setRules] = useState<any[]>([]);
    const [guidances, setGuidances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetchAPI('/escalation/rules'),
            fetchAPI('/escalation/guidance')
        ]).then(([r, g]) => {
            setRules(r);
            setGuidances(g);
        }).finally(() => setLoading(false));
    }, []);

    return (
        <div className="h-full p-4">
            <h2 className="text-lg font-semibold mb-4">Escalation</h2>
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /> : (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-medium mb-2">Rules ({rules.length})</h3>
                        {rules.map(r => (
                            <div key={r._id} className="p-2 bg-gray-50 rounded mb-1">
                                {r.name} - {r.action}
                            </div>
                        ))}
                    </div>
                    <div>
                        <h3 className="font-medium mb-2">Guidance ({guidances.length})</h3>
                        {guidances.map(g => (
                            <div key={g._id} className="p-2 bg-gray-50 rounded mb-1">
                                {g.title}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Config Tab
function ConfigTab({ agent, onUpdate }: { agent: any; onUpdate: () => void }) {
    const [formData, setFormData] = useState({
        name: agent?.name || '',
        llmProvider: agent?.llmProvider || 'openai',
        temperature: agent?.temperature || 0.7,
        isActive: agent?.isActive || false
    });
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            await fetchAPI('/', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            onUpdate();
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="h-full p-4">
            <h2 className="text-lg font-semibold mb-4">Agent Configuration</h2>
            <div className="max-w-md space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Agent Name</label>
                    <input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">LLM Provider</label>
                    <select
                        value={formData.llmProvider}
                        onChange={(e) => setFormData({ ...formData, llmProvider: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature}</label>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <label className="text-sm">Agent Active</label>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
