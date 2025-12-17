'use client';

import { useState, useEffect } from 'react';
import {
    Bot, BookOpen, Link, FileText, Settings, Plus, Trash2,
    Upload, Loader2, Check, X, ExternalLink, RefreshCw,
    Save, Sparkles
} from 'lucide-react';

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

const TABS = [
    { id: 'base', label: 'Base Knowledge', icon: Sparkles },
    { id: 'articles', label: 'Articles / Blogs', icon: Link },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'config', label: 'Config', icon: Settings },
];

export default function KnowledgeBasePage() {
    const [activeTab, setActiveTab] = useState('base');
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
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {agent?.name || 'AI Assistant'}
                            </h1>
                            <p className="text-xs text-gray-500 flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${agent?.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                {agent?.isActive ? 'Active' : 'Inactive'} • {agent?.llmProvider || 'openai'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                            {status?.stats?.knowledgeSources || 0} sources
                        </span>
                        <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full font-medium">
                            {status?.stats?.knowledgeChunks || 0} chunks
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
                <div className="flex">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all
                                ${activeTab === tab.id
                                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
                {activeTab === 'base' && <BaseKnowledgeTab agent={agent} onUpdate={loadData} />}
                {activeTab === 'articles' && <ArticlesTab onUpdate={loadData} />}
                {activeTab === 'documents' && <DocumentsTab onUpdate={loadData} />}
                {activeTab === 'config' && <ConfigTab agent={agent} onUpdate={loadData} />}
            </div>
        </div>
    );
}

// Base Knowledge Tab - System Prompt Editor
function BaseKnowledgeTab({ agent, onUpdate }: { agent: any; onUpdate: () => void }) {
    const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
    const [name, setName] = useState(agent?.name || 'AI Assistant');
    const [welcomeMessage, setWelcomeMessage] = useState(agent?.welcomeMessage || '');
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            await fetchAPI('/', {
                method: 'PUT',
                body: JSON.stringify({ name, systemPrompt, welcomeMessage })
            });
            onUpdate();
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="h-full flex flex-col p-6">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Base Knowledge</h2>
                <p className="text-sm text-gray-500">Configure your AI agent's core personality and instructions</p>
            </div>

            <div className="space-y-5 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., Support Assistant"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Welcome Message</label>
                    <input
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Hello! How can I help you today?"
                    />
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt (Instructions)</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-64 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder="You are a helpful AI assistant. Your role is to..."
                    />
                    <p className="mt-2 text-xs text-gray-400">
                        This is the core instruction that defines your AI's behavior, tone, and capabilities.
                    </p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>
        </div>
    );
}

// Articles Tab - Add URLs
function ArticlesTab({ onUpdate }: { onUpdate: () => void }) {
    const [sources, setSources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({ title: '', sourceUrl: '' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadSources();
    }, []);

    async function loadSources() {
        try {
            const data = await fetchAPI('/knowledge?type=url');
            setSources(data.filter((s: any) => s.type === 'url' || s.type === 'article'));
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addSource() {
        if (!formData.title || !formData.sourceUrl) return;
        setAdding(true);
        try {
            await fetchAPI('/knowledge', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'url',
                    title: formData.title,
                    sourceUrl: formData.sourceUrl
                })
            });
            setShowAdd(false);
            setFormData({ title: '', sourceUrl: '' });
            loadSources();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        } finally {
            setAdding(false);
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

    async function reprocessSource(id: string) {
        // This would trigger reprocessing - for now just refresh
        loadSources();
    }

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Articles & Blog Links</h2>
                    <p className="text-sm text-gray-500">Add URLs to articles, blog posts, or documentation</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add URL
                </button>
            </div>

            {showAdd && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                            <input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Article title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL</label>
                            <input
                                value={formData.sourceUrl}
                                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addSource}
                            disabled={adding}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {adding ? 'Adding...' : 'Add Article'}
                        </button>
                        <button
                            onClick={() => setShowAdd(false)}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : sources.length === 0 ? (
                    <div className="text-center py-12">
                        <Link className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No articles added yet</p>
                        <p className="text-gray-400 text-sm">Add URLs to help your AI learn from external content</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => (
                            <div key={source._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                        <Link className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{source.title}</p>
                                        <p className="text-xs text-gray-500 truncate">{source.sourceUrl}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${source.status === 'processed' ? 'bg-green-100 text-green-700' :
                                            source.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                source.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {source.status}
                                    </span>
                                    <span className="text-xs text-gray-400">{source.totalChunks || 0} chunks</span>
                                    <button
                                        onClick={() => window.open(source.sourceUrl, '_blank')}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={() => deleteSource(source._id)}
                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Documents Tab - Upload PDFs
function DocumentsTab({ onUpdate }: { onUpdate: () => void }) {
    const [sources, setSources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadSources();
    }, []);

    async function loadSources() {
        try {
            const data = await fetchAPI('/knowledge');
            setSources(data.filter((s: any) => s.type === 'pdf' || s.type === 'text'));
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/knowledge/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            loadSources();
            onUpdate();
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
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
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Documents</h2>
                    <p className="text-sm text-gray-500">Upload PDF documents for your AI to learn from</p>
                </div>
                <label className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload PDF
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                    />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : sources.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No documents uploaded yet</p>
                        <p className="text-gray-400 text-sm">Upload PDFs to train your AI agent</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => (
                            <div key={source._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{source.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {source.fileSize ? `${(source.fileSize / 1024).toFixed(1)} KB` : 'Text content'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${source.status === 'processed' ? 'bg-green-100 text-green-700' :
                                            source.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                source.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {source.status}
                                    </span>
                                    <span className="text-xs text-gray-400">{source.totalChunks || 0} chunks</span>
                                    <button
                                        onClick={() => deleteSource(source._id)}
                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Config Tab
function ConfigTab({ agent, onUpdate }: { agent: any; onUpdate: () => void }) {
    const [formData, setFormData] = useState({
        llmProvider: agent?.llmProvider || 'openai',
        llmModel: agent?.llmModel || 'gpt-4o-mini',
        temperature: agent?.temperature || 0.7,
        maxTokens: agent?.maxTokens || 1024,
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
        <div className="h-full flex flex-col p-6">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Agent Configuration</h2>
                <p className="text-sm text-gray-500">Configure LLM settings and behavior</p>
            </div>

            <div className="space-y-5 flex-1 overflow-y-auto max-w-xl">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                        <p className="font-medium text-gray-900">Agent Status</p>
                        <p className="text-sm text-gray-500">Enable or disable AI responses</p>
                    </div>
                    <button
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.isActive ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">LLM Provider</label>
                    <select
                        value={formData.llmProvider}
                        onChange={(e) => setFormData({ ...formData, llmProvider: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <select
                        value={formData.llmModel}
                        onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        {formData.llmProvider === 'openai' ? (
                            <>
                                <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                                <option value="gpt-4o">GPT-4o (Powerful)</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            </>
                        ) : (
                            <>
                                <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
                                <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Powerful)</option>
                                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                            </>
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature: {formData.temperature}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Precise</span>
                        <span>Creative</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                    <input
                        type="number"
                        value={formData.maxTokens}
                        onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        min="100"
                        max="4096"
                    />
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                </button>
            </div>
        </div>
    );
}
