'use client';

import { useState, useEffect } from 'react';
import {
    Bot, BookOpen, MessageSquare, Shield, AlertTriangle, Plus,
    Trash2, Loader2, Save, ChevronDown, ChevronRight, Edit2, X
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
    { id: 'guidance', label: 'Guidance', icon: MessageSquare },
    { id: 'attributes', label: 'Attributes', icon: BookOpen },
    { id: 'guardrails', label: 'Guardrails', icon: Shield },
    { id: 'escalation', label: 'Escalation', icon: AlertTriangle },
];

const GUIDANCE_CATEGORIES = [
    { value: 'communication_style', label: 'Communication Style', description: 'Vocabulary, tone, language' },
    { value: 'context_clarification', label: 'Context Clarification', description: 'Follow-up questions' },
    { value: 'content_sources', label: 'Content Sources', description: 'Specific content to reference' },
    { value: 'spam', label: 'Spam Handling', description: 'How to handle spam messages' },
];

const GUARDRAIL_TYPES = [
    { value: 'content_filter', label: 'Content Filter', description: 'Block inappropriate content' },
    { value: 'topic_restriction', label: 'Topic Restriction', description: 'Limit to certain topics' },
    { value: 'pii_protection', label: 'PII Protection', description: 'Prevent PII disclosure' },
    { value: 'forbidden_actions', label: 'Forbidden Actions', description: 'Actions agent must never take' },
];

