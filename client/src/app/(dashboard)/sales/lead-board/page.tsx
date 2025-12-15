"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Users, Plus, MoreVertical, User, Building,
    Mail, Phone, GripVertical, CheckCircle, XCircle, LayoutGrid
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Stage {
    id: string;
    name: string;
    order_index: number;
    is_terminal: boolean;
}

interface Lead {
    id: string;
    contact_id: string;
    stage_id: string;
    status: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    contact_company: string;
    stage_name: string;
    stage_order: number;
    created_at: string;
}

// Stage colors
const STAGE_COLORS: Record<string, string> = {
    "New": "bg-blue-500",
    "Contacted": "bg-cyan-500",
    "Discovery": "bg-teal-500",
    "Qualified": "bg-green-500",
    "Demo / Meeting": "bg-yellow-500",
    "Proposal / Quote": "bg-orange-500",
    "Negotiation": "bg-pink-500",
    "Won": "bg-emerald-600",
    "Lost": "bg-red-500"
};

const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const getAvatarColor = (name: string) => {
    const colors = [
        "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
        "bg-indigo-500", "bg-teal-500", "bg-orange-500"
    ];
    const hash = name ? name.charCodeAt(0) + (name.charCodeAt(1) || 0) : 0;
    return colors[hash % colors.length];
};

export default function LeadBoardPage() {
    const router = useRouter();
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

    const fetchData = async () => {
        try {
            const [pipelineData, leadsData] = await Promise.all([
                api.leads.getPipeline(),
                api.leads.list()
            ]);
            setStages(pipelineData.stages || []);
            setLeads(leadsData.leads || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDragStart = (e: React.DragEvent, lead: Lead) => {
        setDraggedLead(lead);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        if (!draggedLead || draggedLead.stage_id === stageId) {
            setDraggedLead(null);
            return;
        }

        // Optimistic update
        setLeads(prev => prev.map(l =>
            l.id === draggedLead.id
                ? { ...l, stage_id: stageId, stage_name: stages.find(s => s.id === stageId)?.name || l.stage_name }
                : l
        ));

        try {
            await api.leads.updateStage(draggedLead.id, stageId);
        } catch (err) {
            console.error("Failed to update lead stage", err);
            fetchData(); // Revert on error
        }

        setDraggedLead(null);
    };

    const getLeadsForStage = (stageId: string) => {
        return leads.filter(l => l.stage_id === stageId);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <div className="text-gray-500">Loading lead board...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-gray-900">Leads</h1>
                        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl">
                            <button
                                onClick={() => router.push("/sales/contacts")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Contacts
                            </button>
                            <button
                                onClick={() => router.push("/sales/leads")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Leads
                            </button>
                            <button className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg shadow-sm transition-all duration-200 flex items-center gap-1.5">
                                <LayoutGrid className="h-4 w-4" />
                                Board
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">
                            <span className="font-semibold text-gray-900">{leads.length}</span> leads
                        </div>
                        <button
                            onClick={() => router.push("/sales/contacts")}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                        >
                            <Plus className="h-4 w-4" />
                            Add Lead
                        </button>
                    </div>
                </div>

                {/* Kanban Board */}
                <div className="flex-1 overflow-x-auto p-4">
                    <div className="flex gap-4 h-full min-w-max">
                        {stages.map((stage) => {
                            const stageLeads = getLeadsForStage(stage.id);
                            const stageColor = STAGE_COLORS[stage.name] || "bg-gray-500";

                            return (
                                <div
                                    key={stage.id}
                                    className="w-72 flex flex-col bg-gray-50/50 rounded-xl"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, stage.id)}
                                >
                                    {/* Stage Header */}
                                    <div className="p-3 border-b border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-3 h-3 rounded-full", stageColor)}></div>
                                                <span className="font-semibold text-gray-900 text-sm">{stage.name}</span>
                                                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                                                    {stageLeads.length}
                                                </span>
                                            </div>
                                            {stage.is_terminal && (
                                                stage.name === "Won"
                                                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                    : <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Lead Cards */}
                                    <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                        {stageLeads.length === 0 ? (
                                            <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                                                Drop leads here
                                            </div>
                                        ) : (
                                            stageLeads.map((lead) => (
                                                <div
                                                    key={lead.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, lead)}
                                                    className={cn(
                                                        "bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-move hover:shadow-md transition group",
                                                        draggedLead?.id === lead.id && "opacity-50"
                                                    )}
                                                >
                                                    {/* Drag Handle */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <GripVertical className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                                                        <button className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition">
                                                            <MoreVertical className="h-4 w-4 text-gray-400" />
                                                        </button>
                                                    </div>

                                                    {/* Lead Info */}
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                                                            getAvatarColor(lead.contact_name || "")
                                                        )}>
                                                            {getInitials(lead.contact_name || "")}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm text-gray-900 truncate">
                                                                {lead.contact_name || "Unknown"}
                                                            </div>
                                                            {lead.contact_company && (
                                                                <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                                                                    <Building className="h-3 w-3" />
                                                                    {lead.contact_company}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Contact Details */}
                                                    <div className="space-y-1 text-xs text-gray-500">
                                                        {lead.contact_email && (
                                                            <div className="flex items-center gap-1 truncate">
                                                                <Mail className="h-3 w-3" />
                                                                {lead.contact_email}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className={cn(
                                                            "px-2 py-0.5 text-xs rounded-full font-medium",
                                                            lead.status === "won" && "bg-emerald-100 text-emerald-700",
                                                            lead.status === "lost" && "bg-red-100 text-red-700",
                                                            lead.status === "open" && "bg-blue-100 text-blue-700",
                                                            !lead.status && "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {lead.status || "open"}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(lead.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
