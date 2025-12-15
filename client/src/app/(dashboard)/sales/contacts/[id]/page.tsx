"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Mail, Phone, Building, MapPin, User,
    MessageSquare, Plus, ChevronRight, Edit3, MoreHorizontal,
    Clock, FileText, Sparkles, ExternalLink, Star, Send,
    Calendar, Activity, Heart, Globe
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    company_name: string;
    source: string;
    created_at: string;
    score: number;
    metadata?: Record<string, any>;
}

const DUMMY_CONVERSATIONS = [
    { id: "1", preview: "Finally we made some resources to help setting up...", date: "6d ago", type: "email" },
    { id: "2", preview: "[Image \"animation-email-1200×369-479e75f1a5a14b...\"", date: "12d ago", type: "image", count: 2 },
    { id: "3", preview: "Thanks for reaching out! We'd love to help...", date: "15d ago", type: "email" },
];

const DUMMY_EVENTS = [
    { id: "1", type: "Page View", description: "Viewed pricing page", time: "2h ago", icon: Globe },
    { id: "2", type: "Email Opened", description: "Welcome email", time: "1d ago", icon: Mail },
    { id: "3", type: "Form Submit", description: "Contact form", time: "3d ago", icon: FileText },
];

const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const AVATAR_GRADIENTS = [
    "from-blue-500 via-blue-600 to-indigo-600",
    "from-emerald-500 via-green-500 to-teal-600",
    "from-purple-500 via-violet-500 to-indigo-600",
    "from-pink-500 via-rose-500 to-red-500",
    "from-amber-500 via-orange-500 to-red-500",
    "from-cyan-500 via-teal-500 to-emerald-600"
];

