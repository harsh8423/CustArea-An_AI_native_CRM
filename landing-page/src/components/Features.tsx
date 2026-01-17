'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function Features() {
    const features = [
        {
            question: "Why worry about off-hours leads and support at all?",
            title: "AI Agent (Off-Hours + On-Demand Coverage)",
            image: "/features/aiagent.png",
            content: {
                intro: "Customers message whenever they want. Your business shouldn't stop when your team does.",
                description: "CustArea's AI Agent handles sales and support across all channels whenever your team is unavailable or busy. It responds instantly, understands context, and keeps conversations moving."
            },
            bg: "bg-slate-50"
        },
        {
            question: "Why should every business work the same way?",
            title: "Workflow Engine (Custom Logic & Operations)",
            image: "/features/workflowengine.png",
            content: {
                intro: "Your processes are unique. Your automation should be too.",
                description: "CustArea's Workflow Engine lets you build custom workflows for sales and support — routing messages, creating leads or tickets, assigning owners, and executing complex logic."
            },
            bg: "bg-white"
        },
        {
            question: "What happens when customers call and no one picks up?",
            title: "Voice Agent",
            image: "/features/voiceagent.png",
            content: {
                intro: "Calls don't wait. Customers don't retry forever.",
                description: "CustArea's AI Voice Agent answers calls instantly, understands intent, responds naturally, and escalates to a human with full context when required."
            },
            bg: "bg-slate-50"
        },
        {
            question: "Why do campaigns stop working after the first message?",
            title: "AI Campaign Manager",
            image: "/features/campaign.png",
            content: {
                intro: "Sending messages is easy. Following up properly isn't.",
                description: "With CustArea, AI manages your WhatsApp and email campaigns end-to-end — sending, following up, responding, and qualifying leads automatically."
            },
            bg: "bg-white"
        },
        {
            question: "Why is your pipeline always outdated?",
            title: "Sales Pipeline Handling",
            image: "/features/salespipeline.png",
            content: {
                intro: "Sales pipelines shouldn't rely on memory and manual updates.",
                description: "CustArea updates your pipeline based on real conversations. Leads move forward when customers show intent, respond, or engage — not when someone remembers to click a button."
            },
            bg: "bg-slate-50"
        },
        {
            question: "Why are customer conversations scattered everywhere?",
            title: "Omnichannel Inbox",
            image: "/features/inbox.png",
            content: {
                intro: "Switching tools kills focus. Context gets lost. Responses get delayed.",
                description: "CustArea brings every conversation into one inbox — WhatsApp, chat, email, and more — so your team always knows what's happening, with whom, and why."
            },
            bg: "bg-white"
        },
        {
            question: "Why do issues fall through the cracks?",
            title: "Ticketing System",
            image: "/features/ticket.png",
            content: {
                intro: "Not every conversation is a ticket. But every ticket should be handled properly.",
                description: "CustArea automatically creates, tracks, and manages support tickets when needed — with priorities, context, and history already attached."
            },
            bg: "bg-slate-50"
        }
    ];

    return (
        <section className="relative" id="features">

            {/* Header Section - Normal Scroll */}
            <div className="py-20 md:py-32 bg-white text-center px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] md:text-xs tracking-widest uppercase mb-3 md:mb-4 border border-blue-100">
                        Powerful Features
                    </span>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-['Outfit'] font-bold mb-6 leading-tight text-slate-900">
                        Everything to <span className="text-blue-600">win customers</span>
                    </h2>
                    <p className="text-lg md:text-xl text-slate-600 font-['Inter'] leading-relaxed max-w-2xl mx-auto">
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
                        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-12 md:py-16">
                            {/* Question Header - Full Width */}
                            <div className="mb-6 lg:mb-8 text-center lg:text-left">
                                <div className="mb-2">
                                    <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-blue-600">
                                        {feature.title}
                                    </span>
                                </div>
                                <h3 className="text-2xl md:text-4xl lg:text-5xl font-['Outfit'] font-bold text-slate-900 leading-tight">
                                    {feature.question}
                                </h3>
                            </div>

                            {/* Content and Image Grid */}
                            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">

                                {/* Content Side */}
                                <div className="order-2 lg:order-1">
                                    <p className="text-lg md:text-xl font-['Inter'] font-medium text-slate-800 mb-3 md:mb-4 leading-relaxed">
                                        {feature.content.intro}
                                    </p>
                                    <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl">
                                        {feature.content.description}
                                    </p>
                                </div>

                                {/* Image Side */}
                                <div className="order-1 lg:order-2 flex justify-center items-center">
                                    <div className="relative w-full max-w-md lg:max-w-lg aspect-[4/3] flex items-center justify-center">
                                        {/* Simple shadow/glow behind image */}
                                        <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full transform scale-75" />
                                        <img
                                            src={feature.image}
                                            alt={feature.title}
                                            className="relative w-full h-full object-contain drop-shadow-2xl"
                                        />
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
