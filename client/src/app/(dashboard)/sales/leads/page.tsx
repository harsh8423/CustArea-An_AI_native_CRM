"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Filter, Eye, Star, Phone, Mail, Building, Tag,
    ChevronDown, X, ArrowLeft, LayoutGrid
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Stage {
    id: string;
    name: string;
    order_index: number;
}

interface Lead {
    id: string;
    contact_id: string;
    stage_id: string;
    status: string;
    score: number;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    contact_company: string;
    contact_metadata: Record<string, any>;
    stage_name: string;
    stage_order: number;
    created_at: string;
}

// Stage colors
const STAGE_COLORS: Record<string, string> = {
    "New": "bg-blue-100 text-blue-700",
    "Contacted": "bg-cyan-100 text-cyan-700",
    "Discovery": "bg-teal-100 text-teal-700",
    "Qualified": "bg-green-100 text-green-700",
    "Demo / Meeting": "bg-yellow-100 text-yellow-700",
    "Proposal / Quote": "bg-orange-100 text-orange-700",
    "Negotiation": "bg-pink-100 text-pink-700",
    "Won": "bg-emerald-100 text-emerald-700",
    "Lost": "bg-red-100 text-red-700"
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

export default function LeadsPage() {
    const router = useRouter();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stages, setStages] = useState<Stage[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedStage, setSelectedStage] = useState<string>("");
    const [selectedScore, setSelectedScore] = useState<number | null>(null);
    const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
    const [isScoreDropdownOpen, setIsScoreDropdownOpen] = useState(false);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            if (selectedStage) params.stageId = selectedStage;
            if (selectedScore !== null) params.minScore = selectedScore;

            const data = await api.leads.list(params);
            setLeads(data.leads || []);
        } catch (err) {
            console.error("Failed to fetch leads", err);
        } finally {
            setLoading(false);
        }
    }, [search, selectedStage, selectedScore]);

    const fetchStages = async () => {
        try {
            const data = await api.leads.getPipeline();
            setStages(data.stages || []);
        } catch (err) {
            console.error("Failed to fetch stages", err);
        }
    };

    useEffect(() => {
        fetchStages();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchLeads();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchLeads]);

    const handleScoreUpdate = async (leadId: string, score: number) => {
        try {
            await api.leads.updateScore(leadId, score);
            fetchLeads();
        } catch (err) {
            console.error("Failed to update score", err);
        }
    };

    const clearFilters = () => {
        setSearch("");
        setSelectedStage("");
        setSelectedScore(null);
    };

    const hasFilters = search || selectedStage || selectedScore !== null;

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-gray-900">Leads</h1>
                        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl">
                            <button
                                onClick={() => router.push("/sales/contacts")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Contacts
                            </button>
                            <button className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg shadow-sm transition-all duration-200">
                                Leads
                            </button>
                            <button
                                onClick={() => router.push("/sales/lead-board")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                Board
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">
                        <span className="font-semibold text-gray-900">{leads.length}</span> leads
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search leads by name, email, phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    {/* Stage Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsStageDropdownOpen(!isStageDropdownOpen)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition",
                                selectedStage
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                            )}
                        >
                            <Filter className="h-4 w-4" />
                            {selectedStage
                                ? stages.find(s => s.id === selectedStage)?.name || "Stage"
                                : "Stage"}
                            <ChevronDown className="h-4 w-4" />
                        </button>
                        {isStageDropdownOpen && (
                            <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                                <button
                                    onClick={() => { setSelectedStage(""); setIsStageDropdownOpen(false); }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                >
                                    All Stages
                                </button>
                                {stages.map(stage => (
                                    <button
                                        key={stage.id}
                                        onClick={() => { setSelectedStage(stage.id); setIsStageDropdownOpen(false); }}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                                            selectedStage === stage.id && "bg-blue-50 text-blue-700"
                                        )}
                                    >
                                        {stage.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Score Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsScoreDropdownOpen(!isScoreDropdownOpen)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition",
                                selectedScore !== null
                                    ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                            )}
                        >
                            <Star className="h-4 w-4" />
                            {selectedScore !== null ? `${selectedScore}+ Stars` : "Score"}
                            <ChevronDown className="h-4 w-4" />
                        </button>
                        {isScoreDropdownOpen && (
                            <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                                <button
                                    onClick={() => { setSelectedScore(null); setIsScoreDropdownOpen(false); }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                >
                                    Any Score
                                </button>
                                {[1, 2, 3, 4, 5].map(score => (
                                    <button
                                        key={score}
                                        onClick={() => { setSelectedScore(score); setIsScoreDropdownOpen(false); }}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2",
                                            selectedScore === score && "bg-yellow-50 text-yellow-700"
                                        )}
                                    >
                                        {[...Array(score)].map((_, i) => (
                                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        ))}
                                        <span>& up</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clear Filters */}
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                            <X className="h-4 w-4" />
                            Clear
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                        Loading leads...
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                        No leads found. Add contacts to leads from the Contacts page.
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead, idx) => (
                                    <tr
                                        key={lead.id}
                                        className={cn(
                                            "hover:bg-blue-50/30 transition",
                                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                                        )}
                                    >
                                        {/* Name */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                                                    getAvatarColor(lead.contact_name || "")
                                                )}>
                                                    {getInitials(lead.contact_name || "")}
                                                </div>
                                                <span className="font-medium text-gray-900">{lead.contact_name || "Unknown"}</span>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Mail className="h-4 w-4 text-gray-400" />
                                                <a href={`mailto:${lead.contact_email}`} className="hover:text-blue-600 hover:underline">
                                                    {lead.contact_email || "-"}
                                                </a>
                                            </div>
                                        </td>

                                        {/* Phone */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Phone className="h-4 w-4 text-gray-400" />
                                                {lead.contact_phone || "-"}
                                            </div>
                                        </td>

                                        {/* Stage */}
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "px-2.5 py-1 text-xs font-medium rounded-full",
                                                STAGE_COLORS[lead.stage_name] || "bg-gray-100 text-gray-700"
                                            )}>
                                                {lead.stage_name}
                                            </span>
                                        </td>

                                        {/* Score */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={cn(
                                                            "h-4 w-4 cursor-pointer transition",
                                                            star <= (lead.score || 0)
                                                                ? "text-yellow-400 fill-yellow-400"
                                                                : "text-gray-200 hover:text-yellow-300"
                                                        )}
                                                        onClick={() => handleScoreUpdate(lead.id, star)}
                                                    />
                                                ))}
                                            </div>
                                        </td>

                                        {/* Company */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Building className="h-4 w-4 text-gray-400" />
                                                {lead.contact_company || "-"}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => router.push(`/sales/contacts/${lead.contact_id}`)}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 transition flex items-center gap-1.5 ml-auto"
                                            >
                                                <Eye className="h-3 w-3" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
