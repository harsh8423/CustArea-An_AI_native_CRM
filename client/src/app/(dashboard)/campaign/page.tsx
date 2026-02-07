'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail, Users, Sparkles, ArrowRight, ArrowLeft, CheckCircle,
    Target, Globe, Zap, Send, Plus, X, Settings, Brain,
    Clock, Filter, BarChart3, Play, Pause, Edit, Trash2,
    RefreshCw, Eye, TrendingUp, UserCheck, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { campaignApi } from '@/lib/campaignApi';
import { api } from '@/lib/api';
import { RBACPageIndicator } from '@/components/shared/RBACPageIndicator';

interface ContactGroup {
    id: string;
    name: string;
    description?: string;
    contact_count: number;
}

interface EmailConnection {
    id: string;
    email: string;
    provider: string;
    is_active: boolean;
    type: 'connection' | 'identity'; // Gmail/Outlook connection or SES identity
}

export default function CampaignPage() {
    const router = useRouter();
    const [activeView, setActiveView] = useState<'list' | 'create'>('list');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'active' | 'paused' | 'completed'>('all');

    useEffect(() => {
        if (activeView === 'list') {
            fetchCampaigns();
        }
    }, [activeView, filterStatus]);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const params = filterStatus !== 'all' ? { status: filterStatus } : {};
            const res = await campaignApi.list(params);
            setCampaigns(res.campaigns || []);
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCampaignCreated = () => {
        setActiveView('list');
        fetchCampaigns();
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return;
        try {
            await campaignApi.delete(id);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to delete campaign:', error);
            alert('Failed to delete campaign');
        }
    };

    const handleLaunchCampaign = async (id: string) => {
        try {
            await campaignApi.launch(id);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to launch campaign:', error);
            alert('Failed to launch campaign');
        }
    };

    const handlePauseCampaign = async (id: string) => {
        try {
            await campaignApi.pause(id);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to pause campaign:', error);
        }
    };

    const handleResumeCampaign = async (id: string) => {
        try {
            await campaignApi.resume(id);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to resume campaign:', error);
        }
    };

    const filteredCampaigns = campaigns;

    return (
        <div className="h-full flex flex-col bg-[#eff0eb] p-4">
            <div className="flex-1 bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                {activeView === 'list' ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Create and manage your outreach campaigns
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveView('create')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 transition shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="font-medium">Create Campaign</span>
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2 mt-4">
                                {(['all', 'draft', 'active', 'paused', 'completed'] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition",
                                            filterStatus === status
                                                ? "bg-blue-50 text-blue-600"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* RBAC Indicator */}
                            <div className="mt-4">
                                <RBACPageIndicator
                                    resourceName="Campaigns"
                                    filterDescription="You're seeing campaigns you created or that use contact groups assigned to you."
                                />
                            </div>
                        </div>

                        {/* Campaigns List */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <RefreshCw className="h-8 w-8 text-gray-300 animate-spin" />
                                </div>
                            ) : filteredCampaigns.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                        <Mail className="h-8 w-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No campaigns yet</h3>
                                    <p className="text-sm text-gray-400 mb-4">Create your first campaign to get started</p>
                                    <button
                                        onClick={() => setActiveView('create')}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Campaign
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredCampaigns.map((campaign) => (
                                        <CampaignCard
                                            key={campaign.id}
                                            campaign={campaign}
                                            onLaunch={() => handleLaunchCampaign(campaign.id)}
                                            onPause={() => handlePauseCampaign(campaign.id)}
                                            onResume={() => handleResumeCampaign(campaign.id)}
                                            onDelete={() => handleDeleteCampaign(campaign.id)}
                                            onView={() => router.push(`/campaign/${campaign.id}`)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <CampaignWizard
                        onBack={() => setActiveView('list')}
                        onComplete={handleCampaignCreated}
                    />
                )}
            </div>
        </div>
    );
}

function CampaignCard({ campaign, onLaunch, onPause, onResume, onDelete, onView }: any) {
    const statusColors = {
        draft: 'bg-gray-100 text-gray-600',
        active: 'bg-green-50 text-green-600',
        paused: 'bg-amber-50 text-amber-600',
        completed: 'bg-blue-50 text-blue-600'
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{campaign.name}</h3>
                    <p className="text-xs text-gray-500">{campaign.company_name}</p>
                </div>
                <span className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium",
                    statusColors[campaign.status as keyof typeof statusColors] || statusColors.draft
                )}>
                    {campaign.status}
                </span>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Target className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">{campaign.campaign_objective}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users className="h-3.5 w-3.5" />
                    <span>Max {campaign.max_contacts_limit} contacts</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Send className="h-3.5 w-3.5" />
                    <span>{campaign.daily_send_limit}/day limit</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onView}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition text-xs font-medium"
                >
                    <Eye className="h-3.5 w-3.5" />
                    View
                </button>
                {campaign.status === 'draft' && (
                    <button
                        onClick={onLaunch}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-xs font-medium"
                    >
                        <Play className="h-3.5 w-3.5" />
                        Launch
                    </button>
                )}
                {campaign.status === 'active' && (
                    <button
                        onClick={onPause}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition text-xs font-medium"
                    >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                    </button>
                )}
                {campaign.status === 'paused' && (
                    <button
                        onClick={onResume}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-xs font-medium"
                    >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                    </button>
                )}
                <button
                    onClick={onDelete}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function CampaignWizard({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        website_url: '',
        campaign_objective: '',
        selling_points: '',
        pain_points: '',
        value_proposition: '',
        proof_points: '',
        contact_group_id: '',
        reply_handling: 'human' as 'human' | 'ai',
        ai_instructions: '',
        language: 'English',
        daily_send_limit: 200,
        max_contacts_limit: 500,
        email_connection_ids: [] as string[]
    });

    const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
    const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);

    useEffect(() => {
        fetchContactGroups();
        fetchEmailConnections();
    }, []);

    const fetchContactGroups = async () => {
        try {
            const res = await api.contactGroups.list();
            setContactGroups(res.groups || []);
        } catch (error) {
            console.error('Failed to fetch contact groups:', error);
        }
    };

    const fetchEmailConnections = async () => {
        try {
            const res = await api.conversationEmail.getSenderAddresses();
            const addresses = res.senderAddresses || [];
            // Map ALL email addresses and include type (connection or identity)
            setEmailConnections(addresses.map((addr: any) => ({
                id: addr.connectionId || addr.identityId,
                email: addr.email,
                provider: addr.provider || 'email',
                is_active: true,
                type: addr.connectionId ? 'connection' : 'identity' // Determine type
            })));
        } catch (error) {
            console.error('Failed to fetch email connections:', error);
        }
    };

    const handleNext = async () => {
        if (step < 5) {
            // Simply move to next step - campaign creation happens at step 5
            setStep(step + 1);
        }
    };
    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const canProceed = (currentStep: number, data: typeof formData) => {
        switch (currentStep) {
            case 1:
                return data.name && data.company_name && data.campaign_objective;
            case 2:
                return data.selling_points && data.pain_points && data.value_proposition;
            case 3:
                return data.contact_group_id && data.email_connection_ids.length > 0;
            case 4:
                return true; // Step 4 is always valid as all fields are optional
            default:
                return false;
        }
    };

    const handleCompleteWizard = async () => {
        if (templates.length === 0) {
            alert('Please generate templates before completing.');
            return;
        }

        setLoading(true);
        try {
            // Create campaign
            const campaignRes = await campaignApi.create(formData);
            const newCampaignId = campaignRes.campaign.id;

            // Set email rotation
            if (formData.email_connection_ids.length > 0) {
                const emailConnectionsWithType = formData.email_connection_ids.map(id => {
                    const connection = emailConnections.find(c => c.id === id);
                    return {
                        id,
                        type: connection?.type || 'connection'
                    };
                });
                await campaignApi.setEmailRotation(newCampaignId, emailConnectionsWithType);
            }

            // Save AI-generated templates to campaign
            for (const template of templates) {
                await campaignApi.createTemplate(newCampaignId, template);
            }

            alert('Campaign created successfully! You can now launch it to start sending emails.');
            onComplete();
        } catch (error) {
            console.error('Failed to create campaign:', error);
            alert('Failed to create campaign. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    return (
        <div className="h-full flex flex-col">
            {/* Progress Bar */}
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Campaigns
                    </button>
                    <span className="text-sm text-gray-500">Step {step} of {totalSteps}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                {step === 1 && (
                    <Step1BasicInfo formData={formData} setFormData={setFormData} />
                )}
                {step === 2 && (
                    <Step2CampaignDetails formData={formData} setFormData={setFormData} />
                )}
                {step === 3 && (
                    <Step3Targeting
                        formData={formData}
                        setFormData={setFormData}
                        contactGroups={contactGroups}
                        emailConnections={emailConnections}
                    />
                )}
                {step === 4 && (
                    <Step4AISettings formData={formData} setFormData={setFormData} />
                )}
                {step === 5 && (
                    <Step5TemplateEditor
                        formData={formData}
                        templates={templates}
                        setTemplates={setTemplates}
                        generating={generating}
                        setGenerating={setGenerating}
                    />
                )}
            </div>

            {/* Navigation - Always Visible */}
            <div className="flex-shrink-0 p-6 border-t border-gray-100 flex items-center justify-between bg-white">
                <button
                    onClick={handleBack}
                    disabled={step === 1}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                </button>
                {step < totalSteps ? (
                    <button
                        onClick={handleNext}
                        disabled={!canProceed(step, formData)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm font-medium"
                    >
                        Next
                        <ArrowRight className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                        onClick={handleCompleteWizard}
                        disabled={loading || generating || templates.length === 0}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm font-medium"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                {generating ? 'Generating Templates...' : 'Creating Campaign...'}
                            </>
                        ) : (
                            <>
                                Complete
                                <CheckCircle className="h-4 w-4" />
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

function Step1BasicInfo({ formData, setFormData }: any) {
    return (
        <div className="max-w-2xl mx-auto space-y-6 py-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Basics</h2>
                <p className="text-gray-500">Let's start with the essentials</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campaign Name *
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Q1 2024 Outreach"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Company Name *
                    </label>
                    <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="e.g., Acme Inc"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website URL (Optional)
                    </label>
                    <input
                        type="url"
                        value={formData.website_url}
                        onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campaign Objective *
                    </label>
                    <textarea
                        value={formData.campaign_objective}
                        onChange={(e) => setFormData({ ...formData, campaign_objective: e.target.value })}
                        placeholder="e.g., Generate qualified demo bookings for our new SaaS product"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                    />
                </div>
            </div>
        </div>
    );
}

function Step2CampaignDetails({ formData, setFormData }: any) {
    return (
        <div className="max-w-2xl mx-auto space-y-6 py-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Messaging</h2>
                <p className="text-gray-500">Help our AI understand what you're selling</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        What are you selling? *
                    </label>
                    <textarea
                        value={formData.selling_points}
                        onChange={(e) => setFormData({ ...formData, selling_points: e.target.value })}
                        placeholder="e.g., AI-powered CRM that automates lead follow-up and increases conversion rates by 40%"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        What pain points do you solve? *
                    </label>
                    <textarea
                        value={formData.pain_points}
                        onChange={(e) => setFormData({ ...formData, pain_points: e.target.value })}
                        placeholder="e.g., Manual follow-ups, leads falling through cracks, inconsistent outreach"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your value proposition *
                    </label>
                    <textarea
                        value={formData.value_proposition}
                        onChange={(e) => setFormData({ ...formData, value_proposition: e.target.value })}
                        placeholder="e.g., Close more deals with less effort using AI that never forgets to follow up"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Proof points (Optional)
                    </label>
                    <textarea
                        value={formData.proof_points}
                        onChange={(e) => setFormData({ ...formData, proof_points: e.target.value })}
                        placeholder="e.g., 500+ customers, 40% average conversion increase, Featured in TechCrunch"
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                    />
                </div>
            </div>
        </div>
    );
}

function Step3Targeting({ formData, setFormData, contactGroups, emailConnections }: any) {
    return (
        <div className="max-w-2xl mx-auto space-y-6 py-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Targeting & Sending</h2>
                <p className="text-gray-500">Choose your audience and sending emails</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Group *
                    </label>
                    <select
                        value={formData.contact_group_id}
                        onChange={(e) => setFormData({ ...formData, contact_group_id: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    >
                        <option value="">Select a contact group...</option>
                        {contactGroups.map((group: ContactGroup) => (
                            <option key={group.id} value={group.id}>
                                {group.name} ({group.contact_count} contacts)
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1.5">
                        Maximum 500 contacts will be enrolled from this group
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Sending Email(s) * {formData.email_connection_ids.length > 1 && '(Rotation enabled)'}
                    </label>
                    {emailConnections.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-sm text-amber-800">
                                No email accounts connected. Please connect an email account in Settings to create campaigns.
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                Supports Gmail, Outlook, and SES email accounts.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {emailConnections.map((connection: EmailConnection) => (
                                <label
                                    key={connection.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 cursor-pointer transition"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.email_connection_ids.includes(connection.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({
                                                    ...formData,
                                                    email_connection_ids: [...formData.email_connection_ids, connection.id]
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    email_connection_ids: formData.email_connection_ids.filter((id: string) => id !== connection.id)
                                                });
                                            }
                                        }}
                                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">{connection.email}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1.5">
                        {formData.email_connection_ids.length > 1
                            ? 'Emails will be rotated evenly across selected addresses'
                            : 'Select one or more email addresses to send from'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Daily Send Limit
                        </label>
                        <input
                            type="number"
                            value={formData.daily_send_limit}
                            onChange={(e) => setFormData({ ...formData, daily_send_limit: parseInt(e.target.value) })}
                            min={1}
                            max={200}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                        />
                        <p className="text-xs text-gray-500 mt-1">Max 200/day</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Contacts
                        </label>
                        <input
                            type="number"
                            value={formData.max_contacts_limit}
                            onChange={(e) => setFormData({ ...formData, max_contacts_limit: parseInt(e.target.value) })}
                            min={1}
                            max={500}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                        />
                        <p className="text-xs text-gray-500 mt-1">Max 500 total</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Step4AISettings({ formData, setFormData }: any) {
    return (
        <div className="max-w-2xl mx-auto space-y-6 py-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">AI & Automation</h2>
                <p className="text-gray-500">Configure how replies are handled</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Reply Handling
                    </label>
                    <div className="space-y-3">
                        <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition">
                            <input
                                type="radio"
                                name="reply_handling"
                                value="human"
                                checked={formData.reply_handling === 'human'}
                                onChange={(e) => setFormData({ ...formData, reply_handling: e.target.value })}
                                className="mt-1 h-4 w-4 text-blue-600"
                            />
                            <div>
                                <div className="font-medium text-gray-900">Human Review</div>
                                <p className="text-sm text-gray-500">Replies appear in your inbox for manual response</p>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition">
                            <input
                                type="radio"
                                name="reply_handling"
                                value="ai"
                                checked={formData.reply_handling === 'ai'}
                                onChange={(e) => setFormData({ ...formData, reply_handling: e.target.value })}
                                className="mt-1 h-4 w-4 text-blue-600"
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">AI Agent</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-medium rounded">Recommended</span>
                                </div>
                                <p className="text-sm text-gray-500">AI responds automatically using campaign context</p>
                            </div>
                        </label>
                    </div>
                </div>

                {formData.reply_handling === 'ai' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Additional AI Instructions (Optional)
                        </label>
                        <textarea
                            value={formData.ai_instructions}
                            onChange={(e) => setFormData({ ...formData, ai_instructions: e.target.value })}
                            placeholder="e.g., Always offer a demo in the first reply. If they mention pricing, direct them to our website."
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                            Provide specific instructions for the AI agent when responding to replies
                        </p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Language
                    </label>
                    <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                        <option value="Portuguese">Portuguese</option>
                    </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-900 mb-1">AI Templates will be generated</h4>
                            <p className="text-sm text-blue-700">
                                We'll automatically create personalized email templates (initial + 2 follow-ups) based on your campaign details.
                                You can edit them before launching.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Step 5: Template Editor
function Step5TemplateEditor({
    formData,
    templates,
    setTemplates,
    generating,
    setGenerating
}: {
    formData: any;
    templates: any[];
    setTemplates: (templates: any[]) => void;
    generating: boolean;
    setGenerating: (generating: boolean) => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editSubject, setEditSubject] = useState('');
    const [editBody, setEditBody] = useState('');
    const [editWaitValue, setEditWaitValue] = useState<number>(3);
    const [editWaitUnit, setEditWaitUnit] = useState<string>('days');
    const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
    const [newFollowUpValue, setNewFollowUpValue] = useState<number>(3);
    const [newFollowUpUnit, setNewFollowUpUnit] = useState<string>('days');

    const handleGenerateTemplates = async () => {
        setGenerating(true);
        try {
            const response = await campaignApi.generateTemplatesPreview(formData, 2);
            console.log('Template response:', response); // Debug log

            // Ensure we have an array of templates
            const templatesArray = Array.isArray(response.templates)
                ? response.templates
                : (response.templates ? [response.templates] : []);

            setTemplates(templatesArray);

            if (templatesArray.length === 0) {
                alert('No templates were generated. Please try again.');
            }
        } catch (error) {
            console.error('Failed to generate templates:', error);
            alert('Failed to generate templates: ' + ((error as Error).message || 'Unknown error'));
        } finally {
            setGenerating(false);
        }
    };

    // Show generate button if templates not yet generated
    if (templates.length === 0) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <div className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                    <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate AI Email Templates</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Our AI will create personalized email sequences based on your campaign details.
                    </p>
                    <button
                        onClick={handleGenerateTemplates}
                        disabled={generating}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition shadow-md font-medium mx-auto"
                    >
                        {generating ? (
                            <>
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                Generating Templates...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                Generate Templates
                            </>
                        )}
                    </button>
                    <div className="text-xs text-gray-500 mt-6">
                        <p className="font-medium mb-2">We'll create:</p>
                        <ul className="space-y-1">
                            <li>• Initial outreach email</li>
                            <li>• 2 follow-up emails with smart timing</li>
                            <li>• Personalized content based on your inputs</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    const handleEditTemplate = (template: any) => {
        setEditingId(template.id);
        setEditSubject(template.subject);
        setEditBody(template.body_html);
        setEditWaitValue(template.wait_period_value || 3);
        setEditWaitUnit(template.wait_period_unit || 'days');
    };

    const handleSaveEdit = () => {
        if (!editingId) return;
        // Update template in local state
        setTemplates(templates.map(t =>
            t.id === editingId
                ? { ...t, subject: editSubject, body_html: editBody, wait_period_value: editWaitValue, wait_period_unit: editWaitUnit }
                : t
        ));
        setEditingId(null);
        setEditSubject('');
        setEditBody('');
    };

    const handleAddFollowUp = () => {
        // Add follow-up to local state
        const newTemplate = {
            id: `temp-${Date.now()}`,
            template_type: 'follow_up',
            subject: 'Follow-up',
            body_html: '<p>Follow-up email</p>',
            wait_period_value: newFollowUpValue,
            wait_period_unit: newFollowUpUnit
        };
        setTemplates([...templates, newTemplate]);
        setShowAddFollowUpModal(false);
        setNewFollowUpValue(3);
        setNewFollowUpUnit('days');
    };

    const handleDeleteTemplate = (templateId: string) => {
        if (!confirm('Delete this template?')) return;
        setTemplates(templates.filter(t => t.id !== templateId));
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Templates</h3>
                <p className="text-sm text-gray-600">
                    Generate AI templates or create your own. Add follow-ups with custom timing.
                </p>
            </div>

            {templates.length === 0 ? (
                <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h4>
                    <p className="text-sm text-gray-600 mb-6">Generate AI templates based on campaign details</p>
                    <button
                        onClick={handleGenerateTemplates}
                        disabled={generating}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {generating ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                Generate AI Templates
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {templates.map((template, index) => (
                        <div key={template.id} className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold",
                                        template.template_type === 'initial' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                    )}>{index + 1}</div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            {template.template_type === 'initial' ? 'Initial Email' : `Follow-up ${index}`}
                                        </h4>
                                        {template.template_type === 'follow_up' && (
                                            <p className="text-xs text-gray-500">
                                                Send {template.wait_period_value || 3} {template.wait_period_unit || 'days'} after previous
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditTemplate(template)} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                                        <Edit className="h-4 w-4" />
                                    </button>
                                    {template.template_type === 'follow_up' && (
                                        <button onClick={() => handleDeleteTemplate(template.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {editingId === template.id ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                                        <input
                                            type="text"
                                            value={editSubject}
                                            onChange={(e) => setEditSubject(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
                                        <textarea
                                            value={editBody}
                                            onChange={(e) => setEditBody(e.target.value)}
                                            rows={10}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                        />
                                    </div>
                                    {template.template_type === 'follow_up' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Send after (days)
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={editWaitUnit === 'minutes' ? 43200 : editWaitUnit === 'hours' ? 720 : 30}
                                                        value={editWaitValue}
                                                        onChange={(e) => setEditWaitValue(parseInt(e.target.value) || 1)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        placeholder="e.g., 3"
                                                    />
                                                </div>
                                                <select
                                                    value={editWaitUnit}
                                                    onChange={(e) => setEditWaitUnit(e.target.value)}
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                >
                                                    <option value="minutes">Minutes</option>
                                                    <option value="hours">Hours</option>
                                                    <option value="days">Days</option>
                                                </select>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Wait time after previous email (1 minute to 30 days)
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                            Save Changes
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-medium text-gray-900 mb-2">{template.subject}</p>
                                    <div className="text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: template.body_html }} />
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={() => setShowAddFollowUpModal(true)}
                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Add Follow-up Email
                    </button>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                            <h5 className="font-medium text-amber-900 mb-1">Template Variables</h5>
                            <p className="text-sm text-amber-700">
                                Use <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">{'{{name}}'}</code> and <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">{'{{company}}'}</code>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Follow-up Modal */}
            {showAddFollowUpModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Follow-up Email</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Wait Time
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            min="1"
                                            max={newFollowUpUnit === 'minutes' ? 43200 : newFollowUpUnit === 'hours' ? 720 : 30}
                                            value={newFollowUpValue}
                                            onChange={(e) => setNewFollowUpValue(parseInt(e.target.value) || 1)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="e.g., 3"
                                        />
                                    </div>
                                    <select
                                        value={newFollowUpUnit}
                                        onChange={(e) => setNewFollowUpUnit(e.target.value)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                        <option value="minutes">Minutes</option>
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">
                                    Wait time after the previous email (1 minute to 30 days)
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddFollowUpModal(false);
                                    setNewFollowUpValue(3);
                                    setNewFollowUpUnit('days');
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddFollowUp}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                Add Follow-up
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
