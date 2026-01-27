'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Bot, BookOpen, Link, FileText, Plus, Trash2,
    Upload, Loader2, Save, Sparkles, ExternalLink, CheckCircle2
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

export default function KnowledgeBasePage() {
    const searchParams = useSearchParams();
    const activeTab = searchParams?.get('tab') || 'base';

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
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading knowledge base...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#eff0eb] p-4">
            <div className="h-full bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden flex flex-col">
                {activeTab === 'base' && <BaseKnowledgeTab agent={agent} onUpdate={loadData} />}
                {activeTab === 'articles' && <ArticlesTab onUpdate={loadData} />}
                {activeTab === 'documents' && <DocumentsTab onUpdate={loadData} />}
            </div>
        </div>
    );
}

// Base Knowledge Tab
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
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full mb-2">
                        <Bot className="w-3 h-3 text-indigo-500" />
                        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Identity</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Who is your AI?</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Define your AI's personality, purpose, and core instructions.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Include in Instructions</h3>
                            <ul className="space-y-0.5 text-xs text-gray-700">
                                <li className="flex items-start gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span><strong>Role:</strong> "Support specialist for [Company]"</span>
                                </li>
                                <li className="flex items-start gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span><strong>Style:</strong> "Friendly, patient, solution-oriented"</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Name */}
                    <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">AI Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="e.g., Support Assistant"
                        />
                    </div>

                    {/* Welcome Message */}
                    <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">First Greeting</label>
                        <input
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Hello! How can I help you today?"
                        />
                    </div>

                    {/* System Instructions */}
                    <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">System Instructions</label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="w-full h-64 px-3 py-2 bg-gray-50 rounded-xl text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="You are a helpful AI assistant..."
                        />
                        <p className="mt-2 text-[10px] text-gray-500">Be specific about tone, response style, and when to escalate.</p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-5">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium shadow-sm disabled:opacity-50 transition-all"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Articles Tab
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
        if (!formData.sourceUrl) return;
        setAdding(true);
        try {
            await fetchAPI('/knowledge', {
                method: 'POST',
                body: JSON.stringify({ ...formData, type: 'url' })
            });
            setFormData({ title: '', sourceUrl: '' });
            setShowAdd(false);
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

    if (loading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 rounded-full mb-2">
                        <BookOpen className="w-3 h-3 text-purple-500" />
                        <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">Articles</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">What should your AI learn?</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Add web pages and articles. We'll automatically extract and index the content.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-300 to-pink-400 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">How It Works</h3>
                            <p className="text-xs text-gray-700">
                                We fetch the page, extract text, and break it into searchable chunks. Your AI searches these during conversations.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-900">Article Library ({sources.length})</h2>
                    {!showAdd && (
                        <button
                            onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-medium shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add Article
                        </button>
                    )}
                </div>

                {/* Add Form */}
                {showAdd && (
                    <div className="mb-5 p-5 bg-white rounded-2xl shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Article URL</label>
                                <input
                                    value={formData.sourceUrl}
                                    onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    placeholder="https://example.com/article"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Title (Optional)</label>
                                <input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    placeholder="Product Return Policy"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={addSource}
                                    disabled={adding || !formData.sourceUrl}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {adding ? 'Adding...' : 'Add Article'}
                                </button>
                                <button
                                    onClick={() => setShowAdd(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Articles List */}
                <div className="space-y-3">
                    {sources.length === 0 ? (
                        <div className="text-center py-12">
                            <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No articles yet</p>
                        </div>
                    ) : (
                        sources.map(source => (
                            <div key={source._id} className="group p-4 bg-white hover:bg-purple-50/30 rounded-2xl shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 mb-1 truncate text-sm">
                                            {source.title || source.sourceUrl}
                                        </h3>
                                        <a
                                            href={source.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-600 hover:underline flex items-center gap-1 mb-2 truncate"
                                        >
                                            <span className="truncate">{source.sourceUrl}</span>
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                        </a>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${source.status === 'processed'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : source.status === 'processing'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                {source.status === 'processed' ? '✓ Processed' :
                                                    source.status === 'processing' ? '⏳ Processing' : '✗ Failed'}
                                            </span>
                                            {source.totalChunks && (
                                                <span className="text-[10px] text-gray-500">{source.totalChunks} chunks</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteSource(source._id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Documents Tab
function DocumentsTab({ onUpdate }: { onUpdate: () => void }) {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadDocuments();
    }, []);

    async function loadDocuments() {
        try {
            const data = await fetchAPI('/knowledge?type=pdf');
            setDocuments(data.filter((s: any) => s.type === 'pdf'));
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
            loadDocuments();
            onUpdate();
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
        }
    }

    async function deleteDocument(id: string) {
        try {
            await fetchAPI(`/knowledge/${id}`, { method: 'DELETE' });
            loadDocuments();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    if (loading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-pink-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-50 rounded-full mb-2">
                        <FileText className="w-3 h-3 text-pink-500" />
                        <span className="text-[10px] font-semibold text-pink-700 uppercase tracking-wider">Documents</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Upload comprehensive guides</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Upload PDF manuals, handbooks, and training materials.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-pink-50/50 to-rose-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-300 to-rose-400 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">PDF Processing</h3>
                            <p className="text-xs text-gray-700">
                                Upload files up to 10MB. We extract text and chunk the content for AI retrieval.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-900">Documents ({documents.length})</h2>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : 'Upload PDF'}
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Documents List */}
                <div className="space-y-3">
                    {documents.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No documents yet</p>
                        </div>
                    ) : (
                        documents.map(doc => (
                            <div key={doc._id} className="group p-4 bg-white hover:bg-pink-50/30 rounded-2xl shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-pink-500" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900 truncate text-sm">
                                                {doc.filename || doc.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${doc.status === 'processed'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : doc.status === 'processing'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                {doc.status === 'processed' ? '✓ Processed' :
                                                    doc.status === 'processing' ? '⏳ Processing' : '✗ Failed'}
                                            </span>
                                            {doc.metadata?.numPages && (
                                                <span className="text-[10px] text-gray-500">{doc.metadata.numPages} pages</span>
                                            )}
                                            {doc.totalChunks && (
                                                <span className="text-[10px] text-gray-500">{doc.totalChunks} chunks</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteDocument(doc._id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