const getAvatarGradient = (name: string) => {
    const hash = name ? name.charCodeAt(0) + (name.charCodeAt(1) || 0) : 0;
    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

export default function ContactProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [contact, setContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<"conversations" | "activity">("conversations");

    useEffect(() => {
        const fetchContact = async () => {
            try {
                const data = await api.contacts.list({ limit: 500 });
                const found = data.contacts.find((c: Contact) => c.id === params.id);
                setContact(found || null);
            } catch (err) {
                console.error("Failed to fetch contact", err);
            } finally {
                setLoading(false);
            }
        };
        fetchContact();
    }, [params.id]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#eff0eb]">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
                        <div className="absolute inset-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
                    </div>
                    <span className="text-sm text-gray-400 font-medium">Loading profile...</span>
                </div>
            </div>
        );
    }

    if (!contact) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#eff0eb] gap-4">
                <div className="h-20 w-20 rounded-3xl bg-white shadow-sm flex items-center justify-center">
                    <User className="h-10 w-10 text-gray-300" />
                </div>
                <div className="text-gray-500 font-medium">Contact not found</div>
                <button onClick={() => router.push("/sales/contacts")} className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                    ← Back to contacts
                </button>
            </div>
        );
    }

    const displayName = contact.name || contact.email?.split('@')[0] || "Unknown";
    const source = contact.source || "User";

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            {/* Hero Header */}
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
                {/* Gradient Banner */}
                <div className="relative h-28 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 overflow-hidden">
                    {/* Decorative Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-full h-full" style={{
                            backgroundImage: `radial-gradient(circle at 25% 50%, rgba(255,255,255,0.2) 0%, transparent 50%),
                                             radial-gradient(circle at 75% 30%, rgba(255,255,255,0.15) 0%, transparent 40%)`
                        }} />
                    </div>

                    {/* Floating Elements */}
                    <div className="absolute top-8 left-[15%] w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                    <div className="absolute top-12 left-[45%] w-1.5 h-1.5 rounded-full bg-white/30" />
                    <div className="absolute top-6 right-[25%] w-2 h-2 rounded-full bg-white/15 animate-pulse" style={{ animationDelay: '1s' }} />

                    {/* Back Button */}
                    <button
                        onClick={() => router.push("/sales/contacts")}
                        className="absolute top-4 left-4 p-2.5 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl transition-all duration-200 group"
                    >
                        <ArrowLeft className="h-4 w-4 text-white/80 group-hover:text-white" />
                    </button>

                    {/* Quick Actions */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <button className="p-2.5 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl transition-all duration-200">
                            <Heart className="h-4 w-4 text-white/80" />
                        </button>
                        <button className="p-2.5 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl transition-all duration-200">
                            <MoreHorizontal className="h-4 w-4 text-white/80" />
                        </button>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="relative px-6 pb-5">
                    {/* Large Avatar */}
                    <div className="absolute -top-10 left-6">
                        <div className={cn(
                            "h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br shadow-xl ring-4 ring-white",
                            getAvatarGradient(displayName)
                        )}>
                            {getInitials(displayName)}
                        </div>
                        {contact.score >= 4 && (
                            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-amber-400 rounded-lg flex items-center justify-center shadow-lg">
                                <Star className="h-3.5 w-3.5 text-white fill-white" />
                            </div>
                        )}
                    </div>

                    {/* Info & Actions Row */}
                    <div className="pt-12 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                                <span className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-xs font-semibold rounded-lg">
                                    {source}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                {contact.company_name && (
                                    <span className="flex items-center gap-1.5">
                                        <Building className="h-4 w-4 text-gray-400" />
                                        {contact.company_name}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-gray-400" />
                                    {contact.metadata?.location || "Unknown location"}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    Joined {new Date(contact.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200">
                                <Phone className="h-4 w-4" />
                                Call
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200">
                                <Send className="h-4 w-4" />
                                Email
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200">
                                <MessageSquare className="h-4 w-4" />
                                New Conversation
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Three Panel Layout */}
            <div className="flex-1 flex gap-4 overflow-hidden">

                {/* Left Panel - Contact Info */}
                <div className="w-72 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 flex-1 overflow-y-auto">
                        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Contact Details</h2>

                        {/* Contact Fields */}
                        <div className="space-y-1">
                            {[
                                { icon: Mail, label: "Email", value: contact.email || "Not provided", color: "text-blue-500" },
                                { icon: Phone, label: "Phone", value: contact.phone || "Not provided", color: "text-green-500" },
                                { icon: Building, label: "Company", value: contact.company_name || "Not provided", color: "text-purple-500" },
                                { icon: MapPin, label: "Location", value: contact.metadata?.location || "Unknown", color: "text-red-400" },
                                { icon: Globe, label: "Website", value: contact.metadata?.website || "Not provided", color: "text-teal-500" },
                            ].map((field, i) => (
                                <button
                                    key={i}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 text-left group"
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-gray-100 group-hover:to-gray-200 transition-all duration-200",
                                    )}>
                                        <field.icon className={cn("h-4 w-4", field.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{field.label}</div>
                                        <div className={cn(
                                            "text-sm font-medium truncate",
                                            field.value === "Not provided" || field.value === "Unknown"
                                                ? "text-gray-300"
                                                : "text-gray-800"
                                        )}>
                                            {field.value}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                                </button>
                            ))}
                        </div>

                        {/* Lead Score */}
                        <div className="mt-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Lead Score</span>
                                <span className="text-lg font-bold text-amber-600">{contact.score || 0}/5</span>
                            </div>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={cn(
                                            "h-5 w-5 transition-all cursor-pointer hover:scale-110",
                                            star <= (contact.score || 0)
                                                ? "text-amber-400 fill-amber-400"
                                                : "text-amber-200"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="p-4 bg-gradient-to-t from-gray-50 to-white">
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200">
                            <Edit3 className="h-4 w-4" />
                            Add Note
                        </button>
                    </div>
                </div>

                {/* Center Panel - Conversations */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden min-w-0">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 p-2 m-3 bg-gray-100 rounded-xl">
                        {[
                            { id: "conversations", label: "Conversations", icon: MessageSquare, count: DUMMY_CONVERSATIONS.length },
                            { id: "activity", label: "Activity", icon: Activity }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSection(tab.id as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    activeSection === tab.id
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.count && (
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-semibold",
                                        activeSection === tab.id
                                            ? "bg-blue-100 text-blue-600"
                                            : "bg-gray-200 text-gray-500"
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                        {activeSection === "conversations" ? (
                            <div className="space-y-2">
                                {DUMMY_CONVERSATIONS.map((conv, i) => (
                                    <div
                                        key={conv.id}
                                        className="group flex items-start gap-4 p-4 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all duration-200 cursor-pointer"
                                    >
                                        <div className={cn(
                                            "h-11 w-11 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br shadow-sm shrink-0",
                                            getAvatarGradient(displayName)
                                        )}>
                                            {getInitials(displayName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-green-600">{displayName}</span>
                                                <span className="text-gray-400">replied to this</span>
                                                <span className="text-blue-500 font-medium">conversation</span>
                                                <span className="text-gray-400">with</span>
                                                <span className="font-semibold text-gray-800">You</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1 truncate">{conv.preview}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-gray-400 font-medium">{conv.date}</span>
                                            {conv.count && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                                                    {conv.count}
                                                </span>
                                            )}
                                            <ExternalLink className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {DUMMY_EVENTS.map((event) => (
                                    <div key={event.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                                            <event.icon className="h-4 w-4 text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-800">{event.type}</div>
                                            <div className="text-sm text-gray-500">{event.description}</div>
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium">{event.time}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Recent Activity */}
                <div className="w-64 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 flex-1 overflow-y-auto">
                        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Events</h2>

                        <div className="space-y-3">
                            {DUMMY_EVENTS.map((event) => (
                                <div
                                    key={event.id}
                                    className="p-3 rounded-xl bg-gradient-to-br from-gray-50 to-transparent hover:from-gray-100 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <event.icon className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-sm font-semibold text-gray-800">{event.type}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">{event.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{event.time}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="p-4 bg-gradient-to-t from-gray-50 to-white">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl text-center">
                                <div className="text-lg font-bold text-blue-600">12</div>
                                <div className="text-[10px] text-blue-500 font-medium">Emails</div>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl text-center">
                                <div className="text-lg font-bold text-green-600">3</div>
                                <div className="text-[10px] text-green-500 font-medium">Calls</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
