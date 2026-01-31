"use client";

import { useState, useEffect } from "react";
import { X, Phone, Zap, Settings2 } from "lucide-react";
import { api } from "@/lib/api";

interface CreateVoiceAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    availableNumbers: any[];
}

interface Model {
    id: string;
    provider: string;
    model_name?: string;
    voice_name?: string;
    pricing?: any;
}

export default function CreateVoiceAgentModal({
    isOpen,
    onClose,
    onSuccess,
    availableNumbers
}: CreateVoiceAgentModalProps) {
    const [formData, setFormData] = useState({
        phoneNumber: "",
        voiceAgentName: "",
        welcomeMessage: "",
        agentInstructions: "",
        defaultMethod: "realtime" as 'realtime' | 'legacy',
        sttModelId: "",
        llmModelId: "",
        ttsModelId: "",
        realtimeModelId: ""
    });

    const [models, setModels] = useState<{
        stt: Model[];
        llm: Model[];
        tts: Model[];
        realtime: Model[];
    }>({
        stt: [],
        llm: [],
        tts: [],
        realtime: []
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadModels();
            // Auto-select first available number
            if (availableNumbers.length > 0 && !formData.phoneNumber) {
                setFormData(prev => ({ ...prev, phoneNumber: availableNumbers[0].phone_number }));
            }
        }
    }, [isOpen, availableNumbers]);

    const loadModels = async () => {
        try {
            const [sttRes, llmRes, ttsRes, realtimeRes] = await Promise.all([
                api.models.getSTT(),
                api.models.getLLM(),
                api.models.getTTS(),
                api.models.getRealtime()
            ]);

            setModels({
                stt: sttRes.models || [],
                llm: llmRes.models || [],
                tts: ttsRes.voices || [],
                realtime: realtimeRes.models || []
            });

            // Auto-select first models
            if (sttRes.models?.[0]) setFormData(prev => ({ ...prev, sttModelId: sttRes.models[0].id }));
            if (llmRes.models?.[0]) setFormData(prev => ({ ...prev, llmModelId: llmRes.models[0].id }));
            if (ttsRes.voices?.[0]) setFormData(prev => ({ ...prev, ttsModelId: ttsRes.voices[0].id }));
            if (realtimeRes.models?.[0]) setFormData(prev => ({ ...prev, realtimeModelId: realtimeRes.models[0].id }));
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await api.voiceAgents.create(formData);
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                phoneNumber: "",
                voiceAgentName: "",
                welcomeMessage: "",
                agentInstructions: "",
                defaultMethod: "realtime",
                sttModelId: "",
                llmModelId: "",
                ttsModelId: "",
                realtimeModelId: ""
            });
        } catch (error) {
            console.error('Failed to create voice agent:', error);
            alert('Failed to create voice agent');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-8">
                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">Create Voice Agent</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    {/* Phone Number */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            <Phone className="h-3 w-3 inline mr-1" />
                            Phone Number *
                        </label>
                        <select
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs"
                            required
                        >
                            <option value="">Select a phone number</option>
                            {availableNumbers.map((num) => (
                                <option key={num.id} value={num.phone_number}>
                                    {num.phone_number} ({num.country_name})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Agent Name */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Voice Agent Name *
                        </label>
                        <input
                            type="text"
                            value={formData.voiceAgentName}
                            onChange={(e) => setFormData({ ...formData, voiceAgentName: e.target.value })}
                            placeholder="e.g., Customer Support Agent"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs"
                            required
                        />
                    </div>

                    {/* Method Selection */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            <Zap className="h-3 w-3 inline mr-1" />
                            Processing Method *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, defaultMethod: 'realtime' })}
                                className={`px-3 py-2 rounded-lg border-2 transition-all text-xs font-medium ${formData.defaultMethod === 'realtime'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                <div className="text-xs font-medium text-gray-900">Realtime</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">Faster, single model</div>
                            </button>
                            <button
                                type="button"
                                disabled
                                className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed text-xs font-medium relative"
                            >
                                <div className="text-xs font-medium text-gray-500">Legacy</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">Coming soon</div>
                                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                    Cheaper
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Model Selection - Realtime */}
                    {formData.defaultMethod === 'realtime' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                <Settings2 className="h-3 w-3 inline mr-1" />
                                Realtime Model *
                            </label>
                            <select
                                value={formData.realtimeModelId}
                                onChange={(e) => setFormData({ ...formData, realtimeModelId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs"
                                required
                            >
                                {models.realtime.map((model) => (
                                    <option key={model.id} value={model.id}>
                                        {model.provider} - {model.model_name} ({model.voice_name})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Model Selection - Legacy */}
                    {formData.defaultMethod === 'legacy' && (
                        <div className="space-y-4">
                            {/* STT */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">STT Model *</label>
                                <select
                                    value={formData.sttModelId}
                                    onChange={(e) => setFormData({ ...formData, sttModelId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                    required
                                >
                                    {models.stt.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.provider} - {model.model_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* LLM */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">LLM Model *</label>
                                <select
                                    value={formData.llmModelId}
                                    onChange={(e) => setFormData({ ...formData, llmModelId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                    required
                                >
                                    {models.llm.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.provider} - {model.model_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* TTS */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">TTS Voice *</label>
                                <select
                                    value={formData.ttsModelId}
                                    onChange={(e) => setFormData({ ...formData, ttsModelId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                    required
                                >
                                    {models.tts.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.provider} - {model.voice_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Welcome Message */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Welcome Message (Optional)
                        </label>
                        <textarea
                            value={formData.welcomeMessage}
                            onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                            placeholder="Hello! How can I help you today?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs resize-none"
                        />
                    </div>

                    {/* Agent Instructions */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Custom Instructions (Optional)
                        </label>
                        <textarea
                            value={formData.agentInstructions}
                            onChange={(e) => setFormData({ ...formData, agentInstructions: e.target.value })}
                            placeholder="You are a helpful customer support agent. Be friendly and professional..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Creating...' : 'Create Voice Agent'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
