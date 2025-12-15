"use client";

import { Container } from "@/components/ui/container";
import { GlassCard } from "@/components/ui/glass-card";
import { motion } from "framer-motion";
import { Mail, Phone, MessageSquare, BrainCircuit, ArrowRight } from "lucide-react";

export function Features() {
    return (
        <section id="features" className="py-24 relative overflow-hidden">
            <Container>
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Centralized Intelligence
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        No more siloed data. NexusAI connects every touchpoint—email, calls, and chat—into one unified brain that learns and adapts.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    {/* Inputs */}
                    <div className="space-y-6">
                        <GlassCard className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Email Bot</h3>
                                <p className="text-sm text-muted-foreground">Smart auto-replies & sorting</p>
                            </div>
                        </GlassCard>
                        <GlassCard className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                                <Phone className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Voice Agent</h3>
                                <p className="text-sm text-muted-foreground">Inbound & outbound calls</p>
                            </div>
                        </GlassCard>
                        <GlassCard className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-green-500/20 text-green-400">
                                <MessageSquare className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Chat Assistant</h3>
                                <p className="text-sm text-muted-foreground">24/7 Website support</p>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Central Brain */}
                    <div className="relative flex justify-center py-12 lg:py-0">
                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full" />
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="relative z-10 w-48 h-48 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30"
                        >
                            <BrainCircuit className="h-20 w-20 text-white" />
                        </motion.div>

                        {/* Connecting Lines (Visual only) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block">
                            <line x1="0" y1="50%" x2="35%" y2="50%" stroke="url(#gradient-line)" strokeWidth="2" strokeDasharray="4 4" />
                            <line x1="65%" y1="50%" x2="100%" y2="50%" stroke="url(#gradient-line)" strokeWidth="2" strokeDasharray="4 4" />
                            <defs>
                                <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.1)" />
                                    <stop offset="50%" stopColor="rgba(99, 102, 241, 0.5)" />
                                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.1)" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Output / Action */}
                    <div className="space-y-6">
                        <GlassCard className="p-6 border-l-4 border-l-primary">
                            <h3 className="text-white font-semibold mb-2">Unified CRM Profile</h3>
                            <p className="text-sm text-muted-foreground">
                                Every interaction is logged in one place. The agent knows the user emailed yesterday before calling today.
                            </p>
                        </GlassCard>
                        <GlassCard className="p-6 border-l-4 border-l-accent">
                            <h3 className="text-white font-semibold mb-2">Proactive Actions</h3>
                            <p className="text-sm text-muted-foreground">
                                Agent schedules meetings, sends follow-up WhatsApp messages, and updates deal status automatically.
                            </p>
                        </GlassCard>
                    </div>
                </div>
            </Container>
        </section>
    );
}
