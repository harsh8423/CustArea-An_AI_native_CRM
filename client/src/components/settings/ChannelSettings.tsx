"use client";

import { useState, useEffect, useCallback } from "react";
import {
    MessageCircle, Phone, Globe, Plus, Trash2, RefreshCw,
    Check, X, Copy, ChevronDown, ChevronUp, AlertCircle, Eye, EyeOff
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WhatsAppConfig {
    id: string;
    phone_number: string;
    is_active: boolean;
}

interface WidgetConfig {
    id: string;
    publicKey: string;
    allowedDomains: string[];
    theme: any;
    welcomeMessage: string;
    requireEmail: boolean;
    isActive: boolean;
}

interface PhoneConfig {
    id: string;
    phone_number: string;
    voice_model: string;
    transcription_enabled: boolean;
    recording_enabled: boolean;
    is_active: boolean;
}

export function ChannelSettings() {
    const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
    const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
    const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(null);
    const [webhookUrls, setWebhookUrls] = useState({ whatsapp: "", widget: "", phone: "" });
    const [embedCode, setEmbedCode] = useState("");
    const [loading, setLoading] = useState(true);

    // Form states
    const [whatsappForm, setWhatsappForm] = useState({ twilioAccountSid: "", twilioAuthToken: "", phoneNumber: "" });
    const [widgetForm, setWidgetForm] = useState({ allowedDomains: "", welcomeMessage: "", requireEmail: false });
    const [phoneForm, setPhoneForm] = useState({ twilioAccountSid: "", twilioAuthToken: "", phoneNumber: "", voiceModel: "en-US-Neural2-F", transcriptionEnabled: true, recordingEnabled: false });

    // UI states
    const [showWhatsappToken, setShowWhatsappToken] = useState(false);
    const [showPhoneToken, setShowPhoneToken] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ whatsapp: true, widget: true, phone: true });
    const [saving, setSaving] = useState<string | null>(null);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [waRes, widgetRes, phoneRes] = await Promise.all([
                api.channels.getWhatsapp(),
                api.channels.getWidget(),
                api.channels.getPhone()
            ]);

            setWhatsappConfig(waRes.config);
            setWebhookUrls(prev => ({ ...prev, whatsapp: waRes.webhookUrl || "" }));

            if (widgetRes.config) {
                setWidgetConfig(widgetRes.config);
                setEmbedCode(widgetRes.embedCode || "");
                setWidgetForm({
                    allowedDomains: (widgetRes.config.allowedDomains || []).join(", "),
                    welcomeMessage: widgetRes.config.welcomeMessage || "",
                    requireEmail: widgetRes.config.requireEmail || false
                });
            }

            setPhoneConfig(phoneRes.config);
            setWebhookUrls(prev => ({ ...prev, phone: phoneRes.webhookUrl || "" }));
        } catch (err) {
            console.error("Failed to fetch channel configs:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveWhatsapp = async () => {
        if (!whatsappForm.twilioAccountSid || !whatsappForm.twilioAuthToken || !whatsappForm.phoneNumber) return;
        setSaving("whatsapp");
        try {
            const res = await api.channels.saveWhatsapp(whatsappForm);
            if (res.config) {
                setWhatsappConfig(res.config);
                setWhatsappForm({ twilioAccountSid: "", twilioAuthToken: "", phoneNumber: "" });
            }
        } catch (err) {
            console.error("Failed to save WhatsApp:", err);
        } finally {
            setSaving(null);
        }
    };

    const handleSaveWidget = async () => {
        setSaving("widget");
        try {
            const res = await api.channels.saveWidget({
                allowedDomains: widgetForm.allowedDomains.split(",").map(d => d.trim()).filter(Boolean),
                welcomeMessage: widgetForm.welcomeMessage,
                requireEmail: widgetForm.requireEmail
            });
            if (res.config) {
                setWidgetConfig(res.config);
                setEmbedCode(res.embedCode || "");
            }
        } catch (err) {
            console.error("Failed to save Widget:", err);
        } finally {
            setSaving(null);
        }
    };

    const handleSavePhone = async () => {
        if (!phoneForm.twilioAccountSid || !phoneForm.twilioAuthToken || !phoneForm.phoneNumber) return;
        setSaving("phone");
        try {
            const res = await api.channels.savePhone(phoneForm);
            if (res.config) {
                setPhoneConfig(res.config);
                setPhoneForm(prev => ({ ...prev, twilioAccountSid: "", twilioAuthToken: "" }));
            }
        } catch (err) {
            console.error("Failed to save Phone:", err);
        } finally {
            setSaving(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Channel Configuration</h2>
                    <p className="text-sm text-gray-500">Configure WhatsApp, Chat Widget, and Phone channels</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* WhatsApp Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("whatsapp")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-green-50/50"
                >
                    <div className="flex items-center gap-3">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-gray-900">WhatsApp (Twilio)</span>
                        {whatsappConfig?.is_active && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                        )}
                    </div>
                    {expandedSections.whatsapp ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.whatsapp && (
                    <div className="p-4 space-y-4">
                        {whatsappConfig ? (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{whatsappConfig.phone_number}</p>
                                        <p className="text-xs text-gray-500">Configured WhatsApp number</p>
                                    </div>
                                    <Check className="h-5 w-5 text-green-500" />
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-500 mb-1">Webhook URL (set in Twilio console):</p>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1">{webhookUrls.whatsapp}</code>
                                        <button onClick={() => copyToClipboard(webhookUrls.whatsapp)} className="text-gray-400 hover:text-gray-600">
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                        <div className="text-sm text-blue-800">
                                            <p className="font-medium">Setup Instructions:</p>
                                            <ol className="list-decimal ml-4 mt-1 space-y-1">
                                                <li>Create a Twilio account and get a WhatsApp number</li>
                                                <li>Enter your Twilio credentials below</li>
                                                <li>Set the webhook URL in Twilio console</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Twilio Account SID"
                                        value={whatsappForm.twilioAccountSid}
                                        onChange={(e) => setWhatsappForm(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                    <div className="relative">
                                        <input
                                            type={showWhatsappToken ? "text" : "password"}
                                            placeholder="Twilio Auth Token"
                                            value={whatsappForm.twilioAuthToken}
                                            onChange={(e) => setWhatsappForm(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                                            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                        />
                                        <button
                                            onClick={() => setShowWhatsappToken(!showWhatsappToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                        >
                                            {showWhatsappToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="WhatsApp Number (e.g., +14155551234)"
                                    value={whatsappForm.phoneNumber}
                                    onChange={(e) => setWhatsappForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                />
                                <button
                                    onClick={handleSaveWhatsapp}
                                    disabled={saving === "whatsapp"}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {saving === "whatsapp" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Connect WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Widget Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("widget")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-purple-50/50"
                >
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Chat Widget</span>
                        {widgetConfig?.isActive && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Active</span>
                        )}
                    </div>
                    {expandedSections.widget ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.widget && (
                    <div className="p-4 space-y-4">
                        {widgetConfig ? (
                            <div className="space-y-4">
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-2">Widget ID (unique for your tenant):</p>
                                    <div className="flex items-center gap-2 mb-4">
                                        <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono flex-1">{widgetConfig.publicKey}</code>
                                        <button onClick={() => copyToClipboard(widgetConfig.publicKey)} className="text-gray-400 hover:text-gray-600">
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">Embed Code:</p>
                                    <div className="relative">
                                        <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">{embedCode}</pre>
                                        <button
                                            onClick={() => copyToClipboard(embedCode)}
                                            className="absolute top-2 right-2 text-gray-400 hover:text-white"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">Allowed Domains (comma separated)</label>
                                        <input
                                            type="text"
                                            placeholder="example.com, *.example.com"
                                            value={widgetForm.allowedDomains}
                                            onChange={(e) => setWidgetForm(prev => ({ ...prev, allowedDomains: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">Welcome Message</label>
                                        <input
                                            type="text"
                                            placeholder="Hi! How can I help you today?"
                                            value={widgetForm.welcomeMessage}
                                            onChange={(e) => setWidgetForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={widgetForm.requireEmail}
                                            onChange={(e) => setWidgetForm(prev => ({ ...prev, requireEmail: e.target.checked }))}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Require email before chat</span>
                                    </label>
                                    <button
                                        onClick={handleSaveWidget}
                                        disabled={saving === "widget"}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                                    >
                                        {saving === "widget" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Enable the chat widget to embed on your website.</p>
                                <button
                                    onClick={handleSaveWidget}
                                    disabled={saving === "widget"}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                                >
                                    {saving === "widget" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Enable Widget
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Phone Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("phone")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-orange-50/50"
                >
                    <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-orange-600" />
                        <span className="font-medium text-gray-900">Phone/Voice (Twilio)</span>
                        {phoneConfig?.is_active && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Active</span>
                        )}
                    </div>
                    {expandedSections.phone ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.phone && (
                    <div className="p-4 space-y-4">
                        {phoneConfig ? (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{phoneConfig.phone_number}</p>
                                        <p className="text-xs text-gray-500">Configured phone number</p>
                                    </div>
                                    <Check className="h-5 w-5 text-green-500" />
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Voice Model:</span>
                                        <span className="text-gray-900">{phoneConfig.voice_model}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Transcription:</span>
                                        <span className={phoneConfig.transcription_enabled ? "text-green-600" : "text-gray-400"}>
                                            {phoneConfig.transcription_enabled ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Recording:</span>
                                        <span className={phoneConfig.recording_enabled ? "text-green-600" : "text-gray-400"}>
                                            {phoneConfig.recording_enabled ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Twilio Account SID"
                                        value={phoneForm.twilioAccountSid}
                                        onChange={(e) => setPhoneForm(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                    <div className="relative">
                                        <input
                                            type={showPhoneToken ? "text" : "password"}
                                            placeholder="Twilio Auth Token"
                                            value={phoneForm.twilioAuthToken}
                                            onChange={(e) => setPhoneForm(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                                            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                        <button
                                            onClick={() => setShowPhoneToken(!showPhoneToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                        >
                                            {showPhoneToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Phone Number (e.g., +14155551234)"
                                    value={phoneForm.phoneNumber}
                                    onChange={(e) => setPhoneForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={phoneForm.transcriptionEnabled}
                                            onChange={(e) => setPhoneForm(prev => ({ ...prev, transcriptionEnabled: e.target.checked }))}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Enable Transcription</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={phoneForm.recordingEnabled}
                                            onChange={(e) => setPhoneForm(prev => ({ ...prev, recordingEnabled: e.target.checked }))}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Enable Recording</span>
                                    </label>
                                </div>
                                <button
                                    onClick={handleSavePhone}
                                    disabled={saving === "phone"}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                                >
                                    {saving === "phone" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Connect Phone
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
