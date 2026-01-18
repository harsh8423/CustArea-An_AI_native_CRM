'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function Features() {
    const features = [
        {
            question: "Why worry about off-hours leads and support at all?",
            title: "AI Agent",
            intro: "Customers message whenever they want. Your business shouldn't stop when your team does.",
            image: "/features/aiagent.png",
            items: [
                "24/7 sales and support on demand",
                "One AI agent across all channels",
                "Context-aware replies with smart escalation"
            ],
            bg: "bg-slate-50"
        },
        {
            question: "Why can't your tools adapt to your process?",
            title: "Workflow Engine",
            intro: "Your processes are unique. Your automation should be too.",
            image: "/features/workflowengine.png",
            items: [
                "Fully customizable workflows",
                "Intelligent message routing",
                "AI + rules working together"
            ],
            bg: "bg-white"
        },
        {
            question: "What happens when customers call and no one picks up?",
            title: "Voice Agent",
            intro: "Calls don't wait. Customers don't retry forever.",
            image: "/features/voiceagent.png",
            items: [
                "AI-powered call handling",
                "Live understanding, not IVRs",
                "Seamless human handoff"
            ],
            bg: "bg-slate-50"
        },
        {
            question: "Why do campaigns stop working after the first message?",
            title: "AI Campaign Manager",
            intro: "Sending messages is easy. Following up properly isn't.",
            image: "/features/campaign.png",
            items: [
                "AI-managed outreach and follow-ups",
                "Automatic intent detection",
                "Qualified leads surfaced, not buried"
            ],
            bg: "bg-white"
        },
        {
            question: "Why doesn't your sales pipeline update itself?",
            title: "Sales Pipeline Handling",
            intro: "Sales pipelines shouldn't rely on memory and manual updates.",
            image: "/features/salespipeline.png",
            items: [
                "Conversation-driven lead movement",
                "Automatic assignment and follow-ups",
                "Clear visibility without manual work"
            ],
            bg: "bg-slate-50"
        },
        {
            question: "Why are customer conversations scattered everywhere?",
            title: "Omnichannel Inbox",
            intro: "Switching tools kills focus. Context gets lost. Responses get delayed.",
            image: "/features/inbox.png",
            items: [
                "Unified customer view",
                "Faster response times",
                "No tab-hopping or missed messages"
            ],
            bg: "bg-white"
        },
        {
            question: "Why do customer issues get lost?",
            title: "Ticketing System",
            intro: "Not every conversation is a ticket. But every ticket should be handled properly.",
            image: "/features/ticket.png",
            items: [
                "Auto-created tickets from conversations",
                "Clear ownership and status",
                "Faster resolutions with full context"
            ],
            bg: "bg-slate-50"
        }
    ];

    return (
        <section className="relative" id="features">

            {/* Header Section - Normal Scroll */}
            <div className="py-16 sm:py-20 md:py-32 bg-white text-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                {/* Glowing backdrop */}
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-[#1E4A8D]/10 to-[#2563eb]/5 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#D4AF37]/15 to-[#C9A227]/10 rounded-full blur-3xl animate-pulse-glow opacity-60" />
                <div className="absolute top-1/3 right-1/3 w-[550px] h-[550px] bg-gradient-to-br from-[#D4AF37]/12 to-transparent rounded-full blur-3xl animate-float-delayed opacity-55" />

                <div className="max-w-3xl mx-auto relative z-10">
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] sm:text-xs tracking-widest uppercase mb-3 md:mb-4 border border-blue-100">
                        Powerful Features
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-['Outfit'] font-bold mb-4 sm:mb-6 leading-tight text-slate-900">
                        Everything to <span className="text-gradient">win customers</span>
                    </h2>
                    <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 font-['Inter'] leading-relaxed max-w-2xl mx-auto">
                        A complete platform combining AI intelligence, omni-channel communication,
                        and powerful automation tools.
                    </p>
                </div>

            </div>

            {/* Full Page Stacking Features */}
            <div className="relative space-y-4">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className={`sticky top-8 min-h-[85vh] flex items-center justify-center overflow-hidden ${feature.bg} rounded-3xl mx-4 shadow-lg border border-slate-200/50`}
                        style={{
                            zIndex: index + 1,
                        }}
                    >
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 w-full py-8 sm:py-12 md:py-16">
                            {/* Question Header - Full Width */}
                            <div className="mb-4 sm:mb-6 lg:mb-8 text-center lg:text-left">
                                <div className="mb-2">
                                    <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-blue-600">
                                        {feature.title}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-['Outfit'] font-bold text-slate-900 leading-tight">
                                    {feature.question}
                                </h3>
                            </div>

                            {/* Content and Image Grid */}
                            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">

                                {/* Image Side - Now on Left */}
                                <div className="order-1 flex justify-center items-center">
                                    <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg aspect-[4/3] flex items-center justify-center">
                                        {/* Simple shadow/glow behind image */}
                                        <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full transform scale-75" />
                                        <img
                                            src={feature.image}
                                            alt={feature.title}
                                            className="relative w-full h-full object-contain drop-shadow-2xl"
                                        />
                                    </div>
                                </div>

                                {/* Content Side - Now on Right */}
                                <div className="order-2">
                                    {/* Intro Text */}
                                    <p className="text-base sm:text-lg md:text-xl font-['Inter'] font-medium text-slate-800 mb-4 sm:mb-6 leading-relaxed">
                                        {feature.intro}
                                    </p>

                                    {/* Mini Cards Grid */}
                                    <div className="grid gap-3 sm:gap-4">
                                        {feature.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                                                        <svg
                                                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2.5}
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm sm:text-base font-['Inter'] text-slate-700 leading-relaxed flex-1">
                                                        {item}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
