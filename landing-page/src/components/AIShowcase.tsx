'use client';

import { motion } from 'framer-motion';
import { Brain, Shield, Zap, FileText } from 'lucide-react';

export default function AIShowcase() {
    return (
        <section className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden" id="ai-showcase">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <span className="badge-gold mb-3">The Brain</span>
                    <h2 className="section-heading mb-6">
                        More than just a chatbot. <br />
                        <span className="text-gradient-gold">It understands.</span>
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                        CustArea's AI engine doesn't just match keywords. It understands context,
                        analyzes sentiment, and securely accesses your knowledge base to provide
                        human-like resolution.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">

                    {/* Feature 1: Contextual Understanding (Large) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50 transition-opacity group-hover:opacity-80" />

                        <div className="relative z-10 h-full flex flex-col">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                                <Brain className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">Contextual Memory</h3>
                            <p className="text-slate-500 mb-8 max-w-md">
                                The AI remembers previous interactions across channels. It knows if a user
                                emailed yesterday before chatting today.
                            </p>

                            {/* Visual: Connected Nodes */}
                            <div className="mt-auto flex gap-4 items-center">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs shadow-sm font-bold text-slate-400">
                                            U{i}
                                        </div>
                                    ))}
                                </div>
                                <div className="h-0.5 flex-1 bg-gradient-to-r from-slate-200 to-blue-500 rounded-full" />
                                <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-full shadow-lg shadow-blue-200 font-medium">
                                    Unified Context
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 2: Sentiment Analysis */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Sentiment Detection</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Detects frustration instantly and prioritizes urgent cases.
                            </p>

                            {/* Visual: Sentiment Gauge */}
                            <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-2xl grayscale opacity-50">😡</span>
                                <div className="h-2 flex-1 mx-3 bg-slate-200 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: "0%" }}
                                        whileInView={{ width: "70%" }}
                                        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                                        className="h-full bg-gradient-to-r from-red-400 to-amber-400"
                                    />
                                </div>
                                <span className="text-2xl">😊</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 3: RAG / Knowledge Base */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden"
                    >
                        {/* Matrix effect background */}
                        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                                <FileText className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Knowledge RAG</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Instantly parses your PDFs, Docs, and URLs to answer accurately.
                            </p>

                            <div className="space-y-2">
                                {['Pricing_2024.pdf', 'API_Docs.md', 'Support_Policy.docx'].map((file, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded border border-white/10">
                                        <span className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                            {file}
                                        </span>
                                        <span className="text-green-400 font-mono">PARSED</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 4: Guardrails & Security (Large) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-64 h-64 bg-green-50 rounded-full -ml-16 -mt-16 blur-3xl opacity-50" />

                        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                            <div className="flex-1">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-3">Enterprise Guardrails</h3>
                                <p className="text-slate-500 mb-6">
                                    Strict safety layers ensure the AI never hallucinates, goes off-topic,
                                    or shares sensitive data. You control the boundaries.
                                </p>
                                <ul className="space-y-2">
                                    {['PII Redaction', 'Profanity Filter', 'Competitor Block', 'Topic Confinement'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                            <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">✓</div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Visual: Shield Animation */}
                            <div className="w-full md:w-1/2 h-48 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="w-32 h-32 bg-green-500/10 rounded-full absolute"
                                    />
                                    <Shield className="w-16 h-16 text-green-500 relative z-10" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
