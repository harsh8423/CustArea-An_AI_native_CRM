"use client";

import { useState, useEffect } from "react";
import { Phone, Plus, Settings, Trash2, Power, PowerOff, ChevronRight, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import RequestPhoneNumberModal from "@/components/voice-agents/RequestPhoneNumberModal";
import CreateVoiceAgentModal from "@/components/voice-agents/CreateVoiceAgentModal";
import { RBACPageIndicator } from "@/components/shared/RBACPageIndicator";

interface VoiceAgent {
    id: string;
    tenant_id: string;
    phone_number: string;
    voice_agent_name: string;
    welcome_message: string | null;
    agent_instructions: string | null;
    default_method: 'realtime' | 'legacy';
    is_active: boolean;
    stt_provider?: string;
    stt_model?: string;
    llm_provider?: string;
    llm_model?: string;
    tts_provider?: string;
    tts_voice?: string;
    rt_provider?: string;
    rt_model?: string;
    rt_voice?: string;
    country_code?: string;
    country_name?: string;
    phone_type?: string;
    monthly_cost?: number;
    created_at: string;
}

interface PhoneNumber {
    id: string;
    phone_number: string;
    country_code: string;
    country_name: string;
    phone_type: string;
    monthly_cost: number;
    is_granted: boolean;
    requested_at: string;
    granted_at: string | null;
    voice_agent_id: string | null;
    voice_agent_name: string | null;
}

export default function VoiceAgentsPage() {
    const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [agentsRes, numbersRes] = await Promise.all([
                api.voiceAgents.list(),
                api.phoneNumbers.list()
            ]);
            setVoiceAgents(agentsRes.voiceAgents || []);
            setPhoneNumbers(numbersRes.phoneNumbers || []);
        } catch (error) {
            console.error('Failed to fetch voice agents:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggleActive = async (agent: VoiceAgent) => {
        try {
            await api.voiceAgents.update(agent.id, { isActive: !agent.is_active });
            fetchData();
        } catch (error) {
            console.error('Failed to toggle agent:', error);
        }
    };

    const handleDeleteAgent = async (agent: VoiceAgent) => {
        if (!confirm(`Are you sure you want to delete ${agent.voice_agent_name}?`)) return;
        try {
            await api.voiceAgents.delete(agent.id);
            fetchData();
        } catch (error) {
            console.error('Failed to delete agent:', error);
        }
    };

    const grantedNumbers = phoneNumbers.filter(p => p.is_granted);
    const pendingNumbers = phoneNumbers.filter(p => !p.is_granted);
    const availableNumbers = grantedNumbers.filter(p => !p.voice_agent_id);

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50 border-b border-gray-100">
                        <div>
                            <h3 className="font-semibold text-gray-900">AI Voice Agents</h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {voiceAgents.length} {voiceAgents.length === 1 ? 'agent' : 'agents'} configured
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (availableNumbers.length === 0) {
                                    setShowRequestModal(true);
                                } else {
                                    setShowCreateAgentModal(true);
                                }
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white rounded-xl transition-all duration-200 text-sm font-medium flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Voice Agent
                        </button>
                    </div>

                    {/* Voice Agents List */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* RBAC Indicator */}
                        <div className="mb-4">
                            <RBACPageIndicator
                                resourceName="Voice Agents"
                                filterDescription="You're seeing voice agents assigned to you and unassigned agents available for use."
                            />
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                    <p className="text-sm text-gray-400">Loading...</p>
                                </div>
                            </div>
                        ) : voiceAgents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-5">
                                    <Phone className="h-9 w-9 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Voice Agents</h3>
                                <p className="text-sm text-gray-400 mb-6 text-center max-w-sm">
                                    Create your first AI voice agent to handle phone calls automatically
                                </p>
                                <button
                                    onClick={() => {
                                        if (availableNumbers.length > 0) {
                                            setShowCreateAgentModal(true);
                                        } else {
                                            setShowRequestModal(true);
                                        }
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white rounded-xl transition-all duration-200 font-medium flex items-center gap-2"
                                >
                                    <Plus className="h-5 w-5" />
                                    Get Started
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {voiceAgents.map((agent) => (
                                    <div
                                        key={agent.id}
                                        className="bg-gradient-to-br from-white to-gray-50/50 rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-xl flex items-center justify-center",
                                                    agent.is_active
                                                        ? "bg-gradient-to-br from-green-400 to-emerald-500"
                                                        : "bg-gradient-to-br from-gray-300 to-gray-400"
                                                )}>
                                                    <Phone className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900">{agent.voice_agent_name}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">{agent.phone_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedAgent(agent);
                                                        setShowCreateAgentModal(true);
                                                    }}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                                                    title="Edit Settings"
                                                >
                                                    <Settings className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(agent)}
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title={agent.is_active ? "Deactivate" : "Activate"}
                                                >
                                                    {agent.is_active ? (
                                                        <Power className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <PowerOff className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgent(agent)}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4 text-gray-400 group-hover:text-red-600" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-500">Method:</span>
                                                <span className="font-medium text-gray-700 capitalize">{agent.default_method}</span>
                                            </div>

                                            {agent.default_method === 'realtime' ? (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-500">Model:</span>
                                                    <span className="font-medium text-gray-700">
                                                        {agent.rt_provider} {agent.rt_model}
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-500">STT:</span>
                                                        <span className="font-medium text-gray-700">{agent.stt_provider}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-500">LLM:</span>
                                                        <span className="font-medium text-gray-700">{agent.llm_model}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-500">TTS:</span>
                                                        <span className="font-medium text-gray-700">{agent.tts_voice}</span>
                                                    </div>
                                                </>
                                            )}

                                            {agent.country_name && (
                                                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                                                    <span className="text-gray-500">Location:</span>
                                                    <span className="font-medium text-gray-700">{agent.country_name}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className={cn(
                                            "mt-4 pt-3 border-t border-gray-100 flex items-center justify-between",
                                        )}>
                                            <span className={cn(
                                                "text-[10px] font-medium px-2 py-1 rounded-full",
                                                agent.is_active
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-600"
                                            )}>
                                                {agent.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                            {agent.monthly_cost && (
                                                <span className="text-xs text-gray-500">
                                                    ${agent.monthly_cost}/mo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Phone Numbers Sidebar */}
                <div className="w-80 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900">Phone Numbers</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{grantedNumbers.length} active</p>
                            </div>
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="p-2 hover:bg-blue-50 rounded-xl transition-colors group"
                            >
                                <Plus className="h-5 w-5 text-blue-500" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Pending Requests */}
                        {pendingNumbers.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-xs font-medium text-gray-500 mb-2 px-2">Pending Requests</h4>
                                <div className="space-y-2">
                                    {pendingNumbers.map((num) => (
                                        <div
                                            key={num.id}
                                            className="bg-amber-50 border border-amber-100 rounded-xl p-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{num.country_name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{num.phone_type}</p>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Pending
                                                </div>
                                            </div>
                                            {num.monthly_cost && (
                                                <p className="text-xs text-gray-500 mt-2">${num.monthly_cost}/mo</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Granted Numbers */}
                        {grantedNumbers.length > 0 && (
                            <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-2 px-2">Available Numbers</h4>
                                <div className="space-y-2">
                                    {grantedNumbers.map((num) => (
                                        <div
                                            key={num.id}
                                            className={cn(
                                                "rounded-xl p-3 border",
                                                num.voice_agent_id
                                                    ? "bg-gray-50 border-gray-100"
                                                    : "bg-green-50 border-green-100"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{num.phone_number}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{num.country_name}</p>
                                                </div>
                                            </div>
                                            {num.voice_agent_id ? (
                                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                                    <ChevronRight className="h-3 w-3" />
                                                    {num.voice_agent_name}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full inline-block">
                                                    Available
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {grantedNumbers.length === 0 && pendingNumbers.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                    <Phone className="h-7 w-7 text-gray-300" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 mb-1">No phone numbers</p>
                                <p className="text-xs text-gray-400 mb-4">Request a number to get started</p>
                                <button
                                    onClick={() => setShowRequestModal(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white rounded-xl text-xs font-medium"
                                >
                                    Request Number
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <RequestPhoneNumberModal
                isOpen={showRequestModal}
                onClose={() => setShowRequestModal(false)}
                onSuccess={fetchData}
            />

            <CreateVoiceAgentModal
                isOpen={showCreateAgentModal}
                onClose={() => {
                    setShowCreateAgentModal(false);
                    setSelectedAgent(null);
                }}
                onSuccess={fetchData}
                availableNumbers={availableNumbers}
            />
        </div>
    );
}
