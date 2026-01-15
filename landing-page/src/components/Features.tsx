export default function Features() {
    const features = [
        {
            icon: '💬',
            color: 'from-[#1E4A8D] to-[#2E5A9D]',
            title: 'Omni-Channel Inbox',
            desc: 'Unify all conversations from WhatsApp, Email, Phone, and Live Chat into a single intelligent inbox.',
            tags: ['WhatsApp', 'Email', 'Voice', 'Chat']
        },
        {
            icon: '🤖',
            color: 'from-[#D4AF37] to-[#C4A027]',
            title: 'AI Agents',
            desc: 'Deploy configurable AI agents powered by GPT-4o. RAG knowledge base, sentiment detection, auto-escalation.',
            tags: ['Multi-LLM', 'RAG', 'Guardrails']
        },
        {
            icon: '⚡',
            color: 'from-[#1E4A8D] to-[#2E5A9D]',
            title: 'Visual Workflows',
            desc: 'Create powerful automations without code. Drag-and-drop builder with triggers, conditions, and AI nodes.',
            tags: ['No-Code', 'Triggers', 'AI Nodes']
        },
        {
            icon: '📊',
            color: 'from-[#D4AF37] to-[#C4A027]',
            title: 'Sales Pipeline',
            desc: 'Track leads through customizable Kanban boards. Auto lead scoring, round-robin assignment, activity timeline.',
            tags: ['Kanban', 'Scoring', 'Timeline']
        },
        {
            icon: '📚',
            color: 'from-[#1E4A8D] to-[#2E5A9D]',
            title: 'Knowledge Base',
            desc: 'Train your AI with documents and FAQs. Vector embeddings enable semantic search for accurate responses.',
            tags: ['Vector Search', 'RAG', 'Semantic']
        },
        {
            icon: '🎫',
            color: 'from-[#D4AF37] to-[#C4A027]',
            title: 'Smart Ticketing',
            desc: 'Auto-create tickets from AI conversations. Priority detection, SLA tracking, macros for quick responses.',
            tags: ['Auto-Create', 'SLA', 'Macros']
        }
    ];

    return (
        <section className="py-24 lg:py-32 bg-gray-50" id="features">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
                    <span className="badge mb-4">Powerful Features</span>
                    <h2 className="section-heading mb-6">
                        Everything to <span className="text-gradient-gold">win customers</span>
                    </h2>
                    <p className="section-subheading">
                        A complete platform combining AI intelligence, omni-channel communication,
                        and powerful automation tools.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="card-feature group">
                            {/* Icon */}
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {feature.icon}
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                            <p className="text-gray-600 mb-5 leading-relaxed">{feature.desc}</p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                                {feature.tags.map((tag, i) => (
                                    <span key={i} className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
