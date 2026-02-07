"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Globe, Mail, Plus, Trash2, RefreshCw, Send, Check, X,
    AlertCircle, Copy, ChevronDown, ChevronUp, Inbox, Clock
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SESIdentity {
    id: string;
    identity_type: string;
    identity_value: string;
    verification_status: string;
    dkim_status: string;
    dkim_tokens: string[];
    spf_instructions: string;
    last_checked_at: string;
    created_at: string;
    ownership_verified_at: string | null;
    ownership_verification_method: string | null;
}

interface DomainClaimResponse {
    domain: string;
    verificationToken: string;
    dnsRecord: {
        type: string;
        name: string;
        value: string;
    };
    instructions: string[];
    expiresAt: string;
    alreadyOwned?: boolean;
}

interface AllowedEmail {
    id: string;
    email_address: string;
    is_default: boolean;
    domain: string;
    verification_status: string;
}

interface AllowedInbound {
    id: string;
    email_address: string;
    description: string;
    is_active: boolean;
    created_at: string;
}

interface OutboundEmail {
    id: string;
    to_email: string;
    from_email: string;
    subject: string;
    status: string;
    sent_at: string;
    created_at: string;
}

interface DNSRecords {
    dkim: Array<{ type: string; name: string; value: string }>;
    spf: { type: string; name: string; value: string };
}

interface GmailConnection {
    id: string;
    provider_type: string;
    email: string;
    is_default: boolean;
    is_active: boolean;
    expires_at?: string;
}

interface OutlookConnection {
    id: string;
    provider_type: string;
    email: string;
    is_default: boolean;
    is_active: boolean;
    expires_at?: string;
}

