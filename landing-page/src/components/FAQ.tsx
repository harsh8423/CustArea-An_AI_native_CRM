'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const faqs = [
        {
            question: 'How does the AI agent handle complex queries?',
            answer: 'Our AI uses RAG (Retrieval-Augmented Generation) to search your knowledge base for accurate, grounded answers. It automatically detects sentiment and intent, follows guardrails, and escalates to humans when needed.'
        },
        {
            question: 'Can I connect my existing WhatsApp Business account?',
            answer: 'Yes! CustArea integrates with WhatsApp Business API through Twilio. Connect your existing verified business number or set up a new one. All conversations sync to your unified inbox.'
        },
        {
            question: 'How does the visual workflow automation work?',
            answer: 'Our drag-and-drop builder lets you create powerful automations without code. Start with a trigger, add conditions and branching logic, use AI nodes to generate responses, and define multi-channel actions.'
        },
        {
            question: 'Is my customer data secure?',
            answer: 'Security is our top priority. We use JWT authentication, bcrypt hashing, role-based access control, and per-tenant data isolation. AI guardrails filter sensitive content.'
        },
        {
            question: 'What channels do you support?',
            answer: 'CustArea provides omni-channel support: WhatsApp Business API, Email (webhooks and SMTP), Phone/Voice with real-time AI, and an embeddable Live Chat widget. All channels flow into a unified inbox.'
        },
        {
            question: 'How long does implementation take?',
            answer: 'Most customers are up and running within a few hours. Basic setup takes under an hour. Building custom workflows can be done progressively. Our team provides onboarding support for all plans.'
        }
    ];

    return (
        <section className="py-24 lg:py-32" id="faq">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <span className="badge mb-4">FAQ</span>
                    <h2 className="section-heading mb-6">
                        Frequently asked <span className="text-gradient-gold">questions</span>
                    </h2>
                    <p className="section-subheading">
                        Everything you need to know about CustArea.
                    </p>
                </div>

                {/* FAQ List */}
                <div className="space-y-3">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className={`bg-white rounded-xl border transition-all duration-300 ${openIndex === index
                                ? 'border-amber-300 shadow-lg shadow-amber-100/50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full py-4 px-5 text-left flex items-center justify-between gap-4"
                            >
                                <span className="text-base md:text-lg font-semibold text-gray-900">{faq.question}</span>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${openIndex === index
                                    ? 'bg-amber-500 text-white rotate-45'
                                    : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    <span className="text-sm leading-none mb-0.5">+</span>
                                </span>
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-5 text-sm md:text-base text-gray-600 leading-relaxed">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
