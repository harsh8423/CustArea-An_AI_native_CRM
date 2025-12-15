import { Container } from "@/components/ui/container";
import { GlassCard } from "@/components/ui/glass-card";
import { Building2, ShoppingCart, ShieldCheck, Stethoscope } from "lucide-react";

const industries = [
    {
        icon: Building2,
        title: "Real Estate",
        description: "Virtual agents guide clients through property tours, answer queries about amenities, and schedule viewings instantly.",
        color: "text-blue-400",
        bg: "bg-blue-500/10"
    },
    {
        icon: ShoppingCart,
        title: "E-Commerce",
        description: "Personal shoppers that browse with the user, suggest matching items based on preferences, and handle checkout.",
        color: "text-purple-400",
        bg: "bg-purple-500/10"
    },
    {
        icon: ShieldCheck,
        title: "Insurance",
        description: "Automated claim processing and policy explanation. Agents can collect documents and guide users through forms.",
        color: "text-green-400",
        bg: "bg-green-500/10"
    },
    {
        icon: Stethoscope,
        title: "Healthcare",
        description: "Patient intake, appointment scheduling, and basic triage. Secure and compliant handling of patient data.",
        color: "text-red-400",
        bg: "bg-red-500/10"
    }
];

export function UseCases() {
    return (
        <section id="solutions" className="py-24">
            <Container>
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Tailored for Every Industry
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        NexusAI adapts to your specific business needs, providing specialized knowledge and workflows.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {industries.map((item, i) => (
                        <GlassCard key={i} className="p-6 hover:-translate-y-2 transition-transform duration-300">
                            <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
                                <item.icon className={`h-6 w-6 ${item.color}`} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {item.description}
                            </p>
                        </GlassCard>
                    ))}
                </div>
            </Container>
        </section>
    );
}