export function EmailSettings() {
    const [identities, setIdentities] = useState<SESIdentity[]>([]);
    const [allowedFrom, setAllowedFrom] = useState<AllowedEmail[]>([]);
    const [allowedInbound, setAllowedInbound] = useState<AllowedInbound[]>([]);
    const [outboundEmails, setOutboundEmails] = useState<OutboundEmail[]>([]);
    const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
    const [outlookConnections, setOutlookConnections] = useState<OutlookConnection[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [newDomain, setNewDomain] = useState("");
    const [newFromEmail, setNewFromEmail] = useState("");
    const [selectedIdentity, setSelectedIdentity] = useState("");
    const [newInboundEmail, setNewInboundEmail] = useState("");
    const [newInboundDesc, setNewInboundDesc] = useState("");

    // Domain ownership workflow states
    const [domainClaimResponse, setDomainClaimResponse] = useState<DomainClaimResponse | null>(null);
    const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    // DNS Records display  
    const [dnsRecords, setDnsRecords] = useState<DNSRecords | null>(null);
    const [showDnsRecords, setShowDnsRecords] = useState(false);

    // Section collapse states
    const [expandedSections, setExpandedSections] = useState({
        gmail: true,
        outlook: true,
        domains: true,
        senders: true,
        inbound: true,
        history: false
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [identitiesRes, allowedFromRes, allowedInboundRes, outboundRes, gmailRes, outlookRes] = await Promise.all([
                api.email.getIdentities(),
                api.email.getAllowedFrom(),
                api.email.getAllowedInbound(),
                api.email.getOutboundEmails(20),
                api.gmail.getStatus().catch(() => ({ connections: [] })),
                api.outlook.getStatus().catch(() => ({ connections: [] }))
            ]);

            setIdentities(identitiesRes.identities || []);
            setAllowedFrom(allowedFromRes.allowedEmails || []);
            setAllowedInbound(allowedInboundRes.allowedInbound || []);
            setOutboundEmails(outboundRes.emails || []);
            setGmailConnections(gmailRes.connections || []);
            setOutlookConnections(outlookRes.connections || []);
        } catch (err) {
            console.error("Failed to fetch email settings:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Step 1: Claim domain with DNS challenge
    const handleClaimDomain = async () => {
        if (!newDomain.trim()) return;
        setVerificationError(null);

        try {
            const res = await api.email.claimDomain(newDomain.trim());

            if (res.alreadyOwned) {
                // Domain already verified by this tenant
                alert(`Domain "${res.domain}" is already verified by your organization!`);
                fetchData();
                setNewDomain("");
            } else {
                // Show DNS verification challenge
                setDomainClaimResponse(res);
            }
        } catch (err: any) {
            console.error("Failed to claim domain:", err);
            setVerificationError(err.message || err.error || "Failed to claim domain");
        }
    };

    // Step 2: Verify DNS ownership
    const handleVerifyOwnership = async (domain: string) => {
        setVerifyingDomain(domain);
        setVerificationError(null);

        try {
            const res = await api.email.verifyDomainOwnership(domain);

            if (res.success) {
                alert(`✅ Domain ownership verified! You can now configure DKIM/SPF records.`);
                setDomainClaimResponse(null);
                setVerifyingDomain(null);
                fetchData();
            }
        } catch (err: any) {
            console.error("Failed to verify ownership:", err);
            setVerificationError(err.message || err.error || "DNS verification failed");
            setVerifyingDomain(null);
        }
    };

    // Step 3: Complete SES configuration (requires ownership)
    const handleConfigureSES = async (domain: string) => {
        try {
            const res = await api.email.createDomainIdentity(domain);
            if (res.identity) {
                setIdentities(prev => prev.map(i =>
                    i.identity_value === domain ? res.identity : i
                ));
                setDnsRecords(res.dnsRecords);
                setShowDnsRecords(true);
                alert(`✅ SES configuration updated! Add DKIM/SPF records to complete email verification.`);
            }
        } catch (err: any) {
            console.error("Failed to configure SES:", err);
            alert(err.message || err.error || "Failed to configure SES");
        }
    };

    const handleCheckStatus = async (id: string) => {
        try {
            const res = await api.email.checkIdentityStatus(id);
            if (res.identity) {
                setIdentities(prev => prev.map(i => i.id === id ? res.identity : i));
            }
        } catch (err) {
            console.error("Failed to check status:", err);
        }
    };

    const handleAddAllowedFrom = async () => {
        if (!newFromEmail.trim() || !selectedIdentity) return;
        try {
            const res = await api.email.addAllowedFrom(newFromEmail.trim(), selectedIdentity);
            if (res.allowedEmail) {
                fetchData();
                setNewFromEmail("");
            }
        } catch (err) {
            console.error("Failed to add allowed from:", err);
        }
    };

    const handleRemoveAllowedFrom = async (id: string) => {
        try {
            await api.email.removeAllowedFrom(id);
            setAllowedFrom(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Failed to remove allowed from:", err);
        }
    };

    const handleAddInbound = async () => {
        if (!newInboundEmail.trim()) return;
        try {
            const res = await api.email.addAllowedInbound(newInboundEmail.trim(), newInboundDesc);
            if (res.allowedInbound) {
                setAllowedInbound(prev => [res.allowedInbound, ...prev]);
                setNewInboundEmail("");
                setNewInboundDesc("");
            }
        } catch (err) {
            console.error("Failed to add allowed inbound:", err);
        }
    };

    const handleRemoveInbound = async (id: string) => {
        try {
            await api.email.removeAllowedInbound(id);
            setAllowedInbound(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Failed to remove allowed inbound:", err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { bg: string; text: string; icon: any }> = {
            SUCCESS: { bg: "bg-green-100", text: "text-green-700", icon: Check },
            PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", icon: Clock },
            FAILED: { bg: "bg-red-100", text: "text-red-700", icon: X },
            sent: { bg: "bg-green-100", text: "text-green-700", icon: Check },
            pending: { bg: "bg-yellow-100", text: "text-yellow-700", icon: Clock }
        };
        const s = statusMap[status] || statusMap.PENDING;
        return (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>
                <s.icon className="h-3 w-3" />
                {status}
            </span>
        );
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
                    <h2 className="text-lg font-semibold text-gray-900">Email Configuration</h2>
                    <p className="text-sm text-gray-500">Manage AWS SES domain verification and email settings</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* Gmail Connection Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("gmail")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100"
                >
                    <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Gmail Integration</span>
                        <span className="text-xs text-gray-500">({gmailConnections.length})</span>
                    </div>
                    {expandedSections.gmail ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.gmail && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">Connect your Gmail account to send and receive emails</p>
                            <button
                                onClick={async () => {
                                    try {
                                        const data = await api.gmail.authorize();
                                        if (data.authorizationUrl) {
                                            window.location.href = data.authorizationUrl;
                                        }
                                    } catch (err) {
                                        console.error("Failed to connect Gmail:", err);
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                            >
                                <Plus className="h-4 w-4" />
                                Connect Gmail
                            </button>
                        </div>

                        {gmailConnections.length > 0 ? (
                            <div className="space-y-2">
                                {gmailConnections.map((conn) => (
                                    <div key={conn.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{conn.email}</span>
                                                    {conn.is_default && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>
                                                    )}
                                                    {conn.is_active ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-400" />}
                                                </div>
                                                <p className="text-xs text-gray-500 capitalize">{conn.provider_type}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!conn.is_default && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.gmail.setDefault(conn.id);
                                                            fetchData();
                                                        } catch (err) {
                                                            console.error("Failed to set default:", err);
                                                        }
                                                    }}
                                                    className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:border-gray-400 transition"
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (confirm("Disconnect this Gmail account?")) {
                                                        try {
                                                            await api.gmail.disconnect(conn.id);
                                                            fetchData();
                                                        } catch (err) {
                                                            console.error("Failed to disconnect:", err);
                                                        }
                                                    }
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No Gmail accounts connected yet.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Outlook Integration Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("outlook")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-blue-100"
                >
                    <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-cyan-600" />
                        <span className="font-medium text-gray-900">Outlook Integration</span>
                        <span className="text-xs text-gray-500">({outlookConnections.length})</span>
                    </div>
                    {expandedSections.outlook ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.outlook && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">Connect your Outlook/Microsoft 365 account</p>
                            <button
                                onClick={async () => {
                                    try {
                                        const data = await api.outlook.authorize();
                                        if (data.authorizationUrl) window.location.href = data.authorizationUrl;
                                    } catch (err) {
                                        console.error("Failed:", err);
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition"
                            >
                                <Plus className="h-4 w-4" />
                                Connect Outlook
                            </button>
                        </div>

                        {outlookConnections.length > 0 ? (
                            <div className="space-y-2">
                                {outlookConnections.map((conn) => (
                                    <div key={conn.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-5 w-5 text-cyan-600" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{conn.email}</span>
                                                    {conn.is_default && <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">Default</span>}
                                                    {conn.is_active ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-400" />}
                                                </div>
                                                <p className="text-xs text-gray-500">Outlook</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!conn.is_default && (
                                                <button onClick={async () => { try { await api.outlook.setDefault(conn.id); fetchData(); } catch (err) { console.error(err); } }}
                                                    className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:border-gray-400 transition">
                                                    Set Default
                                                </button>
                                            )}
                                            <button onClick={async () => { if (confirm("Disconnect?")) { try { await api.outlook.disconnect(conn.id); fetchData(); } catch (err) { console.error(err); } } }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No Outlook accounts connected yet.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Domain Verification Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("domains")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100/50"
                >
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Domain Verification</span>
                        <span className="text-xs text-gray-500">({identities.length})</span>
                    </div>
                    {expandedSections.domains ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandedSections.domains && (
                    <div className="p-4 space-y-4">
                        {/* Domain Claim Form */}
                        {!domainClaimResponse && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter domain (e.g., company.com)"
                                    value={newDomain}
                                    onChange={(e) => {
                                        setNewDomain(e.target.value);
                                        setVerificationError(null);
                                    }}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <button
                                    onClick={handleClaimDomain}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                                >
                                    <Plus className="h-4 w-4" />
                                    Claim Domain
                                </button>
                            </div>
                        )}

                        {/* Verification Error */}
                        {verificationError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-900">Verification Error</p>
                                    <p className="text-xs text-red-700 mt-1">{verificationError}</p>
                                </div>
                                <button onClick={() => setVerificationError(null)} className="text-red-600 hover:text-red-800">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* DNS Ownership Verification Challenge */}
                        {domainClaimResponse && (
                            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-indigo-600" />
                                        <span className="font-semibold text-indigo-900">Step 1of 2: Verify Domain Ownership</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDomainClaimResponse(null);
                                            setNewDomain("");
                                        }}
                                        className="text-indigo-600 hover:text-indigo-800"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <p className="text-sm text-indigo-800 mb-3">
                                    To prove you own <strong>{domainClaimResponse.domain}</strong>, add this DNS TXT record:
                                </p>

                                <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500">Record Type:</span>
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{domainClaimResponse.dnsRecord.type}</code>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500">Name/Host:</span>
                                        <div className="flex items-center gap-1">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{domainClaimResponse.dnsRecord.name}</code>
                                            <button
                                                onClick={() => copyToClipboard(domainClaimResponse.dnsRecord.name)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <span className="text-xs font-medium text-gray-500">Value:</span>
                                        <div className="flex items-center gap-1 max-w-[70%]">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{domainClaimResponse.verificationToken}</code>
                                            <button
                                                onClick={() => copyToClipboard(domainClaimResponse.verificationToken)}
                                                className="text-indigo-600 hover:text-indigo-800 flex-shrink-0"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-indigo-100 rounded-lg p-3 mb-3">
                                    <p className="text-xs text-indigo-800 font-medium mb-2">Instructions:</p>
                                    <ol className="text-xs text-indigo-700 space-y-1 list-decimal list-inside">
                                        {domainClaimResponse.instructions.map((instruction, idx) => (
                                            <li key={idx}>{instruction}</li>
                                        ))}
                                    </ol>
                                    <p className="text-xs text-indigo-600 mt-2">
                                        ⏱️ DNS propagation typically takes 5-15 minutes. This verification expires on {new Date(domainClaimResponse.expiresAt).toLocaleString()}.
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleVerifyOwnership(domainClaimResponse.domain)}
                                    disabled={verifyingDomain === domainClaimResponse.domain}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {verifyingDomain === domainClaimResponse.domain ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Verifying DNS Record...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Verify Ownership
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* DNS Records Display */}
                        {showDnsRecords && dnsRecords && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-blue-600" />
                                        <span className="font-medium text-blue-900">Add these DNS records to verify your domain</span>
                                    </div>
                                    <button onClick={() => setShowDnsRecords(false)} className="text-blue-600 hover:text-blue-800">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium text-blue-900">DKIM Records (CNAME):</p>
                                    {dnsRecords.dkim.map((r, i) => (
                                        <div key={i} className="bg-white rounded p-2 flex items-center justify-between">
                                            <code className="text-xs text-gray-700 break-all">{r.name} → {r.value}</code>
                                            <button onClick={() => copyToClipboard(`${r.name} CNAME ${r.value}`)} className="text-blue-600 hover:text-blue-800 ml-2">
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <p className="font-medium text-blue-900 mt-3">SPF Record (TXT):</p>
                                    <div className="bg-white rounded p-2 flex items-center justify-between">
                                        <code className="text-xs text-gray-700">{dnsRecords.spf.name} TXT "{dnsRecords.spf.value}"</code>
                                        <button onClick={() => copyToClipboard(`${dnsRecords.spf.name} TXT "${dnsRecords.spf.value}"`)} className="text-blue-600 hover:text-blue-800 ml-2">
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Identities List */}
                        {identities.length > 0 ? (
                            <div className="space-y-2">
                                {identities.map((identity) => {
                                    const isOwned = !!identity.ownership_verified_at;
                                    const isSESConfigured = identity.verification_status && identity.verification_status !== 'PENDING';

                                    return (
                                        <div key={identity.id} className={cn(
                                            "bg-white border rounded-lg px-4 py-3",
                                            isOwned ? "border-green-200 bg-green-50/30" : "border-gray-200"
                                        )}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <Globe className={cn(
                                                        "h-5 w-5 mt-0.5",
                                                        isOwned ? "text-green-600" : "text-gray-400"
                                                    )} />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{identity.identity_value}</span>
                                                            {isOwned && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                                    <Check className="h-3 w-3" />
                                                                    Owned
                                                                </span>
                                                            )}
                                                        </div>

                                                        {isOwned && (
                                                            <div className="mt-2 space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-500">SES Verification:</span>
                                                                    {getStatusBadge(identity.verification_status)}
                                                                    <span className="text-xs text-gray-500">DKIM:</span>
                                                                    {getStatusBadge(identity.dkim_status || "PENDING")}
                                                                </div>
                                                                <p className="text-xs text-gray-500">
                                                                    Ownership verified via {identity.ownership_verification_method || 'DNS'} on {new Date(identity.ownership_verified_at!).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {!isOwned && (
                                                            <p className="text-xs text-amber-600 mt-1">
                                                                ⚠️ Ownership not verified. Domain claim required.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isOwned && !isSESConfigured && (
                                                        <button
                                                            onClick={() => handleConfigureSES(identity.identity_value)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-md transition"
                                                        >
                                                            Configure SES
                                                        </button>
                                                    )}
                                                    {isOwned && isSESConfigured && (
                                                        <button
                                                            onClick={() => handleCheckStatus(identity.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                            Check Status
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No domains configured yet. Start by claiming a domain above.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Allowed Senders Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection("senders")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100/50"
                >
                    <div className="flex items-center gap-3">
                        <Send className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-gray-900">Allowed Sender Addresses</span>
                        <span className="text-xs text-gray-500">({allowedFrom.length})</span>
                    </div>
                    {expandedSections.senders ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {
                    expandedSections.senders && (
                        <div className="p-4 space-y-4">
                            {/* Add Sender Form */}
                            <div className="flex gap-2">
                                <select
                                    value={selectedIdentity}
                                    onChange={(e) => setSelectedIdentity(e.target.value)}
                                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">Select Domain</option>
                                    {identities.map((i) => (
                                        <option key={i.id} value={i.id}>{i.identity_value}</option>
                                    ))}
                                </select>
                                <input
                                    type="email"
                                    placeholder="support@domain.com"
                                    value={newFromEmail}
                                    onChange={(e) => setNewFromEmail(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <button
                                    onClick={handleAddAllowedFrom}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>

                            {/* Allowed From List */}
                            {allowedFrom.length > 0 ? (
                                <div className="space-y-2">
                                    {allowedFrom.map((email) => (
                                        <div key={email.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Mail className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <span className="font-medium text-gray-900">{email.email_address}</span>
                                                    {email.is_default && (
                                                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>
                                                    )}
                                                    <p className="text-xs text-gray-500">{email.domain}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveAllowedFrom(email.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No sender addresses configured yet.</p>
                            )}
                        </div>
                    )
                }
            </div >

            {/* Allowed Inbound Section */}
            < div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" >
                <button
                    onClick={() => toggleSection("inbound")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100/50"
                >
                    <div className="flex items-center gap-3">
                        <Inbox className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Allowed Inbound Addresses</span>
                        <span className="text-xs text-gray-500">({allowedInbound.length})</span>
                    </div>
                    {expandedSections.inbound ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {
                    expandedSections.inbound && (
                        <div className="p-4 space-y-4">
                            {/* Add Inbound Form */}
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="support@your-domain.com"
                                    value={newInboundEmail}
                                    onChange={(e) => setNewInboundEmail(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Description (optional)"
                                    value={newInboundDesc}
                                    onChange={(e) => setNewInboundDesc(e.target.value)}
                                    className="w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <button
                                    onClick={handleAddInbound}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>

                            {/* Allowed Inbound List */}
                            {allowedInbound.length > 0 ? (
                                <div className="space-y-2">
                                    {allowedInbound.map((email) => (
                                        <div key={email.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Inbox className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <span className="font-medium text-gray-900">{email.email_address}</span>
                                                    {email.description && (
                                                        <p className="text-xs text-gray-500">{email.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveInbound(email.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No inbound addresses configured yet.</p>
                            )}
                        </div>
                    )
                }
            </div >

            {/* Outbound History Section */}
            < div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" >
                <button
                    onClick={() => toggleSection("history")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100/50"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <span className="font-medium text-gray-900">Outbound Email History</span>
                        <span className="text-xs text-gray-500">({outboundEmails.length})</span>
                    </div>
                    {expandedSections.history ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {
                    expandedSections.history && (
                        <div className="p-4">
                            {outboundEmails.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                                            <tr>
                                                <th className="pb-2">To</th>
                                                <th className="pb-2">From</th>
                                                <th className="pb-2">Subject</th>
                                                <th className="pb-2">Status</th>
                                                <th className="pb-2">Sent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {outboundEmails.map((email) => (
                                                <tr key={email.id}>
                                                    <td className="py-2 text-gray-900">{email.to_email}</td>
                                                    <td className="py-2 text-gray-600">{email.from_email}</td>
                                                    <td className="py-2 text-gray-600 truncate max-w-[200px]">{email.subject}</td>
                                                    <td className="py-2">{getStatusBadge(email.status)}</td>
                                                    <td className="py-2 text-gray-500 text-xs">
                                                        {email.sent_at ? new Date(email.sent_at).toLocaleString() : "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No emails sent yet.</p>
                            )}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
