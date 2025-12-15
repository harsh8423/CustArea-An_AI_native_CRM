import { Circle, Play, ChevronRight, Globe, MessageSquare, Mail, X } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            {/* Top Banner Area - Outside the tab */}
            <div className="px-8 py-4 flex items-center justify-between shrink-0">
                <div className="text-sm text-gray-600">
                    You have <span className="font-semibold text-black">8 days left</span> in your <span className="underline cursor-pointer hover:text-black">Advanced trial</span>. Includes unlimited Fin usage.
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Apply for a 90% Early Stage discount</span>
                    <button className="bg-black text-white px-4 py-2 rounded-lg font-medium text-xs hover:bg-gray-800 transition">
                        Buy Intercom
                    </button>
                    <button className="text-gray-400 hover:text-black transition">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Main Content - Tab/Card Style */}
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">

                <div className="flex-1 overflow-y-auto p-12">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-3xl font-serif text-[#1a1a1a] mb-8">
                            Get started with AI-first customer support
                        </h1>

                        <div className="space-y-6">
                            {/* Step 1: Get set up */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
                                        <div className="h-2.5 w-2.5 bg-transparent rounded-full" />
                                    </div>
                                    <span className="font-semibold text-[#1a1a1a]">Get set up</span>
                                    <span className="text-gray-500 text-sm">• 0/3 steps</span>
                                </div>

                                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                    {/* Active Step */}
                                    <div className="p-6 flex gap-8">
                                        <div className="flex-1">
                                            <div className="flex items-start gap-3 mb-2">
                                                <Circle className="h-5 w-5 text-gray-300 mt-0.5" />
                                                <div>
                                                    <h3 className="font-semibold text-[#1a1a1a]">Set up channels to connect with your customers</h3>
                                                    <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                                                        Manage conversations across all channels: Messenger, email, phone, WhatsApp, SMS, and social. Support your customers wherever they are, directly from your Intercom Inbox. <span className="underline cursor-pointer">More about channels</span>
                                                    </p>
                                                    <button className="mt-4 bg-black text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-gray-800 transition">
                                                        Set up channels
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual/Image Area */}
                                        <div className="w-64 bg-gray-50 rounded-lg border p-4 relative">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="h-10 w-10 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 opacity-60">
                                                <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
                                                    <span>Views</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs p-1.5 bg-gray-200 rounded">
                                                    <div className="flex items-center gap-2"><Globe className="h-3 w-3" /> All channels</div>
                                                    <span>47</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs p-1.5">
                                                    <div className="flex items-center gap-2"><MessageSquare className="h-3 w-3" /> Messenger</div>
                                                    <span>21</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs p-1.5">
                                                    <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> Email</div>
                                                    <span>14</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inactive Steps */}
                                    <div className="border-t px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition">
                                        <div className="flex items-center gap-3">
                                            <Circle className="h-5 w-5 text-gray-300" />
                                            <span className="font-medium text-gray-700">Invite your teammates to collaborate faster</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="border-t px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition">
                                        <div className="flex items-center gap-3">
                                            <Circle className="h-5 w-5 text-gray-300" />
                                            <span className="font-medium text-gray-700">Add content to power your AI and Help Center</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Go further */}
                            <div className="pt-4">
                                <h3 className="font-semibold text-[#1a1a1a] mb-4">Go further</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="bg-white border rounded-xl p-4 h-32 flex items-center justify-center text-gray-400">
                                            Feature Card {i}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Chat Bubble */}
            <div className="fixed bottom-6 right-6 z-50">
                <button className="h-12 w-12 bg-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition">
                    <div className="relative">
                        <MessageSquare className="h-6 w-6 text-white" />
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-black"></div>
                    </div>
                </button>
            </div>
        </div>
    );
}
