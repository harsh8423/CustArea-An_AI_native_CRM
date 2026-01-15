export default function AIShowcase() {
    const capabilities = [
        { icon: '📚', title: 'Knowledge RAG', desc: 'Vector embeddings for accurate responses' },
        { icon: '🛡️', title: 'Guardrails', desc: 'Safe, controlled AI outputs' },
        { icon: '📈', title: 'Sentiment Detection', desc: 'Auto-detect customer mood' },
        { icon: '🔧', title: 'Function Calling', desc: 'AI executes CRM actions' },
        { icon: '🔄', title: 'Auto-Escalation', desc: 'Hand off to humans when needed' },
        { icon: '🧠', title: 'Multi-LLM', desc: 'GPT-4o, Claude, or Groq' },
    ];

    const messages = [
        { type: 'user', text: 'I need help with your API integration. Where can I find the docs?' },
        { type: 'ai', text: "I'd be happy to help! 🚀 Our API documentation is available at docs.custarea.com/api/v1. It includes authentication guides, endpoint references, and code examples in Python, Node.js, and cURL." },
        { type: 'user', text: 'Can you create a support ticket for me?' },
        { type: 'ai', text: "Done! ✅ I've created ticket #4823 - API Integration Help. Our team will respond within 24 hours.", action: '🎫 Ticket #4823 created' },
    ];

    return (
        <section className="py-24 lg:py-32 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden" id="ai-showcase">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Chat Demo */}
                    <div className="order-2 lg:order-1">
                        <div className="bg-white/10 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/20">
                            {/* Chat Header */}
                            <div className="p-5 bg-white/5 border-b border-white/10 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-bold text-gray-900">
                                    AI
                                </div>
                                <div>
                                    <div className="font-semibold">CustArea AI Agent</div>
                                    <div className="text-sm text-gray-400">Powered by GPT-4o</div>
                                </div>
                                <div className="ml-auto w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                            </div>

                            {/* Messages */}
                            <div className="p-5 space-y-4 min-h-[380px]">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-4 rounded-2xl ${msg.type === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-sm'
                                                : 'bg-white/10 text-gray-100 rounded-bl-sm'
                                            }`}>
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                            {msg.action && (
                                                <div className="mt-3 p-2 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium">
                                                    {msg.action}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="order-1 lg:order-2">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-300 text-sm font-semibold rounded-full mb-6">
                            AI Platform
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                            AI that actually <span className="text-gradient-gold">understands</span>
                        </h2>
                        <p className="text-lg text-gray-300 mb-10 leading-relaxed">
                            Our AI doesn't just respond — it understands context, executes actions,
                            and knows when to involve your human team.
                        </p>

                        {/* Capabilities Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {capabilities.map((cap, i) => (
                                <div key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg flex-shrink-0">
                                        {cap.icon}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm text-white">{cap.title}</div>
                                        <div className="text-xs text-gray-400">{cap.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
