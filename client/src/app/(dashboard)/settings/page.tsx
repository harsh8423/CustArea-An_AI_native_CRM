"use client";

import { useState } from "react";
import { Mail, Shield, Bell, User, MessageCircle, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailSettings } from "@/components/settings/EmailSettings";
import { ChannelSettings } from "@/components/settings/ChannelSettings";
import IntegrationsPage from "./integrations/page";

type SettingsTab = "emails" | "channels" | "integrations" | "security" | "notifications" | "profile";

const TABS = [
    { id: "emails" as const, label: "Emails", icon: Mail },
    { id: "channels" as const, label: "Channels", icon: MessageCircle },
    { id: "integrations" as const, label: "Integrations", icon: Puzzle },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "profile" as const, label: "Profile", icon: User },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("emails");

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 flex gap-4 overflow-hidden">

                {/* Left Panel - Mini Tabs */}
                <div className="w-64 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-5">
                        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
                        <p className="text-xs text-gray-400 mt-1">Manage your preferences</p>
                    </div>

                    {/* Mini Tab Navigation */}
                    <div className="flex-1 px-3 pb-3">
                        <div className="space-y-1">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200",
                                        activeTab === tab.id
                                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-900"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                    )}
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                                        activeTab === tab.id
                                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm"
                                            : "bg-gray-100"
                                    )}>
                                        <tab.icon className={cn(
                                            "h-4 w-4",
                                            activeTab === tab.id ? "text-white" : "text-gray-400"
                                        )} />
                                    </div>
                                    <span className="font-medium text-sm">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Settings Content */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
                    {activeTab === "emails" && <EmailSettings />}
                    {activeTab === "channels" && <ChannelSettings />}
                    {activeTab === "integrations" && <IntegrationsPage />}
                    {activeTab === "security" && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <Shield className="h-7 w-7 text-gray-300" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-600">Security Settings</h2>
                            <p className="text-sm text-gray-400 mt-1">Coming soon...</p>
                        </div>
                    )}
                    {activeTab === "notifications" && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <Bell className="h-7 w-7 text-gray-300" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-600">Notification Settings</h2>
                            <p className="text-sm text-gray-400 mt-1">Coming soon...</p>
                        </div>
                    )}
                    {activeTab === "profile" && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <User className="h-7 w-7 text-gray-300" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-600">Profile Settings</h2>
                            <p className="text-sm text-gray-400 mt-1">Coming soon...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
