export default function HowItWorks() {
    const steps = [
        {
            number: '01',
            title: 'Connect Your Channels',
            desc: 'Link WhatsApp Business, connect email via SMTP, enable Twilio for voice, and install our chat widget.',
            details: ['WhatsApp Business API', 'Email webhooks & SMTP', 'Voice AI', 'Chat widget']
        },
        {
            number: '02',
            title: 'Train Your AI Agent',
            desc: 'Upload knowledge base documents, configure AI personality, set up guardrails for safe responses.',
            details: ['Upload PDFs, docs', 'Custom prompts', 'Guardrails', 'Escalation rules']
        },
        {
            number: '03',
            title: 'Build Visual Workflows',
            desc: 'Create no-code automations with our drag-and-drop builder. Connect triggers, add conditions, use AI nodes.',
            details: ['Event triggers', 'If/else logic', 'AI response', 'Multi-channel']
        },
        {
            number: '04',
            title: 'Go Live & Optimize',
            desc: 'Deploy your AI-powered experience. Monitor real-time analytics, track SLA performance, continuously improve.',
            details: ['Real-time monitoring', 'Analytics', 'SLA tracking', 'Optimization']
        }
    ];

    return (
        <section className="py-24 lg:py-32" id="how-it-works">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
                    <span className="badge-gold mb-4">How It Works</span>
                    <h2 className="section-heading mb-6">
                        Go live in <span className="text-gradient-gold">4 simple steps</span>
                    </h2>
                    <p className="section-subheading">
                        From sign-up to your first AI-powered conversation in hours, not weeks.
                    </p>
                </div>

                {/* Steps Grid */}
                <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
                    {steps.map((step, index) => (
                        <div key={index} className="card relative overflow-hidden group">
                            {/* Step Number - Background */}
                            <div className="absolute -top-4 -right-4 text-[120px] font-black text-gray-100 leading-none select-none group-hover:text-blue-50 transition-colors">
                                {step.number}
                            </div>

                            {/* Content */}
                            <div className="relative z-10">
                                {/* Step Badge */}
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-white font-bold mb-6 ${index % 2 === 0
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                                        : 'bg-gradient-to-br from-amber-500 to-orange-500'
                                    }`}>
                                    {step.number}
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                                <p className="text-gray-600 mb-6 leading-relaxed">{step.desc}</p>

                                {/* Details */}
                                <ul className="space-y-2">
                                    {step.details.map((detail, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
