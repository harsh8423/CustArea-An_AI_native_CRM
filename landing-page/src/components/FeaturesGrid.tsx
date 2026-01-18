import React from 'react';
import { MessageCircle, Workflow, Sparkles, Megaphone, ArrowRight, Bot, Mail, Send } from 'lucide-react';

const FeaturesGrid: React.FC = () => {
    return (
        <section className="bg-white py-24 relative overflow-hidden" id="platform">
            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium mb-4">
                        Powering your growth
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-slate-900 tracking-tight">
                        All the tools you need
                    </h2>
                    <p className="text-base sm:text-lg text-slate-500">
                        Everything your team needs to support customers and close deals — in one unified platform.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Card 1: Customer Support (Wide) */}
                    <div className="lg:col-span-12 bg-slate-50 border border-slate-100 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 lg:p-12 flex flex-col md:flex-row items-center gap-8 sm:gap-10 md:gap-12 overflow-hidden hover:shadow-xl transition-all duration-300 group">
                        <div className="md:w-1/2 space-y-4 sm:space-y-6">
                            <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold bg-indigo-50 px-3 py-1 rounded-full text-xs sm:text-sm">
                                <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" /> Customer Support
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                                Support leads and customers instantly — without being online 24/7
                            </h3>
                            <p className="text-slate-500 leading-relaxed text-sm sm:text-base">
                                Add CustArea to your business channels and stay responsive at all times. From WhatsApp and website chat to email and calls, CustArea helps you handle customer conversations instantly, qualify intent, and resolve issues — even when your team is offline or overloaded.
                            </p>
                            {/* <button className="text-indigo-600 font-semibold flex items-center gap-2 hover:gap-3 transition-all text-xs sm:text-sm min-h-[44px]">
                                Learn more <ArrowRight className="w-4 h-4" />
                            </button> */}
                        </div>
                        <div className="md:w-1/2 w-full relative perspective-1000">
                            {/* Mock Chat UI */}
                            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-md mx-auto transform rotate-1 group-hover:rotate-0 transition-transform duration-500 relative z-10">
                                {/* Chat Header */}
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                        <Bot className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 text-sm">CustArea Agent</div>
                                        <div className="text-[10px] text-green-500 flex items-center gap-1 font-medium bg-green-50 px-1.5 py-0.5 rounded-full w-fit">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Online
                                        </div>
                                    </div>
                                </div>
                                {/* Messages */}
                                <div className="space-y-3 text-sm">
                                    <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none text-slate-600 max-w-[85%] text-xs leading-relaxed border border-slate-100">
                                        Hi there! I noticed you're looking at our Enterprise plan. Do you have any questions about the features?
                                    </div>
                                    <div className="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none ml-auto max-w-[85%] text-xs leading-relaxed shadow-md shadow-indigo-200">
                                        Yes, does it include custom API access?
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none text-slate-600 max-w-[85%] text-xs leading-relaxed border border-slate-100">
                                        Absolutely! The Enterprise plan comes with full API access and a dedicated support engineer to help you integrate.
                                    </div>
                                </div>
                                {/* Input */}
                                <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                                    <div className="h-8 bg-slate-50 rounded-full flex-1 border border-slate-100"></div>
                                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white"><Send className="w-3 h-3" /></div>
                                </div>
                            </div>

                            {/* Decorative Blob */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-100/50 blur-3xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        </div>
                    </div>

                    {/* Card 2: Workflow (Tall Left) */}
                    <div className="lg:col-span-7 bg-slate-50 border border-slate-100 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 lg:p-12 flex flex-col justify-between overflow-hidden hover:shadow-xl transition-all duration-300 group">
                        <div className="space-y-4 sm:space-y-6 max-w-xl">
                            <div className="inline-flex items-center gap-2 text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-full text-xs sm:text-sm">
                                <Workflow className="w-3 h-3 sm:w-4 sm:h-4" /> Workflow & Automation
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Automate your sales and support operations with flexible workflows
                            </h3>
                            <p className="text-slate-500 leading-relaxed text-xs sm:text-sm md:text-base">
                                Every business works differently. CustArea's workflow engine lets you design custom logic for how conversations are handled — from routing messages and creating leads or tickets, assigning owners, and executing complex logic.
                            </p>
                            <p className="text-slate-500 leading-relaxed text-xs sm:text-sm md:text-base border-l-2 border-blue-200 pl-3 sm:pl-4 italic">
                                Combine rules with AI decisions to automate complex operations without losing control.
                            </p>
                            <button className="bg-blue-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-200 min-h-[44px]">
                                Explore Workflows
                            </button>
                        </div>

                        <div className="mt-12 relative h-64 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />

                            {/* Visual Node Graph */}
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-8 w-full transition-transform duration-500 group-hover:translate-y-[-10px]">
                                <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm text-xs font-semibold text-slate-700 flex items-center gap-2 z-10">
                                    <Mail className="w-3 h-3 text-blue-500" /> Incoming Email
                                </div>

                                <div className="flex gap-12 relative">
                                    {/* Lines */}
                                    <div className="absolute top-[-32px] left-1/2 w-px h-8 bg-slate-300 -translate-x-1/2"></div>
                                    <div className="absolute top-[-16px] left-[25%] right-[25%] h-px bg-slate-300 border-t border-slate-300"></div>
                                    <div className="absolute top-[-16px] left-[25%] w-px h-4 bg-slate-300"></div>
                                    <div className="absolute top-[-16px] right-[25%] w-px h-4 bg-slate-300"></div>

                                    <div className="bg-white border border-green-200 px-3 py-2 rounded-lg shadow-sm text-xs font-medium text-green-700 bg-green-50 w-32 text-center">
                                        Is Support?
                                    </div>
                                    <div className="bg-white border border-purple-200 px-3 py-2 rounded-lg shadow-sm text-xs font-medium text-purple-700 bg-purple-50 w-32 text-center">
                                        Is Sales?
                                    </div>
                                </div>

                                <div className="flex gap-12">
                                    <div className="w-32 flex justify-center">
                                        <div className="w-px h-8 bg-slate-300"></div>
                                    </div>
                                    <div className="w-32 flex justify-center">
                                        <div className="w-px h-8 bg-slate-300"></div>
                                    </div>
                                </div>

                                <div className="flex gap-12 mt-[-32px]">
                                    <div className="w-32 flex justify-center">
                                        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-green-600"><Bot className="w-3 h-3" /></div>
                                            <span className="text-[10px] font-medium">Auto-Reply</span>
                                        </div>
                                    </div>
                                    <div className="w-32 flex justify-center">
                                        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600"><Bot className="w-3 h-3" /></div>
                                            <span className="text-[10px] font-medium">Create Lead</span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right Column Stack */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* Card 3: AI Copilot */}
                        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                            <div className="mb-6 inline-flex items-center gap-2 text-purple-600 font-semibold bg-purple-50 px-3 py-1 rounded-full text-sm w-fit">
                                <Sparkles className="w-4 h-4" /> AI Copilot
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">
                                AI that works with your team, not instead of it
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                CustArea’s AI copilot understands customer intent, responds with context, and steps in whenever needed.
                            </p>

                            <div className="mt-auto bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-3 items-start relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 relative z-10">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="text-sm relative z-10">
                                    <div className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                        Copilot Suggestion
                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded">98% match</span>
                                    </div>
                                    <div className="text-slate-500 text-xs italic">
                                        "Based on the customer's question about pricing, I recommend sending the Enterprise PDF."
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <button className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors">Apply</button>
                                        <button className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200 transition-colors">Dismiss</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Campaigns */}
                        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                            <div className="mb-4 sm:mb-6 inline-flex items-center gap-2 text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full text-xs sm:text-sm w-fit">
                                <Megaphone className="w-3 h-3 sm:w-4 sm:h-4" /> Campaigns
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">
                                Run WhatsApp and email campaigns
                            </h3>
                            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6 sm:mb-8">
                                CustArea helps you run campaigns where AI manages replies and follows up automatically.
                            </p>
                            {/* Mock Stats */}
                            <div className="mt-auto grid grid-cols-2 gap-3">
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center group hover:border-green-200 transition-colors">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Open Rate</div>
                                    <div className="text-2xl font-bold text-slate-900 group-hover:text-green-600 transition-colors">68%</div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center group hover:border-green-200 transition-colors">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Replied</div>
                                    <div className="text-2xl font-bold text-slate-900 group-hover:text-green-600 transition-colors">24%</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    )
}

export default FeaturesGrid;
