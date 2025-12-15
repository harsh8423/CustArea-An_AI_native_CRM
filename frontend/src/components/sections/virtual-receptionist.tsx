"use client";

import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { motion } from "framer-motion";
import { Calendar, MessageCircle, User, ShoppingBag } from "lucide-react";

export function VirtualReceptionist() {
    return (
        <section className="py-24 bg-white/5 relative">
            <Container>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent mb-6">
                            <span>New Feature</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Meet Your New <br />
                            <span className="text-primary">Virtual Receptionist</span>
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Not just a chatbot. A fully interactive avatar that can browse products with customers, schedule meetings, and demonstrate software features in real-time.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {[
                                "Visual Product Browsing on Canvas",
                                "Real-time Calendar Scheduling",
                                "Behavioral Observation & Ad Targeting",
                                "Seamless Handoff to Human Agents"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <Button variant="glow">Try the Demo</Button>
                    </div>

                    {/* Interactive Mockup */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 blur-3xl rounded-full" />
                        <GlassCard className="relative p-6 min-h-[500px] flex flex-col">
                            {/* Mock Browser Header */}
                            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                                </div>
                                <div className="h-6 w-full bg-white/5 rounded-md ml-4" />
                            </div>

                            {/* Chat Interface */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                        <User className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none max-w-[80%]">
                                        <p className="text-sm text-white">Hi, I'm looking for a summer dress for a beach wedding.</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 flex-row-reverse">
                                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                                        <BotAvatar />
                                    </div>
                                    <div className="bg-primary/20 p-3 rounded-2xl rounded-tr-none max-w-[80%]">
                                        <p className="text-sm text-white">I can help with that! Here are some trending floral options that match your style.</p>
                                    </div>
                                </div>

                                {/* Product Canvas */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    className="mt-4 grid grid-cols-2 gap-3"
                                >
                                    {[1, 2].map((i) => (
                                        <div key={i} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer group">
                                            <div className="aspect-[3/4] bg-white/5 rounded-md mb-2 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 group-hover:opacity-100 opacity-0 transition-opacity" />
                                                <ShoppingBag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />
                                            </div>
                                            <div className="h-2 w-2/3 bg-white/10 rounded mb-1" />
                                            <div className="h-2 w-1/3 bg-white/10 rounded" />
                                        </div>
                                    ))}
                                </motion.div>
                            </div>
                        </GlassCard>

                        {/* Floating Action Badge */}
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute -right-8 top-1/3 bg-white text-black p-4 rounded-xl shadow-xl max-w-[200px]"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="font-bold text-xs">Meeting Scheduled</span>
                            </div>
                            <p className="text-xs text-gray-600">Demo booked for tomorrow at 2 PM.</p>
                        </motion.div>
                    </div>
                </div>
            </Container>
        </section>
    );
}

function BotAvatar() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.66 6 15 7.34 15 9C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9C9 7.34 10.34 6 12 6ZM12 20C9.33 20 7 18 7 15C7 14 9.33 13 12 13C14.67 13 17 14 17 15C17 18 14.67 20 12 20Z" fill="currentColor" />
        </svg>
    );
}
