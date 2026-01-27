'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Bot, MessageSquare, Shield, AlertTriangle, Plus,
    Trash2, Loader2, Sparkles, CheckCircle2
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

const GUIDANCE_CATEGORIES = [
    { value: 'communication_style', label: 'Communication Style', desc: 'How should your AI talk?' },
    { value: 'context_clarification', label: 'Context & Questions', desc: 'What to ask when unclear' },
    { value: 'content_sources', label: 'Knowledge Usage', desc: 'When to reference materials' },
    { value: 'spam', label: 'Spam Handling', desc: 'How to handle unwanted messages' },
];

const GUARDRAIL_TYPES = [
    { value: 'content_filter', label: 'Content Filter', desc: 'Block specific topics' },
    { value: 'topic_restriction', label: 'Topic Boundaries', desc: 'Stay within subjects' },
    { value: 'pii_protection', label: 'Privacy Protection', desc: 'Never share sensitive data' },
    { value: 'forbidden_actions', label: 'Action Limits', desc: 'Things AI cannot do' },
];

export default function TrainPage() {
    const searchParams = useSearchParams();
    const activeTab = searchParams?.get('tab') || 'guidance';
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            const data = await fetchAPI('/status');
            setStatus(data);
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
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading training settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#eff0eb] p-4">
            <div className="h-full bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden flex flex-col">
                {activeTab === 'guidance' && <GuidanceTab onUpdate={loadStatus} />}
                {activeTab === 'guardrails' && <GuardrailsTab onUpdate={loadStatus} />}
                {activeTab === 'escalation' && <EscalationTab onUpdate={loadStatus} />}
            </div>
        </div>
    );
}

