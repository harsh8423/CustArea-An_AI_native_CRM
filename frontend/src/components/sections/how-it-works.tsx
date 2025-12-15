"use client";

import { Container } from "@/components/ui/container";
import { motion } from "framer-motion";
import { PhoneCall, Globe, MessageSquare, CheckCircle2 } from "lucide-react";

const steps = [
    {
        icon: PhoneCall,
        title: "Initial Contact",
        description: "Customer calls your number. AI Agent picks up instantly, answers queries, and qualifies the lead."
    },
    {
        icon: Globe,
        title: "Seamless Handoff",
        description: "Agent invites customer to the website for a demo. Context is transferred instantly to the web session."
    },
    {
        icon: MessageSquare,
        title: "Interactive Demo",
        description: "Virtual Receptionist greets the customer by name, shows products, and answers questions visually."
    },
    {
        icon: CheckCircle2,
        title: "Conversion",
        description: "Agent schedules a meeting or processes the sale. All data is logged in your CRM automatically."
    }
];

export function HowItWorks() {
    return (
        <section className="py-24 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />

            <Container>
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        A Flawless Customer Journey
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        From the first ring to the final sale, NexusAI manages the entire lifecycle without missing a beat.
                    </p>
                </div>

                <div className="relative">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent hidden lg:block -translate-y-1/2" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.2 }}
                                className="flex flex-col items-center text-center group"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-secondary border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:border-primary/50 transition-colors shadow-lg shadow-black/50">
                                    <step.icon className="h-8 w-8 text-white group-hover:text-primary transition-colors" />
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white border-4 border-background">
                                        {i + 1}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </Container>
        </section>
    );
}
