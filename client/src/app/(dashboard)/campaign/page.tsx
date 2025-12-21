'use client';

import { useState, useEffect } from 'react';
import {
    Send, Mail, MessageCircle, Clock, GitBranch, Users, Target,
    CheckCircle, ArrowRight, Sparkles, Plus, Timer, Filter,
    BarChart3, Zap, ArrowDown
} from 'lucide-react';

export default function CampaignPage() {
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep(prev => (prev + 1) % 5);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-8">
                        {/* Header */}
                        <div className="text-center mb-12">
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-full mb-6">
                                <Sparkles className="w-4 h-4" />
                                Coming Soon
                            </span>
                            <h1 className="text-4xl font-bold text-black mb-4">Campaign Automation</h1>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                                Create powerful email and WhatsApp campaigns with automated sequences,
                                smart conditions, and complete lead tracking.
                            </p>
                        </div>

                        {/* Visual Workflow */}
                        <div className="bg-white rounded-3xl border border-gray-200 p-8 mb-12 shadow-sm">
                            <h2 className="text-lg font-semibold text-black mb-8 text-center">How It Works</h2>

                            {/* Campaign Flow Visualization */}
                            <div className="flex flex-col items-center gap-4">
                                {/* Step 1: Create Campaign */}
                                <WorkflowStep
                                    active={activeStep === 0}
                                    icon={Plus}
                                    title="Create Campaign"
                                    description="Choose email or WhatsApp campaign type"
                                />

                                <AnimatedArrow active={activeStep === 0} />

                                {/* Step 2: Send Initial Message */}
                                <WorkflowStep
                                    active={activeStep === 1}
                                    icon={Send}
                                    title="Send Initial Message"
                                    description="Craft your outreach with personalization"
                                />

                                <AnimatedArrow active={activeStep === 1} />

                                {/* Step 3: Wait Period */}
                                <WorkflowStep
                                    active={activeStep === 2}
                                    icon={Timer}
                                    title="Wait Period"
                                    description="Set delay: 2 days, 1 week, custom..."
                                />

                                <AnimatedArrow active={activeStep === 2} />

                                {/* Step 4: Condition Check */}
                                <div className={`relative transition-all duration-500 ${activeStep === 3 ? 'scale-105' : ''}`}>
                                    <div className={`bg-gray-50 rounded-2xl p-6 border-2 transition-all duration-300 ${activeStep === 3 ? 'border-black shadow-lg' : 'border-gray-200'
                                        }`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeStep === 3 ? 'bg-black' : 'bg-gray-200'
                                                }`}>
                                                <GitBranch className={`w-5 h-5 ${activeStep === 3 ? 'text-white' : 'text-gray-500'}`} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-black">Check Response</h3>
                                                <p className="text-xs text-gray-500">Did they respond?</p>
                                            </div>
                                        </div>

                                        {/* Branching Paths */}
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-700">Yes</span>
                                                </div>
                                                <p className="text-xs text-green-600">Add to leads pipeline</p>
                                            </div>
                                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock className="w-4 h-4 text-orange-600" />
                                                    <span className="text-sm font-medium text-orange-700">No</span>
                                                </div>
                                                <p className="text-xs text-orange-600">Send follow-up offer</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <AnimatedArrow active={activeStep === 3} />

                                {/* Step 5: Track & Analyze */}
                                <WorkflowStep
                                    active={activeStep === 4}
                                    icon={BarChart3}
                                    title="Track & Analyze"
                                    description="Monitor lead stages and campaign performance"
                                />
                            </div>
                        </div>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            <FeatureCard
                                icon={Mail}
                                title="Email Campaigns"
                                description="Cold outreach, newsletters, promotional emails with full sequence automation"
                            />
                            <FeatureCard
                                icon={MessageCircle}
                                title="WhatsApp Campaigns"
                                description="Direct messaging campaigns with template support and delivery tracking"
                            />
                            <FeatureCard
                                icon={Target}
                                title="Lead Tracking"
                                description="Automatic lead stage updates based on campaign responses and engagement"
                            />
                        </div>

                        {/* Use Cases */}
                        <div className="bg-black rounded-3xl p-8 text-white">
                            <h2 className="text-xl font-semibold mb-6 text-center">Campaign Use Cases</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <UseCaseCard title="Cold Outreach" description="Reach new prospects with personalized sequences" />
                                <UseCaseCard title="Deal Offers" description="Send promotional offers to segmented contacts" />
                                <UseCaseCard title="Re-engagement" description="Win back inactive leads with targeted campaigns" />
                                <UseCaseCard title="Onboarding" description="Automate welcome sequences for new customers" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function WorkflowStep({ active, icon: Icon, title, description }: {
    active: boolean;
    icon: any;
    title: string;
    description: string;
}) {
    return (
        <div className={`transition-all duration-500 ${active ? 'scale-105' : ''}`}>
            <div className={`bg-gray-50 rounded-2xl p-6 border-2 flex items-center gap-4 min-w-[350px] transition-all duration-300 ${active ? 'border-black shadow-lg' : 'border-gray-200'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${active ? 'bg-black' : 'bg-gray-200'}`}>
                    <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                    <h3 className="font-semibold text-black">{title}</h3>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>
        </div>
    );
}

function AnimatedArrow({ active }: { active: boolean }) {
    return (
        <div className={`transition-all duration-300 ${active ? 'text-black' : 'text-gray-300'}`}>
            <ArrowDown className="w-6 h-6" />
        </div>
    );
}

function FeatureCard({ icon: Icon, title, description }: {
    icon: any;
    title: string;
    description: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-black mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
    );
}

function UseCaseCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="bg-white/10 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}