export default function TrainPage() {
    const [activeTab, setActiveTab] = useState('guidance');
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">Train AI Agent</h1>
                            <p className="text-xs text-gray-500">Configure behavior rules, attributes, and safety guardrails</p>
                        </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                            {status?.stats?.guidances || 0} guidance
                        </span>
                        <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full font-medium">
                            {status?.stats?.guardrails || 0} guardrails
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
                                    ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50'
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
                {activeTab === 'guidance' && <GuidanceTab onUpdate={loadStatus} />}
                {activeTab === 'attributes' && <AttributesTab onUpdate={loadStatus} />}
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
    const [formData, setFormData] = useState({ category: 'communication_style', title: '', content: '' });
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

    const groupedGuidances = guidances.reduce((acc, g) => {
        if (!acc[g.category]) acc[g.category] = [];
        acc[g.category].push(g);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Guidance Rules</h2>
                    <p className="text-sm text-gray-500">Define how your AI agent should communicate and behave</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Guidance
                </button>
            </div>

            {showAdd && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                            >
                                {GUIDANCE_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                            <input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="e.g., Friendly Tone"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 h-24"
                            placeholder="Describe the guidance rule in detail..."
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addGuidance}
                            disabled={adding}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {adding ? 'Adding...' : 'Add Guidance'}
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

            <div className="flex-1 overflow-y-auto space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : guidances.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No guidance rules yet</p>
                        <p className="text-gray-400 text-sm">Add rules to define how your AI should communicate</p>
                    </div>
                ) : (
                    GUIDANCE_CATEGORIES.map(cat => {
                        const items = groupedGuidances[cat.value] || [];
                        if (items.length === 0) return null;
                        return (
                            <div key={cat.value}>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">{cat.label}</h3>
                                <div className="space-y-2">
                                    {items.map((g: any) => (
                                        <div key={g._id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900">{g.title}</p>
                                                <p className="text-sm text-gray-500 mt-1">{g.content}</p>
                                            </div>
                                            <button
                                                onClick={() => deleteGuidance(g._id)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors ml-2"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Attributes Tab
function AttributesTab({ onUpdate }: { onUpdate: () => void }) {
    const [attributes, setAttributes] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');

    useEffect(() => {
        Promise.all([
            fetchAPI('/attributes'),
            fetchAPI('/attributes/templates')
        ]).then(([attrs, temps]) => {
            setAttributes(attrs);
            setTemplates(temps);
        }).finally(() => setLoading(false));
    }, []);

    async function addFromTemplate() {
        if (!selectedTemplate || !templates[selectedTemplate]) return;
        const template = templates[selectedTemplate];
        try {
            await fetchAPI('/attributes', {
                method: 'POST',
                body: JSON.stringify(template)
            });
            const attrs = await fetchAPI('/attributes');
            setAttributes(attrs);
            setShowAdd(false);
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        }
    }

    async function deleteAttribute(id: string) {
        try {
            await fetchAPI(`/attributes/${id}`, { method: 'DELETE' });
            const attrs = await fetchAPI('/attributes');
            setAttributes(attrs);
            onUpdate();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Attributes</h2>
                    <p className="text-sm text-gray-500">Define attributes to detect from conversations for routing and escalation</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Attribute
                </button>
            </div>

            {showAdd && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {Object.entries(templates).map(([key, temp]: [string, any]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedTemplate(key)}
                                className={`p-3 text-left rounded-xl border-2 transition-all ${selectedTemplate === key
                                        ? 'border-amber-500 bg-amber-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <p className="font-medium text-gray-900">{temp.name}</p>
                                <p className="text-xs text-gray-500">{temp.description}</p>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addFromTemplate}
                            disabled={!selectedTemplate}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            Add Attribute
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
                ) : attributes.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No attributes defined yet</p>
                        <p className="text-gray-400 text-sm">Add attributes like Sentiment, Urgency, Issue Type</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {attributes.map(attr => (
                            <div key={attr._id} className="p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-medium text-gray-900">{attr.name}</p>
                                        <p className="text-sm text-gray-500">{attr.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${attr.purpose === 'escalation' ? 'bg-red-100 text-red-700' :
                                                attr.purpose === 'routing' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-600'
                                            }`}>
                                            {attr.purpose}
                                        </span>
                                        <button
                                            onClick={() => deleteAttribute(attr._id)}
                                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {attr.values?.map((v: any, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600">
                                            {v.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Guardrails Tab
function GuardrailsTab({ onUpdate }: { onUpdate: () => void }) {
    const [guardrails, setGuardrails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({
        type: 'content_filter',
        name: '',
        triggerResponse: '',
        patterns: ''
    });
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
                    type: formData.type,
                    name: formData.name,
                    triggerResponse: formData.triggerResponse,
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

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Guardrails</h2>
                    <p className="text-sm text-gray-500">Safety rules to control what your AI can and cannot do</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Guardrail
                </button>
            </div>

            {showAdd && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                            >
                                {GUARDRAIL_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="e.g., No Competitor Discussion"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Trigger Keywords (comma-separated)</label>
                        <input
                            value={formData.patterns}
                            onChange={(e) => setFormData({ ...formData, patterns: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="competitor1, competitor2, discount"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Response when triggered</label>
                        <input
                            value={formData.triggerResponse}
                            onChange={(e) => setFormData({ ...formData, triggerResponse: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="I'm not able to help with that. Can I assist with something else?"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addGuardrail}
                            disabled={adding}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {adding ? 'Adding...' : 'Add Guardrail'}
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
                ) : guardrails.length === 0 ? (
                    <div className="text-center py-12">
                        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No guardrails defined yet</p>
                        <p className="text-gray-400 text-sm">Add guardrails to keep your AI safe and on-topic</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {guardrails.map(g => (
                            <div key={g._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${g.type === 'content_filter' ? 'bg-red-100' :
                                            g.type === 'topic_restriction' ? 'bg-yellow-100' :
                                                g.type === 'pii_protection' ? 'bg-blue-100' :
                                                    'bg-gray-100'
                                        }`}>
                                        <Shield className={`w-5 h-5 ${g.type === 'content_filter' ? 'text-red-600' :
                                                g.type === 'topic_restriction' ? 'text-yellow-600' :
                                                    g.type === 'pii_protection' ? 'text-blue-600' :
                                                        'text-gray-600'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{g.name}</p>
                                        <p className="text-xs text-gray-500">{g.type.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${g.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {g.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <button
                                        onClick={() => deleteGuardrail(g._id)}
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

// Escalation Tab
function EscalationTab({ onUpdate }: { onUpdate: () => void }) {
    const [rules, setRules] = useState<any[]>([]);
    const [guidances, setGuidances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddRule, setShowAddRule] = useState(false);
    const [showAddGuidance, setShowAddGuidance] = useState(false);
    const [ruleForm, setRuleForm] = useState({ name: '', attributeName: '', value: '', targetTeam: 'support' });
    const [guidanceForm, setGuidanceForm] = useState({ title: '', content: '' });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [r, g] = await Promise.all([
                fetchAPI('/escalation/rules'),
                fetchAPI('/escalation/guidance')
            ]);
            setRules(r);
            setGuidances(g);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }

    async function addRule() {
        try {
            await fetchAPI('/escalation/rules', {
                method: 'POST',
                body: JSON.stringify({
                    name: ruleForm.name,
                    conditions: [{ attributeName: ruleForm.attributeName, operator: 'equals', value: ruleForm.value }],
                    action: 'escalate',
                    targetTeam: ruleForm.targetTeam
                })
            });
            setShowAddRule(false);
            setRuleForm({ name: '', attributeName: '', value: '', targetTeam: 'support' });
            loadData();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        }
    }

    async function addGuidance() {
        try {
            await fetchAPI('/escalation/guidance', {
                method: 'POST',
                body: JSON.stringify(guidanceForm)
            });
            setShowAddGuidance(false);
            setGuidanceForm({ title: '', content: '' });
            loadData();
            onUpdate();
        } catch (err) {
            console.error('Failed to add:', err);
        }
    }

    async function deleteRule(id: string) {
        await fetchAPI(`/escalation/rules/${id}`, { method: 'DELETE' });
        loadData();
        onUpdate();
    }

    async function deleteGuidance(id: string) {
        await fetchAPI(`/escalation/guidance/${id}`, { method: 'DELETE' });
        loadData();
        onUpdate();
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 overflow-y-auto">
            {/* Rules Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-md font-semibold text-gray-900">Escalation Rules</h3>
                        <p className="text-xs text-gray-500">Automatic triggers based on detected attributes</p>
                    </div>
                    <button
                        onClick={() => setShowAddRule(!showAddRule)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-all"
                    >
                        <Plus className="w-3 h-3" />
                        Add Rule
                    </button>
                </div>

                {showAddRule && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="grid grid-cols-4 gap-3 mb-3">
                            <input
                                placeholder="Rule name"
                                value={ruleForm.name}
                                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <input
                                placeholder="Attribute (e.g., Sentiment)"
                                value={ruleForm.attributeName}
                                onChange={(e) => setRuleForm({ ...ruleForm, attributeName: e.target.value })}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <input
                                placeholder="Value (e.g., Negative)"
                                value={ruleForm.value}
                                onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <input
                                placeholder="Target team"
                                value={ruleForm.targetTeam}
                                onChange={(e) => setRuleForm({ ...ruleForm, targetTeam: e.target.value })}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                        </div>
                        <button onClick={addRule} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">Add</button>
                    </div>
                )}

                <div className="space-y-2">
                    {rules.length === 0 ? (
                        <p className="text-gray-400 text-sm py-4">No escalation rules yet</p>
                    ) : rules.map(r => (
                        <div key={r._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">{r.name}</p>
                                <p className="text-xs text-gray-500">
                                    When {r.conditions?.[0]?.attributeName} = {r.conditions?.[0]?.value} → {r.targetTeam}
                                </p>
                            </div>
                            <button onClick={() => deleteRule(r._id)} className="p-2 hover:bg-red-100 rounded-lg">
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Guidance Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-md font-semibold text-gray-900">Escalation Guidance</h3>
                        <p className="text-xs text-gray-500">Natural language guidance for when to escalate</p>
                    </div>
                    <button
                        onClick={() => setShowAddGuidance(!showAddGuidance)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-all"
                    >
                        <Plus className="w-3 h-3" />
                        Add Guidance
                    </button>
                </div>

                {showAddGuidance && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <input
                            placeholder="Title"
                            value={guidanceForm.title}
                            onChange={(e) => setGuidanceForm({ ...guidanceForm, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
                        />
                        <textarea
                            placeholder="When should the AI escalate? (Free-form guidance)"
                            value={guidanceForm.content}
                            onChange={(e) => setGuidanceForm({ ...guidanceForm, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-20 mb-3"
                        />
                        <button onClick={addGuidance} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">Add</button>
                    </div>
                )}

                <div className="space-y-2">
                    {guidances.length === 0 ? (
                        <p className="text-gray-400 text-sm py-4">No escalation guidance yet</p>
                    ) : guidances.map(g => (
                        <div key={g._id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">{g.title}</p>
                                <p className="text-sm text-gray-500">{g.content}</p>
                            </div>
                            <button onClick={() => deleteGuidance(g._id)} className="p-2 hover:bg-red-100 rounded-lg">
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