// Guidance Tab
function GuidanceTab({ onUpdate }: { onUpdate: () => void }) {
    const [guidances, setGuidances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({ category: ' communication_style', title: '', content: '' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadGuidances();
    }, []);

    async function loadGuidances() {
        try {
            const data = await fetchAPI('/guidance');
            setGuidances(data);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addGuidance() {
        if (!formData.title || !formData.content) return;
        setAdding(true);
        try {
            await fetchAPI('/guidance', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            setShowAdd(false);
            setFormData({ category: 'communication_style', title: '', content: '' });
            loadGuidances();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        } finally {
            setAdding(false);
        }
    }

    async function deleteGuidance(id: string) {
        try {
            await fetchAPI(`/guidance/${id}`, { method: 'DELETE' });
            loadGuidances();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full mb-2">
                        <MessageSquare className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Personality</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">How should your AI communicate?</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Teach your AI the art of conversation. Define tone, style, and behavior patterns.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Getting Started</h3>
                            <p className="text-xs text-gray-700 mb-2">Guidance rules shape how your AI talks:</p>
                            <ul className="space-y-0.5 text-xs text-gray-700">
                                <li className="flex items-start gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span><strong>Style:</strong> "Be warm, not robotic"</span>
                                </li>
                                <li className="flex items-start gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span><strong>Questions:</strong> "Ask before troubleshooting"</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-900">Your Rules ({guidances.length})</h2>
                    {!showAdd && (
                        <button
                            onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-medium shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add Rule
                        </button>
                    )}
                </div>

                {/* Add Form */}
                {showAdd && (
                    <div className="mb-5 p-5 bg-white rounded-2xl shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {GUIDANCE_CATEGORIES.map(cat => (
                                        <button
                                            key={cat.value}
                                            onClick={() => setFormData({ ...formData, category: cat.value })}
                                            className={`p-3 rounded-xl text-left text-xs transition-all ${formData.category === cat.value
                                                    ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-sm'
                                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                                }`}
                                        >
                                            <div className="font-semibold mb-0.5">{cat.label}</div>
                                            <div className={`text-[10px] ${formData.category === cat.value ? 'text-amber-50' : 'text-gray-500'}`}>
                                                {cat.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Rule Name</label>
                                <input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="e.g., Be Empathetic"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Instructions</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    rows={3}
                                    placeholder="Always listen carefully..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={addGuidance}
                                    disabled={adding}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {adding ? 'Saving...' : 'Save'}
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

                {/* Rules List */}
                <div className="space-y-3">
                    {guidances.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No guidance rules yet</p>
                        </div>
                    ) : (
                        guidances.map(g => (
                            <div key={g._id} className="group p-4 bg-white hover:bg-amber-50/30 rounded-2xl shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase mb-1.5">
                                            {GUIDANCE_CATEGORIES.find(c => c.value === g.category)?.label || g.category}
                                        </span>
                                        <h3 className="font-semibold text-gray-900 mb-1 text-sm">{g.title}</h3>
                                        <p className="text-xs text-gray-700 leading-relaxed">{g.content}</p>
                                    </div>
                                    <button
                                        onClick={() => deleteGuidance(g._id)}
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

// Guardrails Tab
function GuardrailsTab({ onUpdate }: { onUpdate: () => void }) {
    const [guardrails, setGuardrails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({ type: 'content_filter', name: '', triggerResponse: '', patterns: '' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadGuardrails();
    }, []);

    async function loadGuardrails() {
        try {
            const data = await fetchAPI('/guardrails');
            setGuardrails(data);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addGuardrail() {
        if (!formData.name) return;
        setAdding(true);
        try {
            await fetchAPI('/guardrails', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    condition: {
                        type: 'keyword',
                        patterns: formData.patterns.split(',').map(p => p.trim()).filter(Boolean)
                    },
                    action: 'block'
                })
            });
            setShowAdd(false);
            setFormData({ type: 'content_filter', name: '', triggerResponse: '', patterns: '' });
            loadGuardrails();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        } finally {
            setAdding(false);
        }
    }

    async function deleteGuardrail(id: string) {
        try {
            await fetchAPI(`/guardrails/${id}`, { method: 'DELETE' });
            loadGuardrails();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 rounded-full mb-2">
                        <Shield className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Safety</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">What topics are off-limits?</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Set hard boundaries your AI will never cross. Protect against inappropriate responses.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-red-50/50 to-orange-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-300 to-orange-400 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">How It Works</h3>
                            <p className="text-xs text-gray-700">
                                When a user mentions forbidden keywords, AI blocks the conversation and responds with your custom message.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-900">Active Guardrails ({guardrails.length})</h2>
                    {!showAdd && (
                        <button
                            onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-400 to-orange-400 hover:from-red-500 hover:to-orange-500 text-white rounded-xl text-sm font-medium shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add Guardrail
                        </button>
                    )}
                </div>

                {/* Add Form */}
                {showAdd && (
                    <div className="mb-5 p-5 bg-white rounded-2xl shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {GUARDRAIL_TYPES.map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => setFormData({ ...formData, type: type.value })}
                                            className={`p-3 rounded-xl text-left text-xs transition-all ${formData.type === type.value
                                                    ? 'bg-gradient-to-br from-red-400 to-orange-400 text-white shadow-sm'
                                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                                }`}
                                        >
                                            <div className="font-semibold mb-0.5">{type.label}</div>
                                            <div className={`text-[10px] ${formData.type === type.value ? 'text-red-50' : 'text-gray-500'}`}>
                                                {type.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Name</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="e.g., No Competitor Discussion"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Forbidden Keywords</label>
                                <input
                                    value={formData.patterns}
                                    onChange={(e) => setFormData({ ...formData, patterns: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="competitor1, discount"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Response When Triggered</label>
                                <textarea
                                    value={formData.triggerResponse}
                                    onChange={(e) => setFormData({ ...formData, triggerResponse: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                                    rows={2}
                                    placeholder="I cannot discuss that topic..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={addGuardrail}
                                    disabled={adding}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-400 to-orange-400 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {adding ? 'Saving...' : 'Save'}
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

                {/* Guardrails List */}
                <div className="space-y-3">
                    {guardrails.length === 0 ? (
                        <div className="text-center py-12">
                            <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No guardrails yet</p>
                        </div>
                    ) : (
                        guardrails.map(g => (
                            <div key={g._id} className="group p-4 bg-white hover:bg-red-50/30 rounded-2xl shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase mb-1.5">
                                            {GUARDRAIL_TYPES.find(t => t.value === g.type)?.label || g.type}
                                        </span>
                                        <h3 className="font-semibold text-gray-900 mb-2 text-sm">{g.name}</h3>
                                        {g.condition?.patterns && (
                                            <div className="mb-2">
                                                <p className="text-[10px] font-semibold text-gray-500 mb-1">Blocks:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {g.condition.patterns.map((p: string, i: number) => (
                                                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded">
                                                            "{p}"
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-2 bg-gray-50 rounded-xl">
                                            <p className="text-xs text-gray-700 italic">"{g.triggerResponse}"</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteGuardrail(g._id)}
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

// Escalation Tab
function EscalationTab({ onUpdate }: { onUpdate: () => void }) {
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({ name: '', attributeName: '', operator: 'equals', value: '', targetTeam: 'support' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    async function loadRules() {
        try {
            const data = await fetchAPI('/escalation/rules');
            setRules(data);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addRule() {
        if (!formData.name) return;
        setAdding(true);
        try {
            await fetchAPI('/escalation/rules', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name,
                    conditions: [{ attributeName: formData.attributeName, operator: formData.operator, value: formData.value }],
                    action: 'escalate',
                    targetTeam: formData.targetTeam
                })
            });
            setShowAdd(false);
            setFormData({ name: '', attributeName: '', operator: 'equals', value: '', targetTeam: 'support' });
            loadRules();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        } finally {
            setAdding(false);
        }
    }

    async function deleteRule(id: string) {
        try {
            await fetchAPI(`/escalation/rules/${id}`, { method: 'DELETE' });
            loadRules();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-rose-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                {/* Hero */}
                <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 rounded-full mb-2">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider">Handoff</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">When should AI ask for help?</h1>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Set smart triggers to automatically transfer conversations to your team.
                    </p>
                </div>

                {/* Quick Guide */}
                <div className="mb-5 p-4 bg-gradient-to-br from-rose-50/50 to-pink-50/30 rounded-2xl">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Examples</h3>
                            <div className="text-xs text-gray-700 space-y-0.5">
                                <p>• Sentiment = Negative → Alert support</p>
                                <p>• Topic = Refund → Alert billing</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-900">Escalation Rules ({rules.length})</h2>
                    {!showAdd && (
                        <button
                            onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-400 to-pink-400 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-sm font-medium shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add Rule
                        </button>
                    )}
                </div>

                {/* Add Form */}
                {showAdd && (
                    <div className="mb-5 p-5 bg-white rounded-2xl shadow-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Rule Name</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                    placeholder="e.g., Angry Customer"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">Attribute</label>
                                    <input
                                        value={formData.attributeName}
                                        onChange={(e) => setFormData({ ...formData, attributeName: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                        placeholder="Sentiment"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">Value</label>
                                    <input
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                        placeholder="Negative"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Transfer To Team</label>
                                <input
                                    value={formData.targetTeam}
                                    onChange={(e) => setFormData({ ...formData, targetTeam: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                    placeholder="support"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={addRule}
                                    disabled={adding}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {adding ? 'Saving...' : 'Save'}
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

                {/* Rules List */}
                <div className="space-y-3">
                    {rules.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No escalation rules yet</p>
                        </div>
                    ) : (
                        rules.map(r => (
                            <div key={r._id} className="group p-4 bg-white hover:bg-rose-50/30 rounded-2xl shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 mb-2 text-sm">{r.name}</h3>
                                        <div className="flex items-center gap-2 text-xs flex-wrap">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                                                {r.conditions?.[0]?.attributeName}
                                            </span>
                                            <span className="text-gray-400">=</span>
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                                                {r.conditions?.[0]?.value}
                                            </span>
                                            <span className="text-gray-400">→</span>
                                            <span className="px-2 py-0.5 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-full font-semibold">
                                                {r.targetTeam}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteRule(r._id)}
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
